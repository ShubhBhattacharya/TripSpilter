-- ==============================================================================
-- TripSplit 🇮🇳 — Phase 1: Security & Financial Integrity Hardening Migration
-- Migration: 20261122_security_hardening.sql
-- Repeatable, Non-Destructive SQL Migration for Staging/Production Review
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Security Definer Helper Functions with Hardened search_path
-- ------------------------------------------------------------------------------

-- Trip Member check helper
CREATE OR REPLACE FUNCTION public.is_trip_member(lookup_trip_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trip_members
    WHERE trip_id = lookup_trip_id AND user_id = auth.uid()
  );
$$;

-- Trip Admin check helper (checks both trip_members admin role and trips.created_by)
CREATE OR REPLACE FUNCTION public.is_trip_admin(lookup_trip_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trip_members
    WHERE trip_id = lookup_trip_id AND user_id = auth.uid() AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.trips
    WHERE id = lookup_trip_id AND created_by = auth.uid()
  );
$$;

-- Fix search_path on auth trigger functions to prevent path hijacking
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, display_name, avatar_url)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    updated_at = timezone('utc'::text, now());
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_trip_creator()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF new.created_by IS NOT NULL THEN
    INSERT INTO public.trip_members (trip_id, user_id, role)
    VALUES (new.id, new.created_by, 'admin')
    ON CONFLICT (trip_id, user_id) DO UPDATE SET
      role = 'admin';
  END IF;
  RETURN new;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. Financial Integrity Constraints (Integer Paise & Non-Negative Checks)
-- ------------------------------------------------------------------------------

-- Add total_amount_paise and constraint if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'expenses' AND column_name = 'total_amount_paise'
  ) THEN
    ALTER TABLE public.expenses ADD COLUMN total_amount_paise BIGINT NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'expense_splits' AND column_name = 'amount_owed_paise'
  ) THEN
    ALTER TABLE public.expense_splits ADD COLUMN amount_owed_paise BIGINT NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'settlements' AND column_name = 'amount_paise'
  ) THEN
    ALTER TABLE public.settlements ADD COLUMN amount_paise BIGINT NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Populate paise columns where they might be 0 from legacy records
UPDATE public.expenses 
SET total_amount_paise = ROUND(total_amount * 100) 
WHERE total_amount_paise = 0 AND total_amount > 0;

UPDATE public.expense_splits 
SET amount_owed_paise = ROUND(amount_owed * 100) 
WHERE amount_owed_paise = 0 AND amount_owed > 0;

UPDATE public.settlements 
SET amount_paise = ROUND(amount * 100) 
WHERE amount_paise = 0 AND amount > 0;

-- Enforce strictly positive amounts
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS check_expenses_positive_paise;
ALTER TABLE public.expenses ADD CONSTRAINT check_expenses_positive_paise 
  CHECK (total_amount_paise > 0);

ALTER TABLE public.expense_splits DROP CONSTRAINT IF EXISTS check_splits_non_negative_paise;
ALTER TABLE public.expense_splits ADD CONSTRAINT check_splits_non_negative_paise 
  CHECK (amount_owed_paise >= 0);

ALTER TABLE public.settlements DROP CONSTRAINT IF EXISTS check_settlements_positive_paise;
ALTER TABLE public.settlements ADD CONSTRAINT check_settlements_positive_paise 
  CHECK (amount_paise > 0);

-- ------------------------------------------------------------------------------
-- 3. Hardened Row Level Security (RLS) Policies
-- ------------------------------------------------------------------------------

-- Trip Members: Prevent unauthorized self-insertion and privilege escalation
DROP POLICY IF EXISTS "Trip creators or admins can add members" ON public.trip_members;
CREATE POLICY "Trip creators or admins can add members"
  ON public.trip_members FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Only trip admins, creators, or valid invitees can be added
    is_trip_admin(trip_id) OR
    EXISTS (
      SELECT 1 FROM public.trip_invitations
      WHERE trip_id = trip_members.trip_id
        AND status = 'pending'
        AND expires_at > now()
        AND (email = auth.jwt()->>'email' OR trip_members.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can update member roles" ON public.trip_members;
CREATE POLICY "Admins can update member roles"
  ON public.trip_members FOR UPDATE
  TO authenticated
  USING (is_trip_admin(trip_id))
  WITH CHECK (is_trip_admin(trip_id));

-- Expenses: Prevent forging other users as payers
DROP POLICY IF EXISTS "Trip members can insert expenses" ON public.expenses;
CREATE POLICY "Trip members can insert expenses"
  ON public.expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    is_trip_member(trip_id) AND paid_by = auth.uid()
  );

-- Expense Splits: Prevent debtors from self-verifying payments
DROP POLICY IF EXISTS "Users or payers can update expense splits" ON public.expense_splits;
CREATE POLICY "Debtors can initiate or report paid"
  ON public.expense_splits FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    -- Debtor can only change status to payment_initiated or manually_reported_paid
    user_id = auth.uid() AND
    status IN ('payment_initiated', 'manually_reported_paid', 'failed')
  );

DROP POLICY IF EXISTS "Creditors or admins can verify expense splits" ON public.expense_splits;
CREATE POLICY "Creditors or admins can verify expense splits"
  ON public.expense_splits FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expenses
      WHERE id = expense_splits.expense_id
        AND (paid_by = auth.uid() OR is_trip_admin(trip_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expenses
      WHERE id = expense_splits.expense_id
        AND (paid_by = auth.uid() OR is_trip_admin(trip_id))
    )
  );

-- Settlements: Prevent debtors from self-verifying settlements
DROP POLICY IF EXISTS "Parties can update settlement status" ON public.settlements;
CREATE POLICY "Debtors can report settlements paid"
  ON public.settlements FOR UPDATE
  TO authenticated
  USING (from_user_id = auth.uid())
  WITH CHECK (
    from_user_id = auth.uid() AND
    status IN ('payment_initiated', 'manually_reported_paid', 'failed')
  );

DROP POLICY IF EXISTS "Creditors or admins can verify settlements" ON public.settlements;
CREATE POLICY "Creditors or admins can verify settlements"
  ON public.settlements FOR UPDATE
  TO authenticated
  USING (to_user_id = auth.uid() OR is_trip_admin(trip_id))
  WITH CHECK (to_user_id = auth.uid() OR is_trip_admin(trip_id));

-- ------------------------------------------------------------------------------
-- 4. Audit & Query Indexes
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_expenses_created_recent 
  ON public.expenses(trip_id, paid_by, total_amount_paise, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_expense_splits_status 
  ON public.expense_splits(expense_id, status);

CREATE INDEX IF NOT EXISTS idx_settlements_status 
  ON public.settlements(trip_id, status);