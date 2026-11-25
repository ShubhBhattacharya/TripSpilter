import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '../../../lib/supabase/server';
import { isSupabaseConfigured } from '../../../lib/supabase/client';
import {
  requireAuthenticatedUser,
  requireTripMembership,
  UnauthorizedError,
  ForbiddenError,
} from '../../../lib/security/auth-guards';
import { toPaise } from '../../../lib/financial/split-engine';

const createBookingDraftSchema = z.object({
  tripId: z.string().uuid(),
  title: z.string().min(2).max(120),
  vendorName: z.string().min(1).max(100),
  category: z.enum(['Hotel', 'Flight', 'Train', 'Bus', 'Rental', 'Activity', 'Other']),
  amount: z.number().min(0).max(10000000),
  currency: z.string().default('INR'),
  providerName: z.string().max(100).optional(),
  externalUrl: z.string().url().optional(),
});

export async function GET(request: Request) {
  const tripId = new URL(request.url).searchParams.get('tripId');
  if (!tripId) return NextResponse.json({ error: 'tripId is required' }, { status: 400 });
  if (!isSupabaseConfigured) return NextResponse.json({ bookings: [], configured: false });

  try {
    const supabase = await createClient();
    const user = await requireAuthenticatedUser(supabase);
    await requireTripMembership(supabase, tripId, user.id);

    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ bookings: data || [] });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: 'Failed to load bookings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Saving bookings requires Supabase configuration' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = createBookingDraftSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid booking draft' }, { status: 400 });
    }

    const supabase = await createClient();
    const user = await requireAuthenticatedUser(supabase);
    await requireTripMembership(supabase, parsed.data.tripId, user.id);

    const draftRef = `DRAFT-${Date.now().toString(36).toUpperCase()}`;
    const { data, error } = await supabase
      .from('bookings')
      .insert({
        trip_id: parsed.data.tripId,
        title: parsed.data.title,
        vendor_name: parsed.data.vendorName,
        booking_ref: draftRef,
        category: parsed.data.category,
        amount: parsed.data.amount,
        amount_paise: toPaise(parsed.data.amount),
        status: 'Pending Split',
        provider_name: parsed.data.providerName || 'Direct / External Provider',
        provider_status: 'DRAFT',
        external_url: parsed.data.externalUrl || null,
        currency: parsed.data.currency,
        booked_by: user.id,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      booking: data,
      nextStep: 'Review price & terms and confirm via /api/bookings/[id]/confirm or continue to external provider.',
    }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: 'Unable to create booking draft' }, { status: 400 });
  }
}
