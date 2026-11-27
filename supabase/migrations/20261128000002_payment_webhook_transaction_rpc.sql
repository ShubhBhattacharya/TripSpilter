-- Additive migration: transactional payment webhook processing RPC and stale-lock tracking.
-- Ensures payment_orders, expense_splits, payment_refunds, and payment_webhook_events commit
-- or roll back atomically inside one database transaction, while reclaiming stale locks (>5m).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_webhook_events' AND column_name = 'processing_started_at'
  ) THEN
    ALTER TABLE public.payment_webhook_events
      ADD COLUMN processing_started_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_webhook_events' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.payment_webhook_events
      ADD COLUMN updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;
  END IF;
END $$;

UPDATE public.payment_webhook_events
SET processing_started_at = COALESCE(processing_started_at, processed_at, timezone('utc'::text, now()))
WHERE processing_started_at IS NULL;

CREATE OR REPLACE FUNCTION public.process_payment_webhook(
  p_provider TEXT,
  p_event_id TEXT,
  p_event_type TEXT,
  p_payload JSONB,
  p_stale_after_seconds INTEGER DEFAULT 300
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_jwt_role TEXT := COALESCE(current_setting('request.jwt.claim.role', true), '');
  v_now TIMESTAMPTZ := timezone('utc'::text, now());
  v_stale_interval INTERVAL := make_interval(secs => GREATEST(COALESCE(p_stale_after_seconds, 300), 1));
  v_event public.payment_webhook_events%ROWTYPE;
  v_reclaimed_stale BOOLEAN := false;
  v_inserted_id UUID;

  v_payment_entity JSONB;
  v_payment_id TEXT;
  v_payment_order_id TEXT;
  v_payload_currency TEXT;
  v_payload_amount_paise BIGINT;
  v_order public.payment_orders%ROWTYPE;
  v_expected_currency TEXT;
  v_next_order_status TEXT;
  v_err TEXT;

  v_refund_entity JSONB;
  v_refund_id TEXT;
  v_refund_payment_id TEXT;
  v_refund_amount_paise BIGINT;
  v_stored_refund RECORD;
  v_amount_matches BOOLEAN;
  v_next_refund_status TEXT;
  v_parent_order RECORD;
  v_processed_refund_sum BIGINT := 0;
  v_reconciled_order_status TEXT;
BEGIN
  IF v_jwt_role <> 'service_role' AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Forbidden: process_payment_webhook requires trusted service_role authority'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.payment_webhook_events (
    provider,
    event_id,
    event_type,
    signature_verified,
    processing_status,
    payload,
    processing_started_at,
    updated_at
  )
  VALUES (
    p_provider,
    p_event_id,
    p_event_type,
    true,
    'processing',
    p_payload,
    v_now,
    v_now
  )
  ON CONFLICT (provider, event_id) DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    SELECT * INTO v_event
    FROM public.payment_webhook_events
    WHERE provider = p_provider AND event_id = p_event_id
    FOR UPDATE;

    IF v_event.processing_status = 'processed' THEN
      RETURN jsonb_build_object('status', 'duplicate_replay', 'eventId', p_event_id);
    END IF;

    IF v_event.processing_status = 'processing' THEN
      IF COALESCE(v_event.processing_started_at, v_event.processed_at) >= (v_now - v_stale_interval) THEN
        RETURN jsonb_build_object('status', 'in_progress', 'eventId', p_event_id);
      END IF;
      v_reclaimed_stale := true;
    END IF;

    UPDATE public.payment_webhook_events
    SET
      processing_status = 'processing',
      event_type = p_event_type,
      payload = p_payload,
      retry_count = COALESCE(retry_count, 0) + 1,
      processing_started_at = v_now,
      updated_at = v_now,
      last_error = NULL
    WHERE id = v_event.id;
  END IF;

  -- Handle Razorpay payment.* event
  v_payment_entity := p_payload #> '{payload,payment,entity}';
  IF v_payment_entity IS NOT NULL THEN
    v_payment_order_id := NULLIF(trim(COALESCE(v_payment_entity->>'order_id', '')), '');
    v_payment_id := NULLIF(trim(COALESCE(v_payment_entity->>'id', '')), '');
    v_payload_currency := upper(trim(COALESCE(v_payment_entity->>'currency', '')));
    IF jsonb_typeof(v_payment_entity->'amount') = 'number' THEN
      v_payload_amount_paise := (v_payment_entity->>'amount')::BIGINT;
    END IF;

    IF v_payment_order_id IS NOT NULL THEN
      SELECT * INTO v_order
      FROM public.payment_orders
      WHERE provider_order_id = v_payment_order_id
      FOR UPDATE;

      IF FOUND THEN
        IF p_event_type = 'payment.captured' THEN
          v_expected_currency := upper(trim(COALESCE(v_order.currency, 'INR')));
          IF v_payload_currency <> '' AND v_payload_currency <> v_expected_currency THEN
            v_err := format(
              'Captured payment currency (%s) does not match order currency (%s).',
              v_payload_currency,
              v_expected_currency
            );
            UPDATE public.payment_webhook_events
            SET processing_status = 'failed', last_error = left(v_err, 300), updated_at = v_now
            WHERE provider = p_provider AND event_id = p_event_id;
            RETURN jsonb_build_object('status', 'validation_error', 'httpStatus', 422, 'error', v_err);
          END IF;

          IF v_payload_amount_paise IS NOT NULL AND v_payload_amount_paise < v_order.amount_paise THEN
            v_err := format(
              'Captured payment amount (%s paise) is less than order amount (%s paise).',
              v_payload_amount_paise,
              v_order.amount_paise
            );
            UPDATE public.payment_webhook_events
            SET processing_status = 'failed', last_error = left(v_err, 300), updated_at = v_now
            WHERE provider = p_provider AND event_id = p_event_id;
            RETURN jsonb_build_object('status', 'validation_error', 'httpStatus', 422, 'error', v_err);
          END IF;
        END IF;

        v_next_order_status := CASE
          WHEN p_event_type = 'payment.captured' THEN 'captured'
          WHEN p_event_type = 'payment.failed' THEN 'failed'
          ELSE 'pending'
        END;

        UPDATE public.payment_orders
        SET
          status = v_next_order_status,
          provider_payment_id = COALESCE(v_payment_id, provider_payment_id),
          updated_at = v_now
        WHERE id = v_order.id;

        IF v_order.split_id IS NOT NULL AND v_next_order_status = 'captured' THEN
          UPDATE public.expense_splits
          SET
            status = 'verified_paid',
            transaction_ref = v_payment_id,
            paid_at = v_now
          WHERE id = v_order.split_id;
        ELSIF v_order.split_id IS NOT NULL AND v_next_order_status = 'failed' THEN
          UPDATE public.expense_splits
          SET status = 'failed'
          WHERE id = v_order.split_id;
        END IF;
      END IF;
    END IF;
  END IF;

  -- Handle Razorpay refund.* event cumulatively inside the same transaction
  v_refund_entity := p_payload #> '{payload,refund,entity}';
  IF v_refund_entity IS NOT NULL AND p_event_type IN ('refund.created', 'refund.processed', 'refund.failed') THEN
    v_refund_id := NULLIF(trim(COALESCE(v_refund_entity->>'id', '')), '');
    v_refund_payment_id := NULLIF(trim(COALESCE(v_refund_entity->>'payment_id', '')), '');
    IF jsonb_typeof(v_refund_entity->'amount') = 'number' THEN
      v_refund_amount_paise := (v_refund_entity->>'amount')::BIGINT;
    END IF;

    IF v_refund_id IS NOT NULL THEN
      v_next_refund_status := CASE
        WHEN p_event_type = 'refund.processed' THEN 'processed'
        WHEN p_event_type = 'refund.failed' THEN 'failed'
        ELSE 'pending'
      END;

      SELECT id, amount_paise INTO v_stored_refund
      FROM public.payment_refunds
      WHERE provider_refund_id = v_refund_id
      FOR UPDATE;

      v_amount_matches := (
        NOT FOUND
        OR v_refund_amount_paise IS NULL
        OR v_refund_amount_paise = v_stored_refund.amount_paise
      );

      UPDATE public.payment_refunds
      SET
        status = CASE WHEN v_amount_matches THEN v_next_refund_status ELSE 'reconciliation_required' END,
        reconciliation_status = CASE WHEN v_amount_matches THEN 'matched' ELSE 'provider_db_mismatch' END,
        updated_at = v_now
      WHERE provider_refund_id = v_refund_id;

      IF v_amount_matches AND p_event_type = 'refund.processed' AND v_refund_payment_id IS NOT NULL THEN
        SELECT id, amount_paise INTO v_parent_order
        FROM public.payment_orders
        WHERE provider_payment_id = v_refund_payment_id
        FOR UPDATE;

        IF FOUND THEN
          SELECT COALESCE(SUM(amount_paise), 0) INTO v_processed_refund_sum
          FROM public.payment_refunds
          WHERE payment_order_id = v_parent_order.id
            AND status = 'processed';

          v_reconciled_order_status := CASE
            WHEN v_processed_refund_sum >= v_parent_order.amount_paise THEN 'refunded'
            WHEN v_processed_refund_sum > 0 THEN 'partially_refunded'
            ELSE 'captured'
          END;

          UPDATE public.payment_orders
          SET status = v_reconciled_order_status, updated_at = v_now
          WHERE id = v_parent_order.id;
        END IF;
      END IF;
    END IF;
  END IF;

  UPDATE public.payment_webhook_events
  SET
    processing_status = 'processed',
    processed_at = v_now,
    updated_at = v_now,
    last_error = NULL
  WHERE provider = p_provider AND event_id = p_event_id;

  RETURN jsonb_build_object(
    'status', 'processed',
    'eventId', p_event_id,
    'reclaimedStale', v_reclaimed_stale
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_payment_webhook(TEXT, TEXT, TEXT, JSONB, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_payment_webhook(TEXT, TEXT, TEXT, JSONB, INTEGER) TO service_role;
