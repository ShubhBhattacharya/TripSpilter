import { NextResponse } from 'next/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { z } from 'zod';
import { verifyWebhookSignature, validateWebhookTimestamp } from '../../../../lib/payments/gateway';
import { getServerServiceRoleKey, isValidSupabaseConfig } from '../../../../lib/config/env';
import {
  BookingLifecycleStatus,
  validateBookingTransition,
} from '../../../../lib/financial/booking-state-machine';

export const runtime = 'nodejs';

const supplierWebhookSchema = z.object({
  eventId: z.string().min(4).max(120),
  provider: z.string().min(2).max(60),
  bookingId: z.string().uuid(),
  eventType: z.enum([
    'booking.confirmed',
    'booking.failed',
    'booking.cancelled',
    'booking.refunded',
  ]),
  providerConfirmationRef: z.string().min(4).max(80).optional(),
  refundOrderId: z.string().uuid().optional(),
  supplierPayload: z.record(z.string(), z.unknown()).refine((v) => Object.keys(v).length > 0, {
    message: 'Non-empty supplierPayload from authenticated webhook is required.',
  }),
});

/**
 * Trusted Supplier Booking Webhook Endpoint.
 * Exclusively handles verified transitions to Confirmed by supplier / Failed / Refunded:
 * 1. Verifies HMAC-SHA256 signature using BOOKING_PROVIDER_WEBHOOK_SECRET.
 * 2. Enforces +-5 minute timestamp anti-replay window.
 * 3. Deduplicates (provider, event_id) in booking_webhook_events.
 * 4. Reconciles payment refund status before allowing Refunded.
 */
export async function POST(request: Request) {
  const webhookSecret = process.env.BOOKING_PROVIDER_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return NextResponse.json(
      {
        configured: false,
        status: 'WAITING FOR SUPPLIER WEBHOOK CREDENTIALS',
        missingCredential: 'BOOKING_PROVIDER_WEBHOOK_SECRET',
      },
      { status: 503 }
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get('x-booking-signature') || request.headers.get('x-webhook-signature');
  if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: 'Invalid supplier webhook signature' }, { status: 401 });
  }

  const timestampHeader = request.headers.get('x-webhook-timestamp');
  if (!validateWebhookTimestamp(timestampHeader)) {
    return NextResponse.json(
      { error: 'Missing or expired x-webhook-timestamp replay protection window' },
      { status: 401 }
    );
  }

  let parsedBody: z.infer<typeof supplierWebhookSchema>;
  try {
    const rawJson = JSON.parse(rawBody);
    const parsed = supplierWebhookSchema.safeParse(rawJson);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Malformed supplier webhook payload' },
        { status: 400 }
      );
    }
    parsedBody = parsed.data;
  } catch {
    return NextResponse.json({ error: 'Malformed JSON body' }, { status: 400 });
  }

  const serviceRoleKey = getServerServiceRoleKey();
  if (!isValidSupabaseConfig() || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Server Supabase configuration + service role key required to persist verified booking updates.' },
      { status: 503 }
    );
  }

  const adminClient = createSupabaseAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);

  // Deduplicate replay events strictly
  const { error: replayErr } = await adminClient.from('booking_webhook_events').insert({
    provider: parsedBody.provider,
    event_id: parsedBody.eventId,
    event_type: parsedBody.eventType,
    signature_verified: true,
    payload: parsedBody,
  });

  if (replayErr) {
    if (replayErr.code === '23505') {
      return NextResponse.json({ received: true, duplicateReplay: true });
    }
    return NextResponse.json({ error: replayErr.message }, { status: 500 });
  }

  const { data: booking } = await adminClient
    .from('bookings')
    .select('*')
    .eq('id', parsedBody.bookingId)
    .maybeSingle();

  if (!booking) {
    return NextResponse.json({ error: 'Target booking not found' }, { status: 404 });
  }

  const eventToStatus: Record<typeof parsedBody.eventType, BookingLifecycleStatus> = {
    'booking.confirmed': 'Confirmed by supplier',
    'booking.failed': 'Failed',
    'booking.cancelled': 'Cancelled',
    'booking.refunded': 'Refunded',
  };
  const targetStatus = eventToStatus[parsedBody.eventType];

  // For booking.refunded, verify reconciled processed payment refund when linked
  let refundReconciled = true;
  if (targetStatus === 'Refunded') {
    const orderId = parsedBody.refundOrderId || booking.payment_order_id;
    if (orderId) {
      const { data: procRefunds } = await adminClient
        .from('payment_refunds')
        .select('id, status')
        .eq('payment_order_id', orderId)
        .eq('status', 'processed');
      refundReconciled = Boolean(procRefunds && procRefunds.length > 0);
    }
  }

  const transition = validateBookingTransition({
    currentStatus: String(booking.status || 'Draft'),
    targetStatus,
    actorType: 'trusted_supplier_server',
    providerConfirmationRef: parsedBody.providerConfirmationRef,
    hasVerifiedSupplierPayload: true,
    refundReconciled,
    isBookingOwnerOrAdmin: true,
  });

  if (!transition.allowed) {
    return NextResponse.json({ error: transition.error }, { status: 422 });
  }

  const patch: Record<string, unknown> = {
    status: targetStatus,
    supplier_payload: parsedBody.supplierPayload,
    provider_status:
      targetStatus === 'Confirmed by supplier'
        ? 'PROVIDER_CONFIRMED'
        : targetStatus.toUpperCase().replace(/\s+/g, '_'),
    updated_at: new Date().toISOString(),
  };
  if (parsedBody.providerConfirmationRef) {
    patch.booking_ref = parsedBody.providerConfirmationRef.trim();
  }

  const { data: updated, error: updateErr } = await adminClient
    .from('bookings')
    .update(patch)
    .eq('id', parsedBody.bookingId)
    .eq('status', booking.status)
    .select('*')
    .maybeSingle();

  if (updateErr || !updated) {
    return NextResponse.json(
      { error: updateErr?.message || 'Concurrent booking state conflict during webhook' },
      { status: updateErr ? 500 : 409 }
    );
  }

  await adminClient.from('booking_status_history').insert({
    booking_id: parsedBody.bookingId,
    trip_id: booking.trip_id,
    previous_status: transition.normalizedCurrent,
    new_status: targetStatus,
    source: 'webhook',
    supplier_ref: parsedBody.providerConfirmationRef || null,
    notes: `Verified supplier webhook event ${parsedBody.eventId}`,
  });

  return NextResponse.json({ received: true, verified: true, booking: updated });
}
