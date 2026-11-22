import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { isSupabaseConfigured } from '../../../lib/supabase/client';
import { createTripSchema } from '../../../lib/validations/api';
import {
  checkRateLimit,
  getClientIdentifier,
  applyRateLimitHeaders,
} from '../../../lib/rate-limit';
import {
  requireAuthenticatedUser,
  UnauthorizedError,
} from '../../../lib/security/auth-guards';
import { mockTrips } from '../../../data/mockData';

export async function GET(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ trips: mockTrips, isDemo: true });
  }

  try {
    const supabase = await createClient();
    const user = await requireAuthenticatedUser(supabase);

    const rateLimitId = getClientIdentifier('get_trips', request, user.id);
    const rateLimit = await checkRateLimit(rateLimitId, 60, 60000);

    const headers = new Headers();
    applyRateLimitHeaders(headers, rateLimit);

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: `Too many requests. Please wait ${rateLimit.reset}s.` },
        { status: 429, headers }
      );
    }

    // Fetch trips where user is explicitly a member or creator
    const { data: memberRows, error: memberError } = await supabase
      .from('trip_members')
      .select('trip_id')
      .eq('user_id', user.id);

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500, headers });
    }

    const tripIds = memberRows ? memberRows.map((r) => r.trip_id) : [];

    // Also include trips created by user even if member row was delayed
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
      .or(`id.in.(${tripIds.length > 0 ? tripIds.join(',') : '00000000-0000-0000-0000-000000000000'}),created_by.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (tripsError) {
      return NextResponse.json({ error: tripsError.message }, { status: 500, headers });
    }

    return NextResponse.json({ trips: trips || [] }, { headers });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
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
    const user = await requireAuthenticatedUser(supabase);

    // Rate limit per authenticated user
    const rateLimitId = getClientIdentifier('create_trip', request, user.id);
    const rateLimit = await checkRateLimit(rateLimitId, 15, 60000);

    const headers = new Headers();
    applyRateLimitHeaders(headers, rateLimit);

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: `Too many trip creation requests. Please try again in ${rateLimit.reset}s.` },
        { status: 429, headers }
      );
    }

    // 1. Insert new trip record
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
      return NextResponse.json({ error: insertError.message }, { status: 500, headers });
    }

    // 2. Ensure creator is recorded in trip_members with 'admin' role
    await supabase
      .from('trip_members')
      .upsert(
        {
          trip_id: newTrip.id,
          user_id: user.id,
          role: 'admin',
        },
        { onConflict: 'trip_id,user_id' }
      );

    return NextResponse.json({ trip: newTrip }, { status: 201, headers });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }
}