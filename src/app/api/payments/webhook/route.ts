import { NextResponse } from 'next/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { verifyWebhookSignature, validateWebhookTimestamp } from '../../../../lib/payments/gateway';
import { getServerServiceRoleKey, isValidSupabaseConfig } from '../../../../lib/config/env';
import { computeReconciledOrderStatus } from '../../../../lib/financial/refund-engine';

export const runtime = 'nodejs';

/**
 * Authorized Server Payment Webhook Endpoint
 * - Verifies HMAC-SHA256 provider signature cleanly
 * - Validates replay timestamp window when provided
 * - Supports retryable webhook processing state (processing -> processed / failed)
 * - Independently verifies payment/refund amounts & cumulative refund totals via service_role
 */
export async function POST(request: Request) {
  const webhookSecret = process.env.PAYMENT_PROVIDER_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return NextResponse.json(
      {
        configured: false,
        status: 'WAITING FOR PAYMENT PROVIDER CREDENTIALS',
        missingCredential: 'PAYMENT_PROVIDER_WEBHOOK_SECRET',
      },
      { status: 503 }
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get('x-razorpay-signature') || request.headers.get('x-webhook-signature');

  if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
  }

  const tsHeader = request.headers.get('x-webhook-timestamp');
  if (tsHeader && !validateWebhookTimestamp(tsHeader)) {
    return NextResponse.json({ error: 'Expired webhook replay timestamp window' }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Malformed webhook JSON' }, { status: 400 });
  }

  const eventType = String(payload.event || 'unknown');
  const eventId =
    request.headers.get('x-razorpay-event-id') ||
    String((payload as { id?: string }).id || `${eventType}_${Date.now()}`);

  const serviceRoleKey = getServerServiceRoleKey();
  if (!isValidSupabaseConfig() || !serviceRoleKey) {
    return NextResponse.json(
      {
        verified: true,
        persisted: false,
        warning: 'Supabase service role key missing; webhook verified but not persisted.',
      },
      { status: 200 }
    );
  }

  const adminClient = createSupabaseAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);

  // Check existing webhook event status for replay deduplication vs safe failed-event retry
  const { data: existingEvent } = await adminClient
    .from('payment_webhook_events')
    .select('id, processing_status, retry_count')
    .eq('provider', 'razorpay')
    .eq('event_id', eventId)
    .maybeSingle();

  if (existingEvent) {
    if (existingEvent.processing_status === 'processed') {
      return NextResponse.json({ received: true, duplicateReplay: true });
    }
    if (existingEvent.processing_status === 'processing') {
      return NextResponse.json({ error: 'Webhook delivery currently processing' }, { status: 409 });
    }
    const { data: claimed } = await adminClient
      .from('payment_webhook_events')
      .update({
        processing_status: 'processing',
        retry_count: Number(existingEvent.retry_count || 0) + 1,
        last_error: null,
      })
      .eq('id', existingEvent.id)
      .eq('processing_status', 'failed')
      .select('id')
      .maybeSingle();

    if (!claimed) {
      return NextResponse.json({ error: 'Concurrent retry claim conflict' }, { status: 409 });
    }
  } else {
    const { error: insertEventErr } = await adminClient.from('payment_webhook_events').insert({
      provider: 'razorpay',
      event_id: eventId,
      event_type: eventType,
      signature_verified: true,
      processing_status: 'processing',
      payload,
    });

    if (insertEventErr) {
      if (insertEventErr.code === '23505') {
        return NextResponse.json({ received: true, duplicateReplay: true });
      }
      return NextResponse.json({ error: insertEventErr.message }, { status: 500 });
    }
  }

  const markFailed = async (reason: string) => {
    await adminClient
      .from('payment_webhook_events')
      .update({ processing_status: 'failed', last_error: reason.slice(0, 300) })
      .eq('provider', 'razorpay')
      .eq('event_id', eventId);
  };

  try {
    // Handle Razorpay payment.captured / payment.failed events
    const paymentEntity = (
      payload.payload as {
        payment?: { entity?: { id?: string; order_id?: string; amount?: number; currency?: string; status?: string } };
      }
    )?.payment?.entity;

    if (paymentEntity?.order_id) {
      const { data: existingOrder } = await adminClient
        .from('payment_orders')
        .select('id, split_id, amount_paise, currency')
        .eq('provider_order_id', paymentEntity.order_id)
        .maybeSingle();

      if (
        existingOrder &&
        eventType === 'payment.captured' &&
        typeof paymentEntity.amount === 'number' &&
        paymentEntity.amount < Number(existingOrder.amount_paise)
      ) {
        const msg = `Captured payment amount (${paymentEntity.amount} paise) is less than order amount (${existingOrder.amount_paise} paise).`;
        await markFailed(msg);
        return NextResponse.json({ error: msg }, { status: 422 });
      }

      const newOrderStatus =
        eventType === 'payment.captured'
          ? 'captured'
          : eventType === 'payment.failed'
            ? 'failed'
            : 'pending';

      const { data: orderRow } = await adminClient
        .from('payment_orders')
        .update({
          status: newOrderStatus,
          provider_payment_id: paymentEntity.id || null,
          updated_at: new Date().toISOString(),
        })
        .eq('provider_order_id', paymentEntity.order_id)
        .select('split_id')
        .maybeSingle();

      if (orderRow?.split_id && newOrderStatus === 'captured') {
        await adminClient
          .from('expense_splits')
          .update({
            status: 'verified_paid',
            transaction_ref: paymentEntity.id || null,
            paid_at: new Date().toISOString(),
          })
          .eq('id', orderRow.split_id);
      } else if (orderRow?.split_id && newOrderStatus === 'failed') {
        await adminClient
          .from('expense_splits')
          .update({ status: 'failed' })
          .eq('id', orderRow.split_id);
      }
    }

    // Handle Razorpay refund.created / refund.processed / refund.failed events cumulatively
    const refundEntity = (
      payload.payload as {
        refund?: { entity?: { id?: string; payment_id?: string; amount?: number; status?: string } };
      }
    )?.refund?.entity;

    if (
      refundEntity?.id &&
      (eventType === 'refund.created' || eventType === 'refund.processed' || eventType === 'refund.failed')
    ) {
      const nextRefundStatus =
        eventType === 'refund.processed'
          ? 'processed'
          : eventType === 'refund.failed'
            ? 'failed'
            : 'pending';

      const { data: storedRefund } = await adminClient
        .from('payment_refunds')
        .select('id, amount_paise')
        .eq('provider_refund_id', refundEntity.id)
        .maybeSingle();

      const amountMatches =
        !storedRefund ||
        typeof refundEntity.amount !== 'number' ||
        refundEntity.amount === Number(storedRefund.amount_paise);

      await adminClient
        .from('payment_refunds')
        .update({
          status: amountMatches ? nextRefundStatus : 'reconciliation_required',
          reconciliation_status: amountMatches ? 'matched' : 'provider_db_mismatch',
          updated_at: new Date().toISOString(),
        })
        .eq('provider_refund_id', refundEntity.id);

      if (amountMatches && eventType === 'refund.processed' && refundEntity.payment_id) {
        const { data: parentOrder } = await adminClient
          .from('payment_orders')
          .select('id, amount_paise')
          .eq('provider_payment_id', refundEntity.payment_id)
          .maybeSingle();

        if (parentOrder) {
          const { data: processedRows } = await adminClient
            .from('payment_refunds')
            .select('amount_paise')
            .eq('payment_order_id', parentOrder.id)
            .eq('status', 'processed');

          const cumulativeProcessed = (processedRows || []).reduce(
            (sum, row) => sum + Number(row.amount_paise || 0),
            0
          );
          const nextOrderStatus = computeReconciledOrderStatus({
            orderAmountPaise: Number(parentOrder.amount_paise),
            processedRefundsPaise: cumulativeProcessed,
          });

          await adminClient
            .from('payment_orders')
            .update({
              status: nextOrderStatus,
              updated_at: new Date().toISOString(),
            })
            .eq('id', parentOrder.id);
        }
      }
    }

    await adminClient
      .from('payment_webhook_events')
      .update({ processing_status: 'processed', last_error: null })
      .eq('provider', 'razorpay')
      .eq('event_id', eventId);

    return NextResponse.json({ received: true, verified: true, eventId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Payment webhook processing failure';
    await markFailed(msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
