import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '../../../../lib/supabase/server';
import { isSupabaseConfigured } from '../../../../lib/supabase/client';
import {
  requireAuthenticatedUser,
  requireTripMembership,
  requireTripAdmin,
  UnauthorizedError,
  ForbiddenError,
} from '../../../../lib/security/auth-guards';
import { checkRateLimit, getClientIdentifier, applyRateLimitHeaders } from '../../../../lib/rate-limit';

const updateTripSchema = z.object({
  title: z.string().min(2).max(100).optional(),
  destination: z.string().min(2).max(120).optional(),
  startDate: z.string().min(4).optional(),
  endDate: z.string().min(4).optional(),
  budget: z.number().min(0).max(100000000).optional(),
  status: z.enum(['ACTIVE', 'UPCOMING', 'COMPLETED']).optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Database persistence requires Supabase configuration', configured: false }, { status: 503 });
  }

  try {
    const supabase = await createClient();
    const user = await requireAuthenticatedUser(supabase);
    await requireTripMembership(supabase, tripId, user.id);

    const { data, error } = await supabase
      .from('trips')
      .select(`
        *,
        trip_members (user_id, role, profiles (*)),
        itinerary_items (*),
        bookings (*)
      `)
      .eq('id', tripId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    return NextResponse.json({ trip: data });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Database updates require Supabase configuration' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = updateTripSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Validation error' }, { status: 400 });
    }

    const supabase = await createClient();
    const user = await requireAuthenticatedUser(supabase);
    await requireTripAdmin(supabase, tripId, user.id);

    const rateLimit = await checkRateLimit(getClientIdentifier('trip_update', request, user.id), 30, 60000);
    const headers = new Headers();
    applyRateLimitHeaders(headers, rateLimit);
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers });
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.title !== undefined) patch.title = parsed.data.title;
    if (parsed.data.destination !== undefined) patch.destination = parsed.data.destination;
    if (parsed.data.startDate !== undefined) patch.start_date = parsed.data.startDate;
    if (parsed.data.endDate !== undefined) patch.end_date = parsed.data.endDate;
    if (parsed.data.budget !== undefined) patch.budget = parsed.data.budget;
    if (parsed.data.status !== undefined) patch.status = parsed.data.status;

    const { data, error } = await supabase
      .from('trips')
      .update(patch)
      .eq('id', tripId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers });
    return NextResponse.json({ trip: data }, { headers });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Database deletion requires Supabase configuration' }, { status: 503 });
  }

  try {
    const url = new URL(request.url);
    const confirmed = url.searchParams.get('confirm') === 'true';
    if (!confirmed) {
      return NextResponse.json(
        { error: 'Safe deletion requires explicit confirmation (?confirm=true).' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const user = await requireAuthenticatedUser(supabase);
    await requireTripAdmin(supabase, tripId, user.id);

    const { error } = await supabase.from('trips').delete().eq('id', tripId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ deleted: true, tripId });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: 'Unable to delete trip' }, { status: 500 });
  }
}
