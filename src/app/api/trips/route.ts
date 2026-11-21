import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { isSupabaseConfigured } from '../../../lib/supabase/client';
import { createTripSchema } from '../../../lib/validations/api';
import { checkRateLimit, getClientIp } from '../../../lib/rate-limit';
import { mockTrips } from '../../../data/mockData';

export async function GET() {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ trips: mockTrips, isDemo: true });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch trips where user is a member
  const { data: memberRows, error: memberError } = await supabase
    .from('trip_members')
    .select('trip_id')
    .eq('user_id', user.id);

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  const tripIds = memberRows.map((r) => r.trip_id);

  const { data: trips, error: tripsError } = await supabase
    .from('trips')
    .select(`
      *,
      trip_members (
        user_id,
        role,
        profiles (
          id,
          display_name,
          upi_id,
          avatar_url
        )
      )
    `)
    .in('id', tripIds)
    .order('created_at', { ascending: false });

  if (tripsError) {
    return NextResponse.json({ error: tripsError.message }, { status: 500 });
  }

  return NextResponse.json({ trips });
}

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  const rateLimit = checkRateLimit(`create_trip_${clientIp}`, 15, 60000);

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: `Too many trip creation requests. Please try again in ${rateLimit.reset}s.` },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.reset),
          'X-RateLimit-Limit': String(rateLimit.limit),
          'X-RateLimit-Remaining': String(rateLimit.remaining),
        },
      }
    );
  }

  try {
    const rawBody = await request.json();
    const validation = createTripSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation Error',
          details: validation.error.issues.map((i) => i.message),
        },
        { status: 400 }
      );
    }

    const { title, destination, startDate, endDate, budget, coverImage } = validation.data;

    if (!isSupabaseConfigured) {
      // Demo simulated response
      return NextResponse.json(
        {
          message: 'Trip created in demo mode',
          trip: {
            id: `trip-${Date.now()}`,
            title,
            destination,
            startDate,
            endDate,
            budget,
            coverImage,
            status: 'ACTIVE',
          },
        },
        { status: 201 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: newTrip, error: insertError } = await supabase
      .from('trips')
      .insert({
        title,
        destination,
        start_date: startDate,
        end_date: endDate,
        budget,
        cover_image: coverImage,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ trip: newTrip }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }
}
