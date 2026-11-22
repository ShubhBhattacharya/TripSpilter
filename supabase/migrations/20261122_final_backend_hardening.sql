-- ==============================================================================
-- TripSplit 🇮🇳 — Phase 2: Final Backend Hardening, RLS & Idempotency Migration
-- Migration: 20261122_final_backend_hardening.sql
-- Repeatable, Non-Destructive SQL Migration for Staging/Production Review
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Idempotency Keys Table for Persistent Deduplication
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  key TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  request_hash TEXT,
  response_status INTEGER NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, endpoint, key)
);

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own idempotency keys" ON public.idempotency_keys;
CREATE POLICY "Users can manage their own idempotency keys"
  ON public.idempotency_keys FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_idempotency_lookup 
  ON public.idempotency_keys(user_id, endpoint, key);

-- ------------------------------------------------------------------------------
-- 2. Complete Missing RLS Policies Across All 16 Core Tables
-- ------------------------------------------------------------------------------

-- Bookings Vault: Missing DELETE policy
DROP POLICY IF EXISTS "Trip members or creator can delete bookings" ON public.bookings;
CREATE POLICY "Trip members or creator can delete bookings"
  ON public.bookings FOR DELETE
  TO authenticated
  USING (is_trip_member(trip_id) OR booked_by = auth.uid());

-- Trip Invitations: Missing DELETE policy
DROP POLICY IF EXISTS "Trip admins can delete invitations" ON public.trip_invitations;
CREATE POLICY "Trip admins can delete invitations"
  ON public.trip_invitations FOR DELETE
  TO authenticated
  USING (is_trip_admin(trip_id));

-- Polls: Missing DELETE policy
DROP POLICY IF EXISTS "Poll creator or trip admin can delete polls" ON public.polls;
CREATE POLICY "Poll creator or trip admin can delete polls"
  ON public.polls FOR DELETE
  TO authenticated
  USING (created_by = auth.uid() OR is_trip_admin(trip_id));

-- Poll Options: Missing UPDATE and DELETE policies
DROP POLICY IF EXISTS "Poll creator or admin can update options" ON public.poll_options;
CREATE POLICY "Poll creator or admin can update options"
  ON public.poll_options FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.polls
      WHERE id = poll_options.poll_id AND (created_by = auth.uid() OR is_trip_admin(trip_id))
    )
  );

DROP POLICY IF EXISTS "Poll creator or admin can delete options" ON public.poll_options;
CREATE POLICY "Poll creator or admin can delete options"
  ON public.poll_options FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.polls
      WHERE id = poll_options.poll_id AND (created_by = auth.uid() OR is_trip_admin(trip_id))
    )
  );

-- Notifications: Missing DELETE policy
DROP POLICY IF EXISTS "Users can delete their notifications" ON public.notifications;
CREATE POLICY "Users can delete their notifications"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Activity Logs: Missing DELETE policy (Only trip admins can purge audit records)
DROP POLICY IF EXISTS "Trip admins can purge activity logs" ON public.activity_logs;
CREATE POLICY "Trip admins can purge activity logs"
  ON public.activity_logs FOR DELETE
  TO authenticated
  USING (is_trip_admin(trip_id));

-- ------------------------------------------------------------------------------
-- 3. Atomic Transactional RPC for Expense & Split Creation
-- ------------------------------------------------------------------------------
-- Ensures atomic insertion within a single database transaction.
-- If split insertion fails, the entire transaction rolls back automatically.
-- Zero orphaned expenses.
CREATE OR REPLACE FUNCTION public.create_expense_with_splits(
  p_trip_id UUID,
  p_vendor_name TEXT,
  p_vendor_upi_id TEXT,
  p_total_amount NUMERIC,
  p_total_amount_paise BIGINT,
  p_split_type TEXT,
  p_notes TEXT,
  p_splits JSONB, -- Array of objects: [{"userId": "uuid", "amountOwed": 100, "amountOwedPaise": 10000}]
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_expense_id UUID;
  v_split_sum_paise BIGINT := 0;
  v_split RECORD;
  v_cached_response JSONB;
  v_result JSONB;
BEGIN
  -- 1. Authentication check
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  -- 2. Idempotency Check: return cached response if key already exists
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    SELECT response_body INTO v_cached_response
    FROM public.idempotency_keys
    WHERE user_id = v_user_id
      AND endpoint = 'POST /api/expenses'
      AND key = p_idempotency_key;

    IF v_cached_response IS NOT NULL THEN
      RETURN jsonb_build_object(
        'isIdempotentReplay', true,
        'expense', v_cached_response->'expense',
        'splits', v_cached_response->'splits'
      );
    END IF;
  END IF;

  -- 3. Authorization Check: caller must be an active member of this trip
  IF NOT EXISTS (
    SELECT 1 FROM public.trip_members
    WHERE trip_id = p_trip_id AND user_id = v_user_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.trips
    WHERE id = p_trip_id AND created_by = v_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied: You are not a member of this trip' USING ERRCODE = '42501';
  END IF;

  -- 4. Financial Integrity Validation
  IF p_total_amount_paise <= 0 THEN
    RAISE EXCEPTION 'Total amount must be greater than zero' USING ERRCODE = '22003';
  END IF;

  -- Calculate total sum of member shares in paise
  FOR v_split IN SELECT * FROM jsonb_to_recordset(p_splits) AS x("userId" UUID, "amountOwed" NUMERIC, "amountOwedPaise" BIGINT)
  LOOP
    IF v_split."amountOwedPaise" < 0 THEN
      RAISE EXCEPTION 'Member share cannot be negative' USING ERRCODE = '22003';
    END IF;

    -- Verify that every participating member is an active member of this trip
    IF NOT EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_id = p_trip_id AND user_id = v_split."userId"
    ) THEN
      RAISE EXCEPTION 'Member % is not part of this trip', v_split."userId" USING ERRCODE = '23503';
    END IF;

    v_split_sum_paise := v_split_sum_paise + v_split."amountOwedPaise";
  END LOOP;

  -- Enforce zero-tolerance exact equality
  IF v_split_sum_paise <> p_total_amount_paise THEN
    RAISE EXCEPTION 'Sum of member shares (paise: %) does not equal bill total (paise: %)',
      v_split_sum_paise, p_total_amount_paise USING ERRCODE = '22000';
  END IF;

  -- 5. Insert main expense record
  INSERT INTO public.expenses (
    trip_id,
    paid_by,
    vendor_name,
    vendor_upi_id,
    total_amount,
    total_amount_paise,
    split_type,
    notes
  )
  VALUES (
    p_trip_id,
    v_user_id,
    p_vendor_name,
    p_vendor_upi_id,
    p_total_amount,
    p_total_amount_paise,
    p_split_type,
    p_notes
  )
  RETURNING id INTO v_expense_id;

  -- 6. Insert all member splits atomically
  INSERT INTO public.expense_splits (
    expense_id,
    user_id,
    amount_owed,
    amount_owed_paise,
    status,
    paid_at
  )
  SELECT
    v_expense_id,
    (s->>'userId')::UUID,
    (s->>'amountOwed')::NUMERIC,
    (s->>'amountOwedPaise')::BIGINT,
    CASE WHEN (s->>'userId')::UUID = v_user_id THEN 'verified_paid' ELSE 'pending' END,
    CASE WHEN (s->>'userId')::UUID = v_user_id THEN timezone('utc'::text, now()) ELSE NULL END
  FROM jsonb_array_elements(p_splits) AS s;

  -- 7. Build result payload
  SELECT jsonb_build_object(
    'isIdempotentReplay', false,
    'expense', (SELECT row_to_json(e) FROM public.expenses e WHERE e.id = v_expense_id),
    'splits', (SELECT json_agg(row_to_json(sp)) FROM public.expense_splits sp WHERE sp.expense_id = v_expense_id)
  ) INTO v_result;

  -- 8. Persist Idempotency Record if key was provided
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    INSERT INTO public.idempotency_keys (
      user_id,
      endpoint,
      key,
      response_status,
      response_body
    )
    VALUES (
      v_user_id,
      'POST /api/expenses',
      p_idempotency_key,
      201,
      v_result
    )
    ON CONFLICT (user_id, endpoint, key) DO NOTHING;
  END IF;

  RETURN v_result;
END;
$$;