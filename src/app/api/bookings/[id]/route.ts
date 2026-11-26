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
import { validateBookingTransition } from '../../../../lib/financial/booking-state-machine';
import { dispatchTripNotifications, recordTripActivity } from '../../../../lib/notifications/server';
import { toPaise } from '../../../../lib/financial/split-engine';

const updateBookingStatusSchema = z.object({
  status: z.enum([
    'Draft',
    'Pending confirmation',
    'Confirmed by supplier',
    'Failed',
    'Cancelled',
    'Refund pending',
    'Refunded',
  ]),
  providerConfirmationRef: z.string().max(120).optional(),
  refundAmountInr: z.number().min(0).max(10000000).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: bookingId } = await params;
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Updating bookings requires Supabase configuration' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = updateBookingStatusSchema.safeParse(body);
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
      targetStatus: parsed.data.status,
      hasSupplierConfirmationRef: Boolean(parsed.data.providerConfirmationRef?.trim()),
      isBookingOwnerOrAdmin: isOwnerOrAdmin,
    });

    if (!transition.allowed) {
      return NextResponse.json({ error: transition.error }, { status: 403 });
    }

    // Never mark Confirmed by supplier without live provider credentials configured
    if (parsed.data.status === 'Confirmed by supplier') {
      const hasProviderCredentials = Boolean(
        process.env.HOTEL_PROVIDER_API_KEY || process.env.FLIGHT_PROVIDER_API_KEY
      );
      if (!hasProviderCredentials) {
        return NextResponse.json(
          {
            error:
              'Confirmed by supplier status requires connected provider API credentials (HOTEL_PROVIDER_API_KEY or FLIGHT_PROVIDER_API_KEY).',
          },
          { status: 503 }
        );
      }
    }

    const patch: Record<string, unknown> = {
      status: parsed.data.status,
      updated_at: new Date().toISOString(),
    };
    if (parsed.data.providerConfirmationRef) {
      patch.booking_ref = parsed.data.providerConfirmationRef.trim();
      patch.provider_status = 'PROVIDER_CONFIRMED';
    }
    if (parsed.data.status === 'Cancelled') {
      patch.cancelled_at = new Date().toISOString();
      patch.provider_status = 'CANCELLED';
    }
    if (parsed.data.status === 'Refund pending' || parsed.data.status === 'Refunded') {
      patch.provider_status = parsed.data.status.toUpperCase().replace(/\s+/g, '_');
      if (parsed.data.refundAmountInr !== undefined) {
        patch.refund_amount_paise = toPaise(parsed.data.refundAmountInr);
      }
    }

    const { data: updated, error } = await supabase
      .from('bookings')
      .update(patch)
      .eq('id', bookingId)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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
        recipientUserIds: [booking.booked_by].filter(Boolean),
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
