-- ==============================================================================
-- TripSplit 🇮🇳 — Day 7 Critical Refund Security & Webhook Hardening Migration
-- Migration: 20261127_day7_refund_webhook_hardening.sql
-- Purely additive/remediative, idempotent SQL migration (zero data loss)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Drop Unsafe Direct INSERT Policy on payment_refunds
--    Users must ONLY create pending refund rows through atomic reserve_payment_refund()
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users request own refunds" ON public.payment_refunds;

-- Confirm zero direct client mutation policies remain on payment_refunds
DROP POLICY IF EXISTS "Users update own refunds" ON public.payment_refunds;
DROP POLICY IF EXISTS "Users delete own refunds" ON public.payment_refunds;

-- ------------------------------------------------------------------------------
-- 2. Harden finalize_payment_refund() — Trusted service_role / Server ONLY
--    Prevents authenticated users from self-marking their refunds as 'processed'
-- ------------------------------------------------------------------------------
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
SET search_path = public, pg_temp
AS $$
DECLARE
  v_jwt_role TEXT := COALESCE(current_setting('request.jwt.claim.role', true), '');
  v_ref RECORD;
  v_order RECORD;
  v_processed_sum BIGINT := 0;
  v_next_order_status TEXT;
BEGIN
  -- Strict privilege gate: allow ONLY server-side service_role or postgres owner
  IF v_jwt_role <> 'service_role' AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Forbidden: refund finalization requires trusted service_role authority'
      USING ERRCODE = '42501';
  END IF;

  IF p_new_status NOT IN ('pending', 'processed', 'failed', 'waiting_for_credentials', 'reconciliation_required') THEN
    RAISE EXCEPTION 'Invalid target refund status: %', p_new_status USING ERRCODE = '22000';
  END IF;

  SELECT * INTO v_ref FROM public.payment_refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Refund record not found' USING ERRCODE = 'P0002';
  END IF;

  -- Enforce strict monotonic state transitions (never revert terminal processed/failed refunds)
  IF v_ref.status IN ('processed', 'failed', 'waiting_for_credentials') THEN
    IF v_ref.status = p_new_status THEN
      RETURN row_to_json(v_ref)::jsonb;
    END IF;
    RAISE EXCEPTION 'Terminal refund state "%" cannot transition to "%"',
      v_ref.status, p_new_status USING ERRCODE = '22000';
  END IF;

  IF p_new_status = 'processed' AND (p_provider_refund_id IS NULL OR length(trim(p_provider_refund_id)) < 4) THEN
    RAISE EXCEPTION 'Valid provider_refund_id is required before marking refund processed'
      USING ERRCODE = '22000';
  END IF;

  UPDATE public.payment_refunds
  SET
    status = p_new_status,
    provider_refund_id = COALESCE(NULLIF(trim(p_provider_refund_id), ''), provider_refund_id),
    error_message = p_error_message,
    reconciliation_status = p_reconciliation_status,
    updated_at = timezone('utc'::text, now())
  WHERE id = p_refund_id;

  IF p_new_status = 'processed' THEN
    SELECT * INTO v_order FROM public.payment_orders WHERE id = v_ref.payment_order_id FOR UPDATE;
    SELECT COALESCE(SUM(amount_paise), 0) INTO v_processed_sum
    FROM public.payment_refunds
    WHERE payment_order_id = v_ref.payment_order_id AND status = 'processed';

    IF v_processed_sum > v_order.amount_paise THEN
      RAISE EXCEPTION 'Processed refunds (% paise) exceed captured order amount (% paise)',
        v_processed_sum, v_order.amount_paise USING ERRCODE = '22003';
    END IF;

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

-- REVOKE EXECUTE from PUBLIC, anon AND authenticated — grant ONLY to service_role
REVOKE ALL ON FUNCTION public.finalize_payment_refund(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_payment_refund(UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- Also lock down search_path on reserve_payment_refund cleanly
ALTER FUNCTION public.reserve_payment_refund(UUID, BIGINT, TEXT, TEXT) SET search_path = public, pg_temp;

-- ------------------------------------------------------------------------------
-- 3. Add Webhook Retry & Processing Tracking Columns to Webhook Event Tables
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'booking_webhook_events' AND column_name = 'processing_status'
  ) THEN
    ALTER TABLE public.booking_webhook_events
      ADD COLUMN processing_status TEXT NOT NULL DEFAULT 'processed'
      CHECK (processing_status IN ('processing', 'processed', 'failed'));
    ALTER TABLE public.booking_webhook_events ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0);
    ALTER TABLE public.booking_webhook_events ADD COLUMN last_error TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_webhook_events' AND column_name = 'processing_status'
  ) THEN
    ALTER TABLE public.payment_webhook_events
      ADD COLUMN processing_status TEXT NOT NULL DEFAULT 'processed'
      CHECK (processing_status IN ('processing', 'processed', 'failed'));
    ALTER TABLE public.payment_webhook_events ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0);
    ALTER TABLE public.payment_webhook_events ADD COLUMN last_error TEXT;
  END IF;
END $$;
