-- ==============================================================================
-- TripSplit — Phase 5A: Critical Migration Defect Remediation & Hardening
-- Migration: 20261128000003_auth_triggers_and_fk_safety.sql
-- Purely additive/remediative, idempotent SQL migration (safe before staging push)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- F-01: Harden Auth & Trip Trigger Functions and Attach Missing Triggers
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, display_name, avatar_url)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    COALESCE(
      NULLIF(trim(COALESCE(new.raw_user_meta_data->>'full_name', '')), ''),
      NULLIF(split_part(COALESCE(new.email, ''), '@', 1), ''),
      'Traveler'
    ),
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    updated_at = timezone('utc'::text, now());
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_trip_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_trip_created ON public.trips;
CREATE TRIGGER on_trip_created
  AFTER INSERT ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_trip_creator();

-- ------------------------------------------------------------------------------
-- F-02: Resolve Contradictory ON DELETE SET NULL + NOT NULL on expenses.paid_by
--       (Ownership INSERT RLS `paid_by = auth.uid()` still rejects NULL writes)
-- ------------------------------------------------------------------------------
ALTER TABLE public.expenses ALTER COLUMN paid_by DROP NOT NULL;

-- ------------------------------------------------------------------------------
-- F-03: Enforce `search_path = public, pg_temp` and Trigger Function Grants
--       Note: Supabase-managed `public.rls_auto_enable()` is intentionally untouched.
-- ------------------------------------------------------------------------------
ALTER FUNCTION public.is_trip_member(UUID) SET search_path = public, pg_temp;
ALTER FUNCTION public.is_trip_admin(UUID) SET search_path = public, pg_temp;
ALTER FUNCTION public.create_expense_with_splits(UUID, TEXT, TEXT, NUMERIC, BIGINT, TEXT, TEXT, JSONB, TEXT)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.dispatch_trip_notification(UUID, UUID[], TEXT, TEXT, TEXT, TEXT, JSONB)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.update_expense_with_splits(UUID, TEXT, TEXT, NUMERIC, BIGINT, TEXT, TEXT, JSONB)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.reserve_payment_refund(UUID, BIGINT, TEXT, TEXT)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.prevent_expense_splits_immutable_update()
  SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_trip_creator() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_last_trip_admin_loss() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_expense_splits_immutable_update() FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- F-04: Block Debtor / Client Modification of Immutable Settlement Columns
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_settlements_immutable_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.trip_id IS DISTINCT FROM OLD.trip_id
     OR NEW.from_user_id IS DISTINCT FROM OLD.from_user_id
     OR NEW.to_user_id IS DISTINCT FROM OLD.to_user_id
     OR NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.amount_paise IS DISTINCT FROM OLD.amount_paise
  THEN
    RAISE EXCEPTION 'Immutable columns (trip_id, from_user_id, to_user_id, amount, amount_paise) on settlements cannot be modified'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_settlements_immutable_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_settlements_immutable_columns ON public.settlements;
CREATE TRIGGER trg_settlements_immutable_columns
  BEFORE UPDATE ON public.settlements
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_settlements_immutable_update();

-- ------------------------------------------------------------------------------
-- F-05: Justified Missing Foreign-Key Index for Trip Ownership & RLS Lookups
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_trips_created_by ON public.trips(created_by);
