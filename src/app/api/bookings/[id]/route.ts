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
} from '../../../../lib/financial/booking-state-machine';
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
  verificationSource: z.enum(['user_action', 'redirect', 'provider_api', 'webhook']).default('user_action'),
  supplierPayload: z.record(z.string(), z.unknown()).optional(),
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

    const hasVerifiedSupplierPayload =
      parsed.data.status !== 'Confirmed by supplier'
        ? true
        : (parsed.data.verificationSource === 'provider_api' || parsed.data.verificationSource === 'webhook') &&
          Boolean(parsed.data.supplierPayload && Object.keys(parsed.data.supplierPayload).length > 0);

    const transition = validateBookingTransition({
      currentStatus: String(booking.status || 'Draft'),
      targetStatus: parsed.data.status,
      providerConfirmationRef: parsed.data.providerConfirmationRef,
      hasVerifiedSupplierPayload,
      isBookingOwnerOrAdmin: isOwnerOrAdmin,
    });

    if (!transition.allowed) {
      return NextResponse.json({ error: transition.error }, { status: 403 });
    }

    if (parsed.data.status === 'Confirmed by supplier') {
      const hasProviderCredentials = Boolean(
        process.env.HOTEL_PROVIDER_API_KEY || process.env.FLIGHT_PROVIDER_API_KEY
      );
      if (!hasProviderCredentials) {
        return NextResponse.json(
          {
            error:
              'Confirmed by supplier requires live supplier credentials and a verified provider/webhook response.',
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
    if (parsed.data.supplierPayload) {
      patch.supplier_payload = parsed.data.supplierPayload;
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

    // Record booking status history & audit logs safely
    try {
      await supabase.from('booking_status_history').insert({
        booking_id: bookingId,
        trip_id: booking.trip_id,
        previous_status: transition.normalizedCurrent,
        new_status: parsed.data.status,
        changed_by: user.id,
        source: parsed.data.verificationSource,
        supplier_ref: parsed.data.providerConfirmationRef || null,
        notes: parsed.data.notes || null,
      });
    } catch {
      // Safe when history table migration hasn't run yet
    }

    await Promise.all([
      recordTripActivity({
        supabase,
        tripId: booking.trip_id,
        userId: user.id,
        actionType: 'BOOKING_STATUS_UPDATED',
        description: `Booking "${booking.title}" moved from "${transition.normalizedCurrent}" -> "${parsed.data.status}"`,
        metadata: { bookingId, status: parsed.data.status, source: parsed.data.verificationSource },
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
