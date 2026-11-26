-- ==============================================================================
-- TripSplit 🇮🇳 — Phase 2–12: Market-Readiness Database Hardening Migration
-- Migration: 20261126_market_readiness_hardening.sql
-- Purely additive, idempotent SQL migration (preserves all existing user data)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Extend Bookings Lifecycle States & Refund/Cancellation Metadata
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_constraint TEXT;
BEGIN
  -- Add lifecycle tracking columns if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'cancelled_at'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN cancelled_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'refund_amount_paise'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN refund_amount_paise BIGINT NOT NULL DEFAULT 0 CHECK (refund_amount_paise >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'supplier_payload'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN supplier_payload JSONB DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;
  END IF;

  -- Drop older narrow status check constraints if present and replace with complete lifecycle set
  FOR v_constraint IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass AND contype = 'c'
      AND (pg_get_constraintdef(oid) LIKE '%status%' OR conname LIKE '%status%')
  LOOP
    EXECUTE format('ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS %I', v_constraint);
  END LOOP;
END $$;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS chk_bookings_lifecycle_status;

ALTER TABLE public.bookings
  ADD CONSTRAINT chk_bookings_lifecycle_status CHECK (
    status IN (
      'Draft',
      'Pending confirmation',
      'Confirmed by supplier',
      'Failed',
      'Cancelled',
      'Refund pending',
      'Refunded',
      'Confirmed',
      'Pending Split',
      'Settled'
    )
  );

-- ------------------------------------------------------------------------------
-- 2. Payment Refunds Table & Order Refund Tracking
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_refunds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_order_id UUID REFERENCES public.payment_orders(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'razorpay',
  provider_refund_id TEXT UNIQUE,
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processed', 'failed', 'waiting_for_credentials')
  ),
  reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.payment_refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own or trip refunds" ON public.payment_refunds;
CREATE POLICY "Users view own or trip refunds"
  ON public.payment_refunds FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR (trip_id IS NOT NULL AND is_trip_member(trip_id)));

DROP POLICY IF EXISTS "Users request own refunds" ON public.payment_refunds;
CREATE POLICY "Users request own refunds"
  ON public.payment_refunds FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_payment_refunds_order ON public.payment_refunds(payment_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_user ON public.payment_refunds(user_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 3. Notifications Enhancements (Types, Metadata, Delete & Co-Member Dispatch RPC)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'type'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN type TEXT NOT NULL DEFAULT 'system';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view their notifications" ON public.notifications;
CREATE POLICY "Users can view their notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their notifications" ON public.notifications;
CREATE POLICY "Users can update their notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their notifications" ON public.notifications;
CREATE POLICY "Users can delete their notifications"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Safe RPC for dispatching notifications to verified members of the same trip
CREATE OR REPLACE FUNCTION public.dispatch_trip_notification(
  p_trip_id UUID,
  p_recipient_ids UUID[],
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'system',
  p_link TEXT DEFAULT '/notifications',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_count INTEGER := 0;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF p_trip_id IS NOT NULL AND NOT public.is_trip_member(p_trip_id) THEN
    RAISE EXCEPTION 'Forbidden: caller is not a member of trip %', p_trip_id USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, link, metadata, read)
  SELECT DISTINCT
    tm.user_id,
    left(p_title, 140),
    left(p_message, 500),
    COALESCE(NULLIF(p_type, ''), 'system'),
    COALESCE(NULLIF(p_link, ''), '/notifications'),
    COALESCE(p_metadata, '{}'::jsonb),
    false
  FROM public.trip_members tm
  WHERE (p_trip_id IS NULL OR tm.trip_id = p_trip_id)
    AND tm.user_id = ANY(p_recipient_ids);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. AI Usage, Token & Cost Telemetry Log Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0 CHECK (prompt_tokens >= 0),
  completion_tokens INTEGER NOT NULL DEFAULT 0 CHECK (completion_tokens >= 0),
  estimated_cost_inr NUMERIC(10,4) NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0 CHECK (latency_ms >= 0),
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'fallback', 'timeout', 'error')),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own AI usage logs" ON public.ai_usage_logs;
CREATE POLICY "Users view own AI usage logs"
  ON public.ai_usage_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users insert own AI usage logs" ON public.ai_usage_logs;
CREATE POLICY "Users insert own AI usage logs"
  ON public.ai_usage_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_created ON public.ai_usage_logs(user_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 5. Atomic Expense Update RPC (Integer Paise Equality Enforced)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_expense_with_splits(
  p_expense_id UUID,
  p_vendor_name TEXT,
  p_vendor_upi_id TEXT,
  p_total_amount NUMERIC,
  p_total_amount_paise BIGINT,
  p_split_type TEXT,
  p_notes TEXT,
  p_splits JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_expense RECORD;
  v_split RECORD;
  v_split_sum_paise BIGINT := 0;
  v_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_expense FROM public.expenses WHERE id = p_expense_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_expense.paid_by <> v_user_id AND NOT public.is_trip_admin(v_expense.trip_id) THEN
    RAISE EXCEPTION 'Only payer or trip admin may edit this expense' USING ERRCODE = '42501';
  END IF;

  IF p_total_amount_paise IS NULL OR p_total_amount_paise <= 0 THEN
    RAISE EXCEPTION 'Expense total must be greater than zero' USING ERRCODE = '22003';
  END IF;

  FOR v_split IN
    SELECT * FROM jsonb_to_recordset(p_splits) AS x("userId" UUID, "amountOwed" NUMERIC, "amountOwedPaise" BIGINT)
  LOOP
    IF v_split."amountOwedPaise" IS NULL OR v_split."amountOwedPaise" < 0 THEN
      RAISE EXCEPTION 'Split amount cannot be negative' USING ERRCODE = '22003';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_id = v_expense.trip_id AND user_id = v_split."userId"
    ) THEN
      RAISE EXCEPTION 'Member % is not part of trip', v_split."userId" USING ERRCODE = '23503';
    END IF;
    v_split_sum_paise := v_split_sum_paise + v_split."amountOwedPaise";
  END LOOP;

  IF v_split_sum_paise <> p_total_amount_paise THEN
    RAISE EXCEPTION 'Sum of edited shares (paise: %) does not equal total (paise: %)',
      v_split_sum_paise, p_total_amount_paise USING ERRCODE = '22000';
  END IF;

  UPDATE public.expenses
  SET
    vendor_name = COALESCE(NULLIF(p_vendor_name, ''), vendor_name),
    vendor_upi_id = COALESCE(NULLIF(p_vendor_upi_id, ''), vendor_upi_id),
    total_amount = p_total_amount,
    total_amount_paise = p_total_amount_paise,
    split_type = COALESCE(NULLIF(p_split_type, ''), split_type),
    notes = p_notes
  WHERE id = p_expense_id;

  DELETE FROM public.expense_splits WHERE expense_id = p_expense_id;

  INSERT INTO public.expense_splits (
    expense_id, user_id, amount_owed, amount_owed_paise, status, paid_at
  )
  SELECT
    p_expense_id,
    (s->>'userId')::UUID,
    (s->>'amountOwed')::NUMERIC,
    (s->>'amountOwedPaise')::BIGINT,
    CASE WHEN (s->>'userId')::UUID = v_expense.paid_by THEN 'verified_paid' ELSE 'pending' END,
    CASE WHEN (s->>'userId')::UUID = v_expense.paid_by THEN timezone('utc'::text, now()) ELSE NULL END
  FROM jsonb_array_elements(p_splits) AS s;

  SELECT jsonb_build_object(
    'expense', (SELECT row_to_json(e) FROM public.expenses e WHERE e.id = p_expense_id),
    'splits', (SELECT json_agg(row_to_json(sp)) FROM public.expense_splits sp WHERE sp.expense_id = p_expense_id)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
