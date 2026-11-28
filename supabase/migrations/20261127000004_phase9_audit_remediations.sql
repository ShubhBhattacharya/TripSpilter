-- ==============================================================================
-- TripSplit 🇮🇳 — Phase 9 Audit Remediation Migration
-- Migration: 20261127_phase9_audit_remediations.sql
-- Purely additive/remediative, idempotent SQL migration (zero data loss)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Re-affirm trip_members UPDATE policy & block removing/demoting last admin
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can update member roles" ON public.trip_members;
CREATE POLICY "Admins can update member roles"
  ON public.trip_members FOR UPDATE
  TO authenticated
  USING (is_trip_admin(trip_id))
  WITH CHECK (is_trip_admin(trip_id));

CREATE OR REPLACE FUNCTION public.prevent_last_trip_admin_loss()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trip_exists BOOLEAN;
  v_admin_count INTEGER;
BEGIN
  -- Skip when the parent trip itself is being deleted (ON DELETE CASCADE)
  SELECT EXISTS (SELECT 1 FROM public.trips WHERE id = OLD.trip_id)
    INTO v_trip_exists;
  IF NOT v_trip_exists THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF OLD.role = 'admin' AND (TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.role <> 'admin')) THEN
    SELECT count(*) INTO v_admin_count
    FROM public.trip_members
    WHERE trip_id = OLD.trip_id
      AND role = 'admin';

    IF v_admin_count = 0 THEN
      RAISE EXCEPTION 'Cannot remove or demote the last remaining trip admin'
        USING ERRCODE = '22000';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_last_trip_admin_loss ON public.trip_members;
CREATE CONSTRAINT TRIGGER trg_prevent_last_trip_admin_loss
  AFTER UPDATE OR DELETE ON public.trip_members
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_last_trip_admin_loss();

-- ------------------------------------------------------------------------------
-- 2. Prevent clients from deleting supplier-confirmed or refunded bookings
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Trip members or creator can delete bookings" ON public.bookings;
CREATE POLICY "Owners or admins delete non-confirmed draft bookings"
  ON public.bookings FOR DELETE
  TO authenticated
  USING (
    (booked_by = auth.uid() OR is_trip_admin(trip_id))
    AND status IN ('Draft', 'Cancelled', 'Failed')
  );

-- ------------------------------------------------------------------------------
-- 3. Allow authenticated self-scoped fallback notification inserts under RLS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users insert own notifications" ON public.notifications;
CREATE POLICY "Users insert own notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 4. Update accept_trip_invitation to report alreadyMember cleanly
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_trip_invitation(p_invite_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_email TEXT := lower(COALESCE(auth.jwt()->>'email', ''));
  v_inv RECORD;
  v_already_member BOOLEAN := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_inv
  FROM public.trip_invitations
  WHERE upper(invite_code) = upper(trim(p_invite_code))
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid trip invite code' USING ERRCODE = 'P0002';
  END IF;

  IF v_inv.status <> 'pending' THEN
    RAISE EXCEPTION 'Invitation is no longer active (status: %)', v_inv.status USING ERRCODE = '22000';
  END IF;

  IF v_inv.expires_at <= now() THEN
    UPDATE public.trip_invitations SET status = 'expired' WHERE id = v_inv.id;
    RAISE EXCEPTION 'Trip invitation has expired' USING ERRCODE = '22000';
  END IF;

  IF v_inv.email IS NOT NULL AND v_user_email <> lower(v_inv.email) THEN
    RAISE EXCEPTION 'This invitation is restricted to another email address' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.trip_members
    WHERE trip_id = v_inv.trip_id AND user_id = v_user_id
  ) INTO v_already_member;

  IF NOT v_already_member THEN
    INSERT INTO public.trip_members (trip_id, user_id, role)
    VALUES (v_inv.trip_id, v_user_id, CASE WHEN v_inv.role = 'admin' THEN 'admin' ELSE 'member' END)
    ON CONFLICT (trip_id, user_id) DO NOTHING;
  END IF;

  IF v_inv.email IS NOT NULL THEN
    UPDATE public.trip_invitations SET status = 'accepted' WHERE id = v_inv.id;
  END IF;

  RETURN jsonb_build_object(
    'joined', true,
    'alreadyMember', v_already_member,
    'tripId', v_inv.trip_id,
    'role', v_inv.role
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_trip_invitation(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_trip_invitation(TEXT) TO authenticated;
