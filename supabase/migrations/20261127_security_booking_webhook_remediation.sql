-- ==============================================================================
-- TripSplit 🇮🇳 — Security & Booking Webhook Remediation Migration
-- Migration: 20261127_security_booking_webhook_remediation.sql
-- Purely additive, idempotent SQL migration (zero destructive operations)
-- ==============================================================================

-- 1. Link bookings optionally to verified payment_orders for refund reconciliation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'payment_order_id'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN payment_order_id UUID REFERENCES public.payment_orders(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bookings_payment_order ON public.bookings(payment_order_id);

-- 2. Cryptographically Verified Supplier Booking Webhook Event Log (Server-Only)
CREATE TABLE IF NOT EXISTS public.booking_webhook_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  signature_verified BOOLEAN NOT NULL DEFAULT false,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(provider, event_id)
);

ALTER TABLE public.booking_webhook_events ENABLE ROW LEVEL SECURITY;

-- Server-only (service_role bypasses RLS); zero client policies by design

-- 3. Restrict direct client booking_status_history source values (users cannot claim webhook/provider_api source directly)
DO $$
BEGIN
  ALTER TABLE public.booking_status_history
    DROP CONSTRAINT IF EXISTS chk_booking_history_client_source;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

DROP POLICY IF EXISTS "Trip members append booking history" ON public.booking_status_history;
CREATE POLICY "Trip members append booking history"
  ON public.booking_status_history FOR INSERT
  TO authenticated
  WITH CHECK (
    is_trip_member(trip_id)
    AND changed_by = auth.uid()
    AND source IN ('user_draft', 'user_action', 'redirect')
  );
