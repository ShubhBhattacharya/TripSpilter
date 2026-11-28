-- ==============================================================================
-- TripSplit — Additive Non-Destructive Backend Migration
-- Migration: 20261125_ai_payments_bookings_hardening.sql
-- Adds persisted AI conversations, user preferences, verified payment orders,
-- receipt uploads metadata, and booking provider tracking without modifying
-- or deleting any existing production tables or rows.
-- ==============================================================================

-- 1. Support PERCENTAGE split_type on expenses alongside EQUAL, EXACT, ITEMIZED
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_split_type_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_split_type_check
  CHECK (split_type IN ('EQUAL', 'EXACT', 'ITEMIZED', 'PERCENTAGE'));

-- 2. Enhance bookings for real provider workflows (no fabricated confirmation statuses)
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS provider_name TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS provider_status TEXT DEFAULT 'DRAFT';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS external_url TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 3. User Preferences Table (survives logout/login across devices)
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  preferred_language TEXT NOT NULL DEFAULT 'hi' CHECK (preferred_language IN ('hi', 'en')),
  preferred_currency TEXT NOT NULL DEFAULT 'INR',
  auto_narrate BOOLEAN NOT NULL DEFAULT true,
  email_notifications BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own preferences" ON public.user_preferences;
CREATE POLICY "Users manage own preferences"
  ON public.user_preferences FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4. AI Conversations & Messages (strictly private per user)
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Travel Assistant Chat',
  provider TEXT,
  model TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.ai_conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content TEXT NOT NULL,
  tool_calls JSONB DEFAULT '[]'::jsonb,
  pending_action JSONB,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own AI conversations" ON public.ai_conversations;
CREATE POLICY "Users manage own AI conversations"
  ON public.ai_conversations FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage own AI messages" ON public.ai_messages;
CREATE POLICY "Users manage own AI messages"
  ON public.ai_messages FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON public.ai_conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conv ON public.ai_messages(conversation_id, created_at ASC);

-- 5. Receipt Uploads Metadata Table
CREATE TABLE IF NOT EXISTS public.receipt_uploads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
  extracted_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'discarded')),
  expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.receipt_uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own receipts or view trip receipts" ON public.receipt_uploads;
CREATE POLICY "Users manage own receipts or view trip receipts"
  ON public.receipt_uploads FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR (trip_id IS NOT NULL AND is_trip_member(trip_id)));

DROP POLICY IF EXISTS "Users insert own receipts" ON public.receipt_uploads;
CREATE POLICY "Users insert own receipts"
  ON public.receipt_uploads FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own receipts" ON public.receipt_uploads;
CREATE POLICY "Users update own receipts"
  ON public.receipt_uploads FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_receipt_uploads_user ON public.receipt_uploads(user_id, created_at DESC);

-- 6. Server-Verified Payment Orders & Webhook Audit Log
CREATE TABLE IF NOT EXISTS public.payment_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE,
  split_id UUID REFERENCES public.expense_splits(id) ON DELETE SET NULL,
  provider TEXT NOT NULL CHECK (provider IN ('razorpay', 'stripe', 'cashfree', 'unconfigured')),
  provider_order_id TEXT UNIQUE,
  provider_payment_id TEXT,
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'created' CHECK (
    status IN ('created', 'pending', 'authorized', 'captured', 'failed', 'refunded')
  ),
  idempotency_key TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  signature_verified BOOLEAN NOT NULL DEFAULT false,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(provider, event_id)
);

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own or trip payment orders" ON public.payment_orders;
CREATE POLICY "Users view own or trip payment orders"
  ON public.payment_orders FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR (trip_id IS NOT NULL AND is_trip_member(trip_id)));

DROP POLICY IF EXISTS "Users insert own payment orders" ON public.payment_orders;
CREATE POLICY "Users insert own payment orders"
  ON public.payment_orders FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Webhook events are server-only (service role) - zero direct client policy by design
CREATE INDEX IF NOT EXISTS idx_payment_orders_user ON public.payment_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_orders_provider_id ON public.payment_orders(provider_order_id);
