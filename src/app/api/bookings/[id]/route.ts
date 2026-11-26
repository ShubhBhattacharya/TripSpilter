import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '../../../../lib/supabase/server';
import { isSupabaseConfigured } from '../../../../lib/supabase/client';
import {
  requireAuthenticatedUser,
  requireTripMembership,
  UnauthorizedError,
  ForbiddenError,
} from '../../../../lib/security/auth-guards';
import {
  validateBookingTransition,
  normalizeBookingLifecycleStatus,
  BookingLifecycleStatus,
} from '../../../../lib/financial/booking-state-machine';
import { dispatchTripNotifications, recordTripActivity } from '../../../../lib/notifications/server';
import { toPaise } from '../../../../lib/financial/split-engine';

const FORBIDDEN_CLIENT_SUPPLIER_KEYS = [
  'verificationSource',
  'supplierPayload',
  'providerConfirmationRef',
  'provider_status',
  'booking_ref',
];

const userBookingPatchSchema = z.object({
  status: z.enum([
    'Draft',
    'Pending confirmation',
    'Confirmed by supplier',
    'Failed',
    'Cancelled',
    'Refund pending',
    'Refunded',
  ]),
  refundAmountInr: z.number().min(0).max(10000000).optional(),
  notes: z.string().max(240).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: bookingId } = await params;
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Loading booking history requires Supabase configuration' }, { status: 503 });
  }

  try {
    const supabase = await createClient();
    const user = await requireAuthenticatedUser(supabase);

    const { data: booking } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .maybeSingle();

    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    await requireTripMembership(supabase, booking.trip_id, user.id);

    const { data: history } = await supabase
      .from('booking_status_history')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true });

    return NextResponse.json({
      booking,
      lifecycleStatus: normalizeBookingLifecycleStatus(String(booking.status)),
      history: history || [],
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: 'Unable to load booking details' }, { status: 500 });
  }
}

/**
 * User-initiated booking lifecycle endpoint ONLY.
 * Strictly blocks client-submitted verificationSource / supplierPayload / providerConfirmationRef
 * and rejects attempts to self-mark Confirmed by supplier or Refunded.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: bookingId } = await params;
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Updating bookings requires Supabase configuration' }, { status: 503 });
  }

  try {
    const rawBody = (await request.json()) as Record<string, unknown>;

    // Immediately reject forged client-supplied supplier proof fields
    if (FORBIDDEN_CLIENT_SUPPLIER_KEYS.some((k) => k in rawBody && rawBody[k] !== undefined)) {
      return NextResponse.json(
        {
          error:
            'Forbidden: Supplier verification fields (verificationSource, supplierPayload, providerConfirmationRef) cannot be supplied by client requests.',
        },
        { status: 403 }
      );
    }

    const parsed = userBookingPatchSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid booking lifecycle update' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const user = await requireAuthenticatedUser(supabase);

    const { data: booking } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .maybeSingle();

    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

    const membership = await requireTripMembership(supabase, booking.trip_id, user.id);
    const isOwnerOrAdmin = booking.booked_by === user.id || membership.isAdmin;

    const transition = validateBookingTransition({
      currentStatus: String(booking.status || 'Draft'),
      targetStatus: parsed.data.status as BookingLifecycleStatus,
      actorType: 'user',
      isBookingOwnerOrAdmin: isOwnerOrAdmin,
    });

    if (!transition.allowed) {
      return NextResponse.json({ error: transition.error }, { status: 403 });
    }

    const patch: Record<string, unknown> = {
      status: parsed.data.status,
      updated_at: new Date().toISOString(),
    };

    if (parsed.data.status === 'Cancelled') {
      patch.cancelled_at = new Date().toISOString();
      patch.provider_status = 'CANCELLED';
    }
    if (parsed.data.status === 'Pending confirmation') {
      patch.provider_status = 'CONTINUE_TO_PROVIDER';
    }
    if (parsed.data.status === 'Refund pending') {
      patch.provider_status = 'REFUND_PENDING';
      if (parsed.data.refundAmountInr !== undefined) {
        patch.refund_amount_paise = toPaise(parsed.data.refundAmountInr);
      }
    }

    // Atomic optimistic CAS update prevents concurrent status-change race conditions
    const { data: updated, error } = await supabase
      .from('bookings')
      .update(patch)
      .eq('id', bookingId)
      .eq('status', booking.status)
      .select('*')
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!updated) {
      return NextResponse.json(
        { error: 'Concurrent booking update detected. Refresh booking state and retry.' },
        { status: 409 }
      );
    }

    try {
      await supabase.from('booking_status_history').insert({
        booking_id: bookingId,
        trip_id: booking.trip_id,
        previous_status: transition.normalizedCurrent,
        new_status: parsed.data.status,
        changed_by: user.id,
        source: 'user_action',
        notes: parsed.data.notes || null,
      });
    } catch {
      // Safe if audit history migration is pending
    }

    await Promise.all([
      recordTripActivity({
        supabase,
        tripId: booking.trip_id,
        userId: user.id,
        actionType: 'BOOKING_STATUS_UPDATED',
        description: `Booking "${booking.title}" moved from "${transition.normalizedCurrent}" -> "${parsed.data.status}"`,
        metadata: { bookingId, status: parsed.data.status },
      }),
      dispatchTripNotifications({
        supabase,
        tripId: booking.trip_id,
        recipientUserIds: booking.booked_by ? [booking.booked_by] : [],
        includeActor: true,
        title: `Booking ${parsed.data.status}: ${booking.title}`,
        message: `Lifecycle state updated to "${parsed.data.status}".`,
        type: 'booking',
        actorUserId: user.id,
      }),
    ]);

    return NextResponse.json({ booking: updated });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: 'Unable to update booking status' }, { status: 400 });
  }
}
