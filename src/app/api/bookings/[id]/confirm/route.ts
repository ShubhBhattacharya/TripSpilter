import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '../../../../../lib/supabase/server';
import { isSupabaseConfigured } from '../../../../../lib/supabase/client';
import {
  requireAuthenticatedUser,
  requireTripMembership,
  UnauthorizedError,
  ForbiddenError,
} from '../../../../../lib/security/auth-guards';
import { recordTripActivity } from '../../../../../lib/notifications/server';
import {
  normalizeBookingLifecycleStatus,
  validateBookingTransition,
} from '../../../../../lib/financial/booking-state-machine';

const FORBIDDEN_CLIENT_SUPPLIER_KEYS = [
  'providerConfirmationRef',
  'supplierPayload',
  'verificationSource',
];

const confirmBookingSchema = z.object({
  userApprovedTerms: z.literal(true),
  bookingMode: z.enum(['redirect_only', 'provider_api']).default('redirect_only'),
});

/**
 * Records explicit user approval to proceed to external provider portal.
 * Client requests NEVER self-confirm a booking as Confirmed by supplier — that requires
 * an authenticated server-to-supplier ticketing response or cryptographically verified webhook (/api/bookings/webhook).
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
    const rawBody = (await request.json()) as Record<string, unknown>;
    if (FORBIDDEN_CLIENT_SUPPLIER_KEYS.some((k) => k in rawBody && rawBody[k] !== undefined)) {
      return NextResponse.json(
        {
          error:
            'Forbidden: Client requests cannot submit supplier confirmation references or supplier payloads. Confirmation occurs only via authenticated provider webhook.',
        },
        { status: 403 }
      );
    }

    const parsed = confirmBookingSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Explicit user approval of final price & terms is required.' }, { status: 400 });
    }

    const supabase = await createClient();
    const user = await requireAuthenticatedUser(supabase);

    const { data: booking } = await supabase.from('bookings').select('*').eq('id', bookingId).maybeSingle();
    if (!booking) return NextResponse.json({ error: 'Booking draft not found' }, { status: 404 });

    const membership = await requireTripMembership(supabase, booking.trip_id, user.id);
    const isOwnerOrAdmin = booking.booked_by === user.id || membership.isAdmin;

    const transition = validateBookingTransition({
      currentStatus: String(booking.status || 'Draft'),
      targetStatus: 'Pending confirmation',
      actorType: 'user',
      isBookingOwnerOrAdmin: isOwnerOrAdmin,
    });
    if (!transition.allowed) {
      return NextResponse.json({ error: transition.error }, { status: 403 });
    }

    if (parsed.data.bookingMode === 'provider_api') {
      return NextResponse.json(
        {
          confirmedByProvider: false,
          status: 'waiting_for_supplier_ticketing',
          error:
            'Instant automated ticketing API is not enabled. Use redirect_only or await verified supplier confirmation via /api/bookings/webhook.',
        },
        { status: 503 }
      );
    }

    const previousLifecycle = normalizeBookingLifecycleStatus(String(booking.status || 'Draft'));
    const { data: updated, error } = await supabase
      .from('bookings')
      .update({
        provider_status: 'CONTINUE_TO_PROVIDER',
        status: 'Pending confirmation',
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId)
      .eq('status', booking.status)
      .select()
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!updated) {
      return NextResponse.json({ error: 'Concurrent booking update detected. Retry cleanly.' }, { status: 409 });
    }

    try {
      await supabase.from('booking_status_history').insert({
        booking_id: bookingId,
        trip_id: booking.trip_id,
        previous_status: previousLifecycle,
        new_status: 'Pending confirmation',
        changed_by: user.id,
        source: 'redirect',
        notes: 'User approved terms for external supplier redirect',
      });
    } catch {
      // Safe if history table is pending migration
    }

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
        'Supplier confirmation happens only via verified provider callback/webhook. Complete reservation on external portal.',
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: 'Booking confirmation workflow failed' }, { status: 400 });
  }
}
