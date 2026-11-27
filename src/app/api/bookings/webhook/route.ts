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

const KNOWN_SUPPLIER_TOKENS = ['amadeus', 'liteapi', 'hotelbeds', 'duffel', 'razorpay', 'stripe', 'viator'];

function doesWebhookProviderMatchBooking(webhookProvider: string, bookingProviderName: string | null): boolean {
  const wp = webhookProvider.trim().toLowerCase();
  const bp = (bookingProviderName || '').trim().toLowerCase();
  if (!wp || !KNOWN_SUPPLIER_TOKENS.includes(wp)) {
    return false;
  }
  if (!bp || bp.includes('external provider') || bp.includes('direct')) {
    return true;
  }
  return bp.includes(wp);
}

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
 * 3. Supports idempotency & retry tracking on booking_webhook_events (processing -> processed / failed).
 * 4. Verifies supplier provider identity against booking.provider_name.
 * 5. Verifies linked payment refund reconciliation before allowing Refunded.
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

  // Deduplicate processed deliveries while allowing atomic retries of previously failed deliveries
  const { data: existingEvent } = await adminClient
    .from('booking_webhook_events')
    .select('id, processing_status, retry_count')
    .eq('provider', parsedBody.provider)
    .eq('event_id', parsedBody.eventId)
    .maybeSingle();

  if (existingEvent) {
    if (existingEvent.processing_status === 'processed') {
      return NextResponse.json({ received: true, duplicateReplay: true });
    }
    if (existingEvent.processing_status === 'processing') {
      return NextResponse.json({ error: 'Webhook delivery currently processing' }, { status: 409 });
    }
    // Re-claim failed webhook delivery for safe retry
    const { data: claimedRetry } = await adminClient
      .from('booking_webhook_events')
      .update({
        processing_status: 'processing',
        retry_count: Number(existingEvent.retry_count || 0) + 1,
        last_error: null,
      })
      .eq('id', existingEvent.id)
      .eq('processing_status', 'failed')
      .select('id')
      .maybeSingle();

    if (!claimedRetry) {
      return NextResponse.json({ error: 'Unable to claim failed webhook retry cleanly' }, { status: 409 });
    }
  } else {
    const { error: replayErr } = await adminClient.from('booking_webhook_events').insert({
      provider: parsedBody.provider,
      event_id: parsedBody.eventId,
      event_type: parsedBody.eventType,
      signature_verified: true,
      processing_status: 'processing',
      payload: parsedBody,
    });

    if (replayErr) {
      if (replayErr.code === '23505') {
        return NextResponse.json({ received: true, duplicateReplay: true });
      }
      return NextResponse.json({ error: replayErr.message }, { status: 500 });
    }
  }

  const markEventFailed = async (reason: string) => {
    await adminClient
      .from('booking_webhook_events')
      .update({ processing_status: 'failed', last_error: reason.slice(0, 300) })
      .eq('provider', parsedBody.provider)
      .eq('event_id', parsedBody.eventId);
  };

  try {
    const { data: booking } = await adminClient
      .from('bookings')
      .select('*')
      .eq('id', parsedBody.bookingId)
      .maybeSingle();

    if (!booking) {
      await markEventFailed('Target booking not found');
      return NextResponse.json({ error: 'Target booking not found' }, { status: 404 });
    }

    // Verify supplier identity against booking's configured provider
    if (!doesWebhookProviderMatchBooking(parsedBody.provider, booking.provider_name as string | null)) {
      const msg = `Supplier provider "${parsedBody.provider}" does not match booking configured supplier "${booking.provider_name || 'unknown'}".`;
      await markEventFailed(msg);
      return NextResponse.json({ error: msg }, { status: 403 });
    }

    const eventToStatus: Record<typeof parsedBody.eventType, BookingLifecycleStatus> = {
      'booking.confirmed': 'Confirmed by supplier',
      'booking.failed': 'Failed',
      'booking.cancelled': 'Cancelled',
      'booking.refunded': 'Refunded',
    };
    const targetStatus = eventToStatus[parsedBody.eventType];

    // Enforce verified payment refund reconciliation before marking booking Refunded
    let refundReconciled = true;
    if (targetStatus === 'Refunded') {
      const orderId = parsedBody.refundOrderId || booking.payment_order_id;
      const requiredPaise = Number(booking.refund_amount_paise || booking.amount_paise || 0);
      if (!orderId) {
        refundReconciled = requiredPaise === 0;
      } else {
        const { data: orderRow } = await adminClient
          .from('payment_orders')
          .select('id, trip_id, status')
          .eq('id', orderId)
          .maybeSingle();

        const sameTrip = !orderRow?.trip_id || orderRow.trip_id === booking.trip_id;
        const orderRefundStateOk =
          orderRow?.status === 'partially_refunded' || orderRow?.status === 'refunded';

        const { data: procRefunds } = await adminClient
          .from('payment_refunds')
          .select('id, amount_paise, status')
          .eq('payment_order_id', orderId)
          .eq('status', 'processed');

        const procSum = (procRefunds || []).reduce(
          (acc, r) => acc + Number((r as { amount_paise?: number }).amount_paise || 0),
          0
        );
        refundReconciled = Boolean(sameTrip && orderRefundStateOk && procSum > 0 && procSum >= requiredPaise);
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
      await markEventFailed(transition.error || 'Lifecycle transition rejected');
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
      const msg = updateErr?.message || 'Concurrent booking state conflict during webhook';
      await markEventFailed(msg);
      return NextResponse.json({ error: msg }, { status: updateErr ? 500 : 409 });
    }

    await adminClient.from('booking_status_history').insert({
      booking_id: parsedBody.bookingId,
      trip_id: booking.trip_id,
      previous_status: transition.normalizedCurrent,
      new_status: targetStatus,
      source: 'webhook',
      supplier_ref: parsedBody.providerConfirmationRef || null,
      notes: `Verified supplier webhook event ${parsedBody.eventId} (${parsedBody.provider})`,
    });

    await adminClient
      .from('booking_webhook_events')
      .update({ processing_status: 'processed', last_error: null })
      .eq('provider', parsedBody.provider)
      .eq('event_id', parsedBody.eventId);

    return NextResponse.json({ received: true, verified: true, booking: updated });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unexpected booking webhook error';
    await markEventFailed(errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
