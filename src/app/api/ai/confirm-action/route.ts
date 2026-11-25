import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '../../../../lib/supabase/server';
import { isSupabaseConfigured } from '../../../../lib/supabase/client';
import { requireAuthenticatedUser, requireTripMembership, UnauthorizedError, ForbiddenError } from '../../../../lib/security/auth-guards';

const confirmSchema = z.object({
  actionType: z.enum(['CREATE_TRIP', 'UPDATE_ITINERARY']),
  approved: z.literal(true),
  payload: z.record(z.string(), z.unknown()),
});

/**
 * Executes AI-prepared draft mutations ONLY after explicit user approval.
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Persisting AI actions requires Supabase configuration' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = confirmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Explicit approval and valid action payload required.' }, { status: 400 });
    }

    const supabase = await createClient();
    const user = await requireAuthenticatedUser(supabase);
    const { actionType, payload } = parsed.data;

    if (actionType === 'CREATE_TRIP') {
      const { data: trip, error } = await supabase
        .from('trips')
        .insert({
          title: String(payload.title || 'New Trip'),
          destination: String(payload.destination || 'India'),
          start_date: String(payload.startDate || new Date().toISOString().split('T')[0]),
          end_date: String(payload.endDate || new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]),
          budget: Math.max(0, Number(payload.budget || 0)),
          created_by: user.id,
        })
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await supabase.from('trip_members').upsert(
        { trip_id: trip.id, user_id: user.id, role: 'admin' },
        { onConflict: 'trip_id,user_id' }
      );
      return NextResponse.json({ executed: true, actionType, record: trip }, { status: 201 });
    }

    if (actionType === 'UPDATE_ITINERARY') {
      const tripId = String(payload.tripId || '');
      await requireTripMembership(supabase, tripId, user.id);

      const { data: item, error } = await supabase
        .from('itinerary_items')
        .insert({
          trip_id: tripId,
          day_number: Math.max(1, Number(payload.day || 1)),
          time: String(payload.time || '10:00 AM'),
          title: String(payload.title || 'Planned Activity'),
          estimated_cost: Math.max(0, Number(payload.estimatedCost || 0)),
        })
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ executed: true, actionType, record: item }, { status: 201 });
    }

    return NextResponse.json({ error: 'Unsupported confirmation action' }, { status: 400 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: 'Failed to execute confirmed action' }, { status: 500 });
  }
}
