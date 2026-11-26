import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '../../../../../lib/supabase/server';
import { isSupabaseConfigured } from '../../../../../lib/supabase/client';
import { requireAuthenticatedUser, requireTripMembership, UnauthorizedError, ForbiddenError } from '../../../../../lib/security/auth-guards';
import { recordTripActivity } from '../../../../../lib/notifications/server';

const confirmBookingSchema = z.object({
  userApprovedTerms: z.literal(true),
  bookingMode: z.enum(['redirect_only', 'provider_api']).default('redirect_only'),
  providerConfirmationRef: z.string().max(120).optional(),
});

/**
 * Revalidates booking draft and records user approval.
 * Never fabricates a "Confirmed" status when only redirect-to-provider is supported.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: bookingId } = await params;
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Booking confirmation requires Supabase configuration' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = confirmBookingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Explicit user approval of final price & terms is required.' }, { status: 400 });
    }

    const supabase = await createClient();
    const user = await requireAuthenticatedUser(supabase);

    const { data: booking } = await supabase.from('bookings').select('*').eq('id', bookingId).maybeSingle();
    if (!booking) return NextResponse.json({ error: 'Booking draft not found' }, { status: 404 });

    await requireTripMembership(supabase, booking.trip_id, user.id);

    // If booking provider only supports search/redirect or keys aren't connected, never pretend booking succeeded
    const hasProviderCredentials = Boolean(
      process.env.HOTEL_PROVIDER_API_KEY || process.env.FLIGHT_PROVIDER_API_KEY
    );

    if (parsed.data.bookingMode === 'redirect_only' || !hasProviderCredentials) {
      const { data: updated, error } = await supabase
        .from('bookings')
        .update({
          provider_status: 'CONTINUE_TO_PROVIDER',
          status: 'Pending confirmation',
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await recordTripActivity({
        supabase,
        tripId: booking.trip_id,
        userId: user.id,
        actionType: 'BOOKING_PENDING_CONFIRMATION',
        description: `Booking "${booking.title}" moved to Pending confirmation (external provider redirect)`,
        metadata: { bookingId },
      });
      return NextResponse.json({
        booking: updated,
        label: 'Continue to provider to book',
        confirmedByProvider: false,
        disclaimer:
          'Direct instant provider ticketing requires live provider booking credentials. Complete reservation on provider portal.',
      });
    }

    if (!parsed.data.providerConfirmationRef) {
      return NextResponse.json(
        { error: 'Verified provider confirmation reference is required to mark Confirmed by supplier.' },
        { status: 400 }
      );
    }

    const { data: confirmed, error } = await supabase
      .from('bookings')
      .update({
        booking_ref: parsed.data.providerConfirmationRef,
        provider_status: 'PROVIDER_CONFIRMED',
        status: 'Confirmed by supplier',
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await recordTripActivity({
      supabase,
      tripId: booking.trip_id,
      userId: user.id,
      actionType: 'BOOKING_CONFIRMED_SUPPLIER',
      description: `Booking "${booking.title}" confirmed by supplier (${parsed.data.providerConfirmationRef})`,
      metadata: { bookingId, ref: parsed.data.providerConfirmationRef },
    });
    return NextResponse.json({ booking: confirmed, confirmedByProvider: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: 'Booking confirmation failed' }, { status: 400 });
  }
}
