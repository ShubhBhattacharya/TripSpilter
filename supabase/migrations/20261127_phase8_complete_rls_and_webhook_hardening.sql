-- ==============================================================================
-- TripSplit 🇮🇳 — Phase 8 Complete Least-Privilege RLS & Invitation Hardening
-- Migration: 20261127_phase8_complete_rls_and_webhook_hardening.sql
-- Purely additive/remediative, idempotent SQL migration (zero data loss)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CRITICAL RLS FIX: Prevent Self-Escalation on trip_members via Invitation Bypass
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Trip creators or admins can add members" ON public.trip_members;
CREATE POLICY "Trip creators admins or email-matched invitees can add members"
  ON public.trip_members FOR INSERT
  TO authenticated
  WITH CHECK (
    is_trip_admin(trip_id)
    OR (
      user_id = auth.uid()
      AND role = 'member'
      AND EXISTS (
        SELECT 1 FROM public.trip_invitations inv
        WHERE inv.trip_id = trip_members.trip_id
          AND inv.status = 'pending'
          AND inv.expires_at > now()
          AND inv.email IS NOT NULL
          AND lower(inv.email) = lower(COALESCE(auth.jwt()->>'email', ''))
      )
    )
  );

DROP POLICY IF EXISTS "Trip members view members" ON public.trip_members;
CREATE POLICY "Trip members view members"
  ON public.trip_members FOR SELECT
  TO authenticated
  USING (is_trip_member(trip_id) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Admins or self can remove membership" ON public.trip_members;
CREATE POLICY "Admins or self can remove membership"
  ON public.trip_members FOR DELETE
  TO authenticated
  USING (is_trip_admin(trip_id) OR user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 2. Complete Missing RLS Policies Across Core Schema Tables
-- ------------------------------------------------------------------------------

-- Profiles: Users read co-member or own profile; modify strictly own profile
DROP POLICY IF EXISTS "Users view own or co-member profiles" ON public.profiles;
CREATE POLICY "Users view own or co-member profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.trip_members me
      JOIN public.trip_members them ON them.trip_id = me.trip_id
      WHERE me.user_id = auth.uid() AND them.user_id = profiles.id
    )
  );

DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Trips: Read member/created trips; create self; admin update/delete
DROP POLICY IF EXISTS "Members view trips" ON public.trips;
CREATE POLICY "Members view trips"
  ON public.trips FOR SELECT
  TO authenticated
  USING (is_trip_member(id) OR created_by = auth.uid());

DROP POLICY IF EXISTS "Users create own trips" ON public.trips;
CREATE POLICY "Users create own trips"
  ON public.trips FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Trip admins update trips" ON public.trips;
CREATE POLICY "Trip admins update trips"
  ON public.trips FOR UPDATE
  TO authenticated
  USING (is_trip_admin(id))
  WITH CHECK (is_trip_admin(id));

DROP POLICY IF EXISTS "Trip admins delete trips" ON public.trips;
CREATE POLICY "Trip admins delete trips"
  ON public.trips FOR DELETE
  TO authenticated
  USING (is_trip_admin(id));

-- Trip Invitations: Admins manage invites; invited user can read own email invite
DROP POLICY IF EXISTS "Members or invitees view trip invitations" ON public.trip_invitations;
CREATE POLICY "Members or invitees view trip invitations"
  ON public.trip_invitations FOR SELECT
  TO authenticated
  USING (
    is_trip_admin(trip_id)
    OR (email IS NOT NULL AND lower(email) = lower(COALESCE(auth.jwt()->>'email', '')))
  );

DROP POLICY IF EXISTS "Trip admins create invitations" ON public.trip_invitations;
CREATE POLICY "Trip admins create invitations"
  ON public.trip_invitations FOR INSERT
  TO authenticated
  WITH CHECK (is_trip_admin(trip_id) AND invited_by = auth.uid());

DROP POLICY IF EXISTS "Trip admins update invitations" ON public.trip_invitations;
CREATE POLICY "Trip admins update invitations"
  ON public.trip_invitations FOR UPDATE
  TO authenticated
  USING (is_trip_admin(trip_id))
  WITH CHECK (is_trip_admin(trip_id));

-- Expenses & Expense Splits: Full trip-scoped RLS
DROP POLICY IF EXISTS "Trip members view expenses" ON public.expenses;
CREATE POLICY "Trip members view expenses"
  ON public.expenses FOR SELECT
  TO authenticated
  USING (is_trip_member(trip_id));

DROP POLICY IF EXISTS "Payer or admin updates expenses" ON public.expenses;
CREATE POLICY "Payer or admin updates expenses"
  ON public.expenses FOR UPDATE
  TO authenticated
  USING (paid_by = auth.uid() OR is_trip_admin(trip_id))
  WITH CHECK (paid_by = auth.uid() OR is_trip_admin(trip_id));

DROP POLICY IF EXISTS "Payer or admin deletes expenses" ON public.expenses;
CREATE POLICY "Payer or admin deletes expenses"
  ON public.expenses FOR DELETE
  TO authenticated
  USING (paid_by = auth.uid() OR is_trip_admin(trip_id));

DROP POLICY IF EXISTS "Trip members view expense splits" ON public.expense_splits;
CREATE POLICY "Trip members view expense splits"
  ON public.expense_splits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_splits.expense_id AND is_trip_member(e.trip_id)
    )
  );

DROP POLICY IF EXISTS "Payer or admin inserts expense splits" ON public.expense_splits;
CREATE POLICY "Payer or admin inserts expense splits"
  ON public.expense_splits FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_splits.expense_id AND (e.paid_by = auth.uid() OR is_trip_admin(e.trip_id))
    )
  );

-- Vendor Splits & Members
DROP POLICY IF EXISTS "Trip members access vendor splits" ON public.vendor_splits;
CREATE POLICY "Trip members access vendor splits"
  ON public.vendor_splits FOR ALL
  TO authenticated
  USING (is_trip_member(trip_id))
  WITH CHECK (is_trip_member(trip_id));

DROP POLICY IF EXISTS "Trip members view vendor split members" ON public.vendor_split_members;
CREATE POLICY "Trip members view vendor split members"
  ON public.vendor_split_members FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vendor_splits vs
      WHERE vs.id = vendor_split_members.vendor_split_id AND is_trip_member(vs.trip_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vendor_splits vs
      WHERE vs.id = vendor_split_members.vendor_split_id AND is_trip_member(vs.trip_id)
    )
  );

-- Settlements SELECT & INSERT
DROP POLICY IF EXISTS "Trip members view settlements" ON public.settlements;
CREATE POLICY "Trip members view settlements"
  ON public.settlements FOR SELECT
  TO authenticated
  USING (is_trip_member(trip_id));

DROP POLICY IF EXISTS "Trip members create own settlements" ON public.settlements;
CREATE POLICY "Trip members create own settlements"
  ON public.settlements FOR INSERT
  TO authenticated
  WITH CHECK (is_trip_member(trip_id) AND (from_user_id = auth.uid() OR to_user_id = auth.uid()));

-- Itinerary Items, Polls, Poll Options, Poll Votes, Activity Logs
DROP POLICY IF EXISTS "Trip members manage itinerary" ON public.itinerary_items;
CREATE POLICY "Trip members manage itinerary"
  ON public.itinerary_items FOR ALL
  TO authenticated
  USING (is_trip_member(trip_id))
  WITH CHECK (is_trip_member(trip_id));

DROP POLICY IF EXISTS "Trip members view and create polls" ON public.polls;
CREATE POLICY "Trip members view and create polls"
  ON public.polls FOR SELECT
  TO authenticated
  USING (is_trip_member(trip_id));

DROP POLICY IF EXISTS "Trip members insert polls" ON public.polls;
CREATE POLICY "Trip members insert polls"
  ON public.polls FOR INSERT
  TO authenticated
  WITH CHECK (is_trip_member(trip_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS "Trip members view poll options" ON public.poll_options;
CREATE POLICY "Trip members view poll options"
  ON public.poll_options FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_options.poll_id AND is_trip_member(p.trip_id))
  );

DROP POLICY IF EXISTS "Poll creators insert options" ON public.poll_options;
CREATE POLICY "Poll creators insert options"
  ON public.poll_options FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_options.poll_id AND (p.created_by = auth.uid() OR is_trip_admin(p.trip_id)))
  );

DROP POLICY IF EXISTS "Trip members manage own poll votes" ON public.poll_votes;
CREATE POLICY "Trip members manage own poll votes"
  ON public.poll_votes FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_votes.poll_id AND is_trip_member(p.trip_id))
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_votes.poll_id AND is_trip_member(p.trip_id))
  );

DROP POLICY IF EXISTS "Trip members view activity logs" ON public.activity_logs;
CREATE POLICY "Trip members view activity logs"
  ON public.activity_logs FOR SELECT
  TO authenticated
  USING (is_trip_member(trip_id));

DROP POLICY IF EXISTS "Trip members insert own activity logs" ON public.activity_logs;
CREATE POLICY "Trip members insert own activity logs"
  ON public.activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (is_trip_member(trip_id) AND user_id = auth.uid());

-- Bookings: Strict client protection — clients can ONLY create/update Draft/Pending confirmation/Cancelled/Refund pending
-- Supplier-confirmed and Refunded states are restricted to trusted server webhooks (service_role)
DROP POLICY IF EXISTS "Trip members view bookings" ON public.bookings;
CREATE POLICY "Trip members view bookings"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (is_trip_member(trip_id) OR booked_by = auth.uid());

DROP POLICY IF EXISTS "Trip members insert draft bookings" ON public.bookings;
CREATE POLICY "Trip members insert draft bookings"
  ON public.bookings FOR INSERT
  TO authenticated
  WITH CHECK (
    is_trip_member(trip_id)
    AND booked_by = auth.uid()
    AND status IN ('Draft', 'Pending confirmation')
    AND COALESCE(provider_status, 'DRAFT') <> 'PROVIDER_CONFIRMED'
  );

DROP POLICY IF EXISTS "Booking owners update non-supplier statuses" ON public.bookings;
CREATE POLICY "Booking owners update non-supplier statuses"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (booked_by = auth.uid() OR is_trip_admin(trip_id))
  WITH CHECK (
    (booked_by = auth.uid() OR is_trip_admin(trip_id))
    AND status IN ('Draft', 'Pending confirmation', 'Cancelled', 'Refund pending')
    AND COALESCE(provider_status, 'DRAFT') <> 'PROVIDER_CONFIRMED'
  );

-- ------------------------------------------------------------------------------
-- 3. Safe Atomic Trip Invitation Redemption RPC
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

  INSERT INTO public.trip_members (trip_id, user_id, role)
  VALUES (v_inv.trip_id, v_user_id, CASE WHEN v_inv.role = 'admin' THEN 'admin' ELSE 'member' END)
  ON CONFLICT (trip_id, user_id) DO NOTHING;

  IF v_inv.email IS NOT NULL THEN
    UPDATE public.trip_invitations SET status = 'accepted' WHERE id = v_inv.id;
  END IF;

  RETURN jsonb_build_object(
    'joined', true,
    'tripId', v_inv.trip_id,
    'role', v_inv.role
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_trip_invitation(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_trip_invitation(TEXT) TO authenticated;
