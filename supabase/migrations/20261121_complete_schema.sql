-- ==============================================================================
-- Migration: Complete 16-Table Schema for TripSplit Production
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  display_name TEXT,
  upi_id TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS valid_upi_format;
ALTER TABLE public.profiles ADD CONSTRAINT valid_upi_format 
  CHECK (upi_id IS NULL OR upi_id ~* '^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$');

-- Trips Table
CREATE TABLE IF NOT EXISTS public.trips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL CHECK (char_length(trim(title)) >= 2),
  destination TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  budget NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (budget >= 0),
  cover_image TEXT DEFAULT 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=1200&q=80',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'UPCOMING', 'COMPLETED')),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trip Members Table
CREATE TABLE IF NOT EXISTS public.trip_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(trip_id, user_id)
);

-- Trip Invitations Table
CREATE TABLE IF NOT EXISTS public.trip_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  email TEXT,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Expenses Table
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
  paid_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
  vendor_name TEXT NOT NULL CHECK (char_length(trim(vendor_name)) >= 1),
  vendor_upi_id TEXT,
  total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount > 0),
  total_amount_paise BIGINT NOT NULL DEFAULT 0 CHECK (total_amount_paise >= 0),
  split_type TEXT DEFAULT 'EQUAL' CHECK (split_type IN ('EQUAL', 'EXACT', 'ITEMIZED')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Expense Splits Table
CREATE TABLE IF NOT EXISTS public.expense_splits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id UUID REFERENCES public.expenses(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  amount_owed NUMERIC(12, 2) NOT NULL CHECK (amount_owed >= 0),
  amount_owed_paise BIGINT NOT NULL DEFAULT 0 CHECK (amount_owed_paise >= 0),
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'payment_initiated', 'awaiting_confirmation',
    'manually_reported_paid', 'verified_paid', 'failed', 'rejected'
  )),
  paid_at TIMESTAMPTZ,
  transaction_ref TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(expense_id, user_id)
);

-- Vendor Splits Table
CREATE TABLE IF NOT EXISTS public.vendor_splits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  vendor_name TEXT NOT NULL CHECK (char_length(trim(vendor_name)) >= 1),
  vendor_upi_id TEXT NOT NULL CHECK (vendor_upi_id ~* '^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$'),
  total_bill_amount NUMERIC(12, 2) NOT NULL CHECK (total_bill_amount > 0),
  total_bill_amount_paise BIGINT NOT NULL CHECK (total_bill_amount_paise > 0),
  split_mode TEXT DEFAULT 'EQUAL' CHECK (split_mode IN ('EQUAL', 'EXACT', 'ITEMIZED')),
  invoice_ref TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Vendor Split Members Table
CREATE TABLE IF NOT EXISTS public.vendor_split_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_split_id UUID REFERENCES public.vendor_splits(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  share_amount NUMERIC(12, 2) NOT NULL CHECK (share_amount >= 0),
  share_amount_paise BIGINT NOT NULL CHECK (share_amount_paise >= 0),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN (
    'pending', 'payment_initiated', 'awaiting_confirmation',
    'manually_reported_paid', 'verified_paid', 'failed', 'rejected'
  )),
  upi_uri TEXT,
  transaction_ref TEXT,
  paid_at TIMESTAMPTZ,
  verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(vendor_split_id, user_id)
);

-- Settlements Table
CREATE TABLE IF NOT EXISTS public.settlements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
  from_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  to_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'payment_initiated', 'awaiting_confirmation',
    'manually_reported_paid', 'verified_paid', 'failed', 'rejected'
  )),
  upi_ref TEXT,
  proof_image_url TEXT,
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Itinerary Items Table
CREATE TABLE IF NOT EXISTS public.itinerary_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
  day_number INTEGER NOT NULL CHECK (day_number > 0),
  time TEXT NOT NULL,
  title TEXT NOT NULL CHECK (char_length(trim(title)) >= 1),
  location_url TEXT,
  type TEXT DEFAULT 'Activity' CHECK (type IN ('Transport', 'Stay', 'Food', 'Activity', 'Sightseeing')),
  estimated_cost NUMERIC(12, 2) DEFAULT 0 CHECK (estimated_cost >= 0),
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Bookings Vault Table
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL CHECK (char_length(trim(title)) >= 1),
  vendor_name TEXT,
  booking_ref TEXT NOT NULL,
  category TEXT DEFAULT 'Stay' CHECK (category IN ('Hotel', 'Flight', 'Train', 'Bus', 'Rental', 'Activity', 'Other')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  amount_paise BIGINT NOT NULL DEFAULT 0 CHECK (amount_paise >= 0),
  file_url TEXT,
  status TEXT DEFAULT 'Confirmed' CHECK (status IN ('Confirmed', 'Pending Split', 'Settled')),
  booked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Polls Table
CREATE TABLE IF NOT EXISTS public.polls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  question TEXT NOT NULL CHECK (char_length(trim(question)) >= 2),
  is_multiple_choice BOOLEAN DEFAULT false,
  is_closed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Poll Options Table
CREATE TABLE IF NOT EXISTS public.poll_options (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE NOT NULL,
  option_text TEXT NOT NULL CHECK (char_length(trim(option_text)) >= 1),
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Poll Votes Table
CREATE TABLE IF NOT EXISTS public.poll_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE NOT NULL,
  option_id UUID REFERENCES public.poll_options(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(poll_id, user_id, option_id)
);

-- Activity Logs Table
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Helper
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

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_split_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itinerary_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trip_members_trip ON public.trip_members(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_members_user ON public.trip_members(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_invitations_trip ON public.trip_invitations(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_invitations_code ON public.trip_invitations(invite_code);
CREATE INDEX IF NOT EXISTS idx_expenses_trip ON public.expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by ON public.expenses(paid_by);
CREATE INDEX IF NOT EXISTS idx_expense_splits_expense ON public.expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_user ON public.expense_splits(user_id);
CREATE INDEX IF NOT EXISTS idx_vendor_splits_trip ON public.vendor_splits(trip_id);
CREATE INDEX IF NOT EXISTS idx_vendor_split_members_split ON public.vendor_split_members(vendor_split_id);
CREATE INDEX IF NOT EXISTS idx_vendor_split_members_user ON public.vendor_split_members(user_id);
CREATE INDEX IF NOT EXISTS idx_settlements_trip ON public.settlements(trip_id);
CREATE INDEX IF NOT EXISTS idx_settlements_from_user ON public.settlements(from_user_id);
CREATE INDEX IF NOT EXISTS idx_settlements_to_user ON public.settlements(to_user_id);
CREATE INDEX IF NOT EXISTS idx_itinerary_trip ON public.itinerary_items(trip_id);
CREATE INDEX IF NOT EXISTS idx_bookings_trip ON public.bookings(trip_id);
CREATE INDEX IF NOT EXISTS idx_polls_trip ON public.polls(trip_id);
CREATE INDEX IF NOT EXISTS idx_poll_options_poll ON public.poll_options(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON public.poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_trip ON public.activity_logs(trip_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
