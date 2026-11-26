-- ==============================================================================
-- TripSplit 🇮🇳 — 95% Market-Readiness Final Database & Financial Hardening
-- Migration: 20261126_95_market_readiness_final.sql
-- Purely additive, idempotent SQL migration (zero destructive changes)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Payment Orders & Refunds: Cumulative Validation, Idempotency & Reconciliation
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_chk TEXT;
BEGIN
  FOR v_chk IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.payment_orders'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.payment_orders DROP CONSTRAINT IF EXISTS %I', v_chk);
  END LOOP;
END $$;

ALTER TABLE public.payment_orders
  DROP CONSTRAINT IF EXISTS chk_payment_orders_status_v2;

ALTER TABLE public.payment_orders
  ADD CONSTRAINT chk_payment_orders_status_v2 CHECK (
    status IN ('created', 'pending', 'authorized', 'captured', 'partially_refunded', 'refunded', 'failed')
  );

DO $$
DECLARE
  v_rchk TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_refunds' AND column_name = 'idempotency_key'
  ) THEN
    ALTER TABLE public.payment_refunds ADD COLUMN idempotency_key TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_refunds' AND column_name = 'error_message'
  ) THEN
    ALTER TABLE public.payment_refunds ADD COLUMN error_message TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_refunds' AND column_name = 'reconciliation_status'
  ) THEN
    ALTER TABLE public.payment_refunds ADD COLUMN reconciliation_status TEXT NOT NULL DEFAULT 'not_applicable';
  END IF;

  FOR v_rchk IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.payment_refunds'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%reconciliation_status%'
  LOOP
    EXECUTE format('ALTER TABLE public.payment_refunds DROP CONSTRAINT IF EXISTS %I', v_rchk);
  END LOOP;

  FOR v_rchk IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.payment_refunds'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%'
      AND conname <> 'chk_payment_refunds_reconciliation_v2'
  LOOP
    EXECUTE format('ALTER TABLE public.payment_refunds DROP CONSTRAINT IF EXISTS %I', v_rchk);
  END LOOP;
END $$;

ALTER TABLE public.payment_refunds
  ADD CONSTRAINT chk_payment_refunds_status_v2 CHECK (
    status IN ('pending', 'processed', 'failed', 'waiting_for_credentials', 'reconciliation_required')
  );

ALTER TABLE public.payment_refunds
  ADD CONSTRAINT chk_payment_refunds_reconciliation_v2 CHECK (
    reconciliation_status IN ('not_applicable', 'matched', 'provider_db_mismatch')
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_refunds_order_idem
  ON public.payment_refunds(payment_order_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Atomic Row-Locked Refund Reservation RPC (Prevents concurrent double refunds)
CREATE OR REPLACE FUNCTION public.reserve_payment_refund(
  p_payment_order_id UUID,
  p_amount_paise BIGINT,
  p_reason TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_order RECORD;
  v_existing RECORD;
  v_reserved_paise BIGINT := 0;
  v_refund_id UUID;
  v_refund_row JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  -- Lock parent payment_order row to serialize concurrent refund requests
  SELECT * INTO v_order
  FROM public.payment_orders
  WHERE id = p_payment_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment order not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_order.user_id <> v_user_id THEN
    RAISE EXCEPTION 'Only original payer may request refund' USING ERRCODE = '42501';
  END IF;

  -- Idempotency replay check under lock
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    SELECT * INTO v_existing
    FROM public.payment_refunds
    WHERE payment_order_id = p_payment_order_id AND idempotency_key = p_idempotency_key
    LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'isIdempotentReplay', true,
        'refund', row_to_json(v_existing)
      );
    END IF;
  END IF;

  IF v_order.status NOT IN ('captured', 'partially_refunded') THEN
    RAISE EXCEPTION 'Order status % is not refundable', v_order.status USING ERRCODE = '22000';
  END IF;

  IF p_amount_paise IS NULL OR p_amount_paise <= 0 THEN
    RAISE EXCEPTION 'Refund amount must be positive' USING ERRCODE = '22003';
  END IF;

  -- Cumulative active refund sum check
  SELECT COALESCE(SUM(amount_paise), 0) INTO v_reserved_paise
  FROM public.payment_refunds
  WHERE payment_order_id = p_payment_order_id
    AND status IN ('pending', 'processed', 'reconciliation_required');

  IF (v_reserved_paise + p_amount_paise) > v_order.amount_paise THEN
    RAISE EXCEPTION 'Cumulative refunds (% paise) would exceed captured order amount (% paise)',
      (v_reserved_paise + p_amount_paise), v_order.amount_paise USING ERRCODE = '22003';
  END IF;

  INSERT INTO public.payment_refunds (
    payment_order_id,
    user_id,
    trip_id,
    provider,
    amount_paise,
    currency,
    status,
    reason,
    idempotency_key,
    reconciliation_status
  )
  VALUES (
    v_order.id,
    v_user_id,
    v_order.trip_id,
    v_order.provider,
    p_amount_paise,
    v_order.currency,
    'pending',
    left(COALESCE(p_reason, ''), 200),
    NULLIF(p_idempotency_key, ''),
    'not_applicable'
  )
  RETURNING id INTO v_refund_id;

  SELECT row_to_json(r)::jsonb INTO v_refund_row
  FROM public.payment_refunds r WHERE r.id = v_refund_id;

  RETURN jsonb_build_object(
    'isIdempotentReplay', false,
    'refund', v_refund_row,
    'remainingPaiseAfterReserve', (v_order.amount_paise - (v_reserved_paise + p_amount_paise))
  );
END;
$$;

-- Server Finalize Refund RPC (Reconciles pending row & parent order status safely)
CREATE OR REPLACE FUNCTION public.finalize_payment_refund(
  p_refund_id UUID,
  p_new_status TEXT,
  p_provider_refund_id TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_reconciliation_status TEXT DEFAULT 'matched'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_ref RECORD;
  v_order RECORD;
  v_processed_sum BIGINT := 0;
  v_next_order_status TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_ref FROM public.payment_refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Refund record not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_ref.user_id <> v_user_id THEN
    RAISE EXCEPTION 'Forbidden refund finalization' USING ERRCODE = '42501';
  END IF;

  UPDATE public.payment_refunds
  SET
    status = p_new_status,
    provider_refund_id = COALESCE(NULLIF(p_provider_refund_id, ''), provider_refund_id),
    error_message = p_error_message,
    reconciliation_status = p_reconciliation_status,
    updated_at = timezone('utc'::text, now())
  WHERE id = p_refund_id;

  IF p_new_status = 'processed' THEN
    SELECT * INTO v_order FROM public.payment_orders WHERE id = v_ref.payment_order_id FOR UPDATE;
    SELECT COALESCE(SUM(amount_paise), 0) INTO v_processed_sum
    FROM public.payment_refunds
    WHERE payment_order_id = v_ref.payment_order_id AND status = 'processed';

    v_next_order_status := CASE
      WHEN v_processed_sum >= v_order.amount_paise THEN 'refunded'
      WHEN v_processed_sum > 0 THEN 'partially_refunded'
      ELSE v_order.status
    END;

    UPDATE public.payment_orders
    SET status = v_next_order_status, updated_at = timezone('utc'::text, now())
    WHERE id = v_ref.payment_order_id;
  END IF;

  RETURN (SELECT row_to_json(r)::jsonb FROM public.payment_refunds r WHERE r.id = p_refund_id);
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. Booking Status History Audit Table & RLS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.booking_status_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'user_action' CHECK (
    source IN ('user_draft', 'user_action', 'redirect', 'provider_api', 'webhook')
  ),
  supplier_ref TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.booking_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Trip members view booking status history" ON public.booking_status_history;
CREATE POLICY "Trip members view booking status history"
  ON public.booking_status_history FOR SELECT
  TO authenticated
  USING (is_trip_member(trip_id));

DROP POLICY IF EXISTS "Trip members append booking history" ON public.booking_status_history;
CREATE POLICY "Trip members append booking history"
  ON public.booking_status_history FOR INSERT
  TO authenticated
  WITH CHECK (is_trip_member(trip_id) AND changed_by = auth.uid());

CREATE INDEX IF NOT EXISTS idx_booking_status_history_booking
  ON public.booking_status_history(booking_id, created_at ASC);

-- ------------------------------------------------------------------------------
-- 3. Restrict SECURITY DEFINER RPC Execution Permissions + Query Indexes
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  REVOKE ALL ON FUNCTION public.is_trip_member(UUID) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.is_trip_member(UUID) TO authenticated;

  REVOKE ALL ON FUNCTION public.is_trip_admin(UUID) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.is_trip_admin(UUID) TO authenticated;

  REVOKE ALL ON FUNCTION public.dispatch_trip_notification(UUID, UUID[], TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.dispatch_trip_notification(UUID, UUID[], TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;

  REVOKE ALL ON FUNCTION public.create_expense_with_splits(UUID, TEXT, TEXT, NUMERIC, BIGINT, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.create_expense_with_splits(UUID, TEXT, TEXT, NUMERIC, BIGINT, TEXT, TEXT, JSONB, TEXT) TO authenticated;

  REVOKE ALL ON FUNCTION public.update_expense_with_splits(UUID, TEXT, TEXT, NUMERIC, BIGINT, TEXT, TEXT, JSONB) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.update_expense_with_splits(UUID, TEXT, TEXT, NUMERIC, BIGINT, TEXT, TEXT, JSONB) TO authenticated;

  REVOKE ALL ON FUNCTION public.reserve_payment_refund(UUID, BIGINT, TEXT, TEXT) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.reserve_payment_refund(UUID, BIGINT, TEXT, TEXT) TO authenticated;

  REVOKE ALL ON FUNCTION public.finalize_payment_refund(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.finalize_payment_refund(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
EXCEPTION
  WHEN undefined_function THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_bookings_trip_created ON public.bookings(trip_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_orders_split ON public.payment_orders(split_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created ON public.notifications(user_id, read, created_at DESC);
