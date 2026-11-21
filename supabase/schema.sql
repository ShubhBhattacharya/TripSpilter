-- ==============================================================================
-- TripSplit 🇮🇳 — Production PostgreSQL Database Schema & Security Layer
-- ==============================================================================
-- Instructions: Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. Profiles Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  display_name TEXT,
  upi_id TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Constraint for valid Indian UPI format (alphanumeric, dot, underscore, dash + @ + handle)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS valid_upi_format;
ALTER TABLE public.profiles ADD CONSTRAINT valid_upi_format 
  CHECK (upi_id IS NULL OR upi_id ~* '^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$');

-- ------------------------------------------------------------------------------
-- 2. Trips Table
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 3. Trip Members Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trip_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(trip_id, user_id)
);

-- ------------------------------------------------------------------------------
-- 4. Expenses Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
  paid_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
  vendor_name TEXT NOT NULL CHECK (char_length(trim(vendor_name)) >= 1),
  vendor_upi_id TEXT NOT NULL CHECK (vendor_upi_id ~* '^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$'),
  total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount > 0),
  split_type TEXT DEFAULT 'EQUAL' CHECK (split_type IN ('EQUAL', 'EXACT', 'ITEMIZED')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 5. Expense Splits Table (Individual Shares)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expense_splits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id UUID REFERENCES public.expenses(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  amount_owed NUMERIC(12, 2) NOT NULL CHECK (amount_owed >= 0),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  paid_at TIMESTAMPTZ,
  transaction_ref TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(expense_id, user_id)
);

-- ------------------------------------------------------------------------------
-- 6. Itinerary Items Table
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 7. Bookings Vault Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL CHECK (char_length(trim(title)) >= 1),
  vendor_name TEXT,
  booking_ref TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  file_url TEXT,
  status TEXT DEFAULT 'Confirmed' CHECK (status IN ('Confirmed', 'Pending Split', 'Settled')),
  booked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- Row Level Security (RLS) Helper Functions & Policies
-- ==============================================================================

-- Security definer function to avoid recursive RLS checks on trip_members
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

-- ------------------------------------------------------------------------------
-- Enable RLS on EVERY Table
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itinerary_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- Profiles Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Profiles are readable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles are readable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- Trips Policies (Members only)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can view their trips" ON public.trips;
CREATE POLICY "Members can view their trips"
  ON public.trips FOR SELECT
  TO authenticated
  USING (is_trip_member(id) OR created_by = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can create trips" ON public.trips;
CREATE POLICY "Authenticated users can create trips"
  ON public.trips FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Trip members can update trip details" ON public.trips;
CREATE POLICY "Trip members can update trip details"
  ON public.trips FOR UPDATE
  TO authenticated
  USING (is_trip_member(id) OR created_by = auth.uid());

DROP POLICY IF EXISTS "Trip creators can delete their trip" ON public.trips;
CREATE POLICY "Trip creators can delete their trip"
  ON public.trips FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- ------------------------------------------------------------------------------
-- Trip Members Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can view trip member roster" ON public.trip_members;
CREATE POLICY "Members can view trip member roster"
  ON public.trip_members FOR SELECT
  TO authenticated
  USING (is_trip_member(trip_id) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Trip creators or admins can add members" ON public.trip_members;
CREATE POLICY "Trip creators or admins can add members"
  ON public.trip_members FOR INSERT
  TO authenticated
  WITH CHECK (
    is_trip_member(trip_id) OR 
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.trips WHERE id = trip_id AND created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Members can leave or admins can remove" ON public.trip_members;
CREATE POLICY "Members can leave or admins can remove"
  ON public.trip_members FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR is_trip_member(trip_id));

-- ------------------------------------------------------------------------------
-- Expenses Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Trip members can view expenses" ON public.expenses;
CREATE POLICY "Trip members can view expenses"
  ON public.expenses FOR SELECT
  TO authenticated
  USING (is_trip_member(trip_id));

DROP POLICY IF EXISTS "Trip members can insert expenses" ON public.expenses;
CREATE POLICY "Trip members can insert expenses"
  ON public.expenses FOR INSERT
  TO authenticated
  WITH CHECK (is_trip_member(trip_id));

DROP POLICY IF EXISTS "Payer or trip member can update expense" ON public.expenses;
CREATE POLICY "Payer or trip member can update expense"
  ON public.expenses FOR UPDATE
  TO authenticated
  USING (is_trip_member(trip_id));

DROP POLICY IF EXISTS "Payer can delete expense" ON public.expenses;
CREATE POLICY "Payer can delete expense"
  ON public.expenses FOR DELETE
  TO authenticated
  USING (paid_by = auth.uid() OR is_trip_member(trip_id));

-- ------------------------------------------------------------------------------
-- Expense Splits Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Trip members can view expense splits" ON public.expense_splits;
CREATE POLICY "Trip members can view expense splits"
  ON public.expense_splits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expenses 
      WHERE id = expense_splits.expense_id AND is_trip_member(trip_id)
    )
  );

DROP POLICY IF EXISTS "Trip members can insert expense splits" ON public.expense_splits;
CREATE POLICY "Trip members can insert expense splits"
  ON public.expense_splits FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expenses 
      WHERE id = expense_splits.expense_id AND is_trip_member(trip_id)
    )
  );

DROP POLICY IF EXISTS "Users can update their own split status or payer can update" ON public.expense_splits;
CREATE POLICY "Users can update their own split status or payer can update"
  ON public.expense_splits FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.expenses 
      WHERE id = expense_splits.expense_id AND (paid_by = auth.uid() OR is_trip_member(trip_id))
    )
  );

-- ------------------------------------------------------------------------------
-- Itinerary Items Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Trip members can view itinerary" ON public.itinerary_items;
CREATE POLICY "Trip members can view itinerary"
  ON public.itinerary_items FOR SELECT
  TO authenticated
  USING (is_trip_member(trip_id));

DROP POLICY IF EXISTS "Trip members can create itinerary items" ON public.itinerary_items;
CREATE POLICY "Trip members can create itinerary items"
  ON public.itinerary_items FOR INSERT
  TO authenticated
  WITH CHECK (is_trip_member(trip_id));

DROP POLICY IF EXISTS "Trip members can update itinerary items" ON public.itinerary_items;
CREATE POLICY "Trip members can update itinerary items"
  ON public.itinerary_items FOR UPDATE
  TO authenticated
  USING (is_trip_member(trip_id));

DROP POLICY IF EXISTS "Trip members can delete itinerary items" ON public.itinerary_items;
CREATE POLICY "Trip members can delete itinerary items"
  ON public.itinerary_items FOR DELETE
  TO authenticated
  USING (is_trip_member(trip_id));

-- ------------------------------------------------------------------------------
-- Bookings Vault Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Trip members can view bookings" ON public.bookings;
CREATE POLICY "Trip members can view bookings"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (is_trip_member(trip_id));

DROP POLICY IF EXISTS "Trip members can add bookings" ON public.bookings;
CREATE POLICY "Trip members can add bookings"
  ON public.bookings FOR INSERT
  TO authenticated
  WITH CHECK (is_trip_member(trip_id));

DROP POLICY IF EXISTS "Trip members can update bookings" ON public.bookings;
CREATE POLICY "Trip members can update bookings"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (is_trip_member(trip_id));

-- ==============================================================================
-- Triggers: Auto-Profile on User Signup
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
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
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to auto-add trip creator to trip_members as admin
CREATE OR REPLACE FUNCTION public.handle_new_trip_creator()
RETURNS TRIGGER AS $$
BEGIN
  IF new.created_by IS NOT NULL THEN
    INSERT INTO public.trip_members (trip_id, user_id, role)
    VALUES (new.id, new.created_by, 'admin')
    ON CONFLICT (trip_id, user_id) DO NOTHING;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_trip_created ON public.trips;
CREATE TRIGGER on_trip_created
  AFTER INSERT ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_trip_creator();
