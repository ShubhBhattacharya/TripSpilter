import { NextResponse } from 'next/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { verifyWebhookSignature } from '../../../../lib/payments/gateway';
import { getServerServiceRoleKey, isValidSupabaseConfig } from '../../../../lib/config/env';
import { computeReconciledOrderStatus } from '../../../../lib/financial/refund-engine';

export const runtime = 'nodejs';

/**
 * Authorized Server Payment Webhook Endpoint
 * - Verifies HMAC-SHA256 provider signature cleanly
 * - Enforces duplicate webhook idempotency via unique (provider, event_id)
 * - Uses server-only SUPABASE_SERVICE_ROLE_KEY to update verified payment_orders & expense_splits
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

  // Deduplicate webhook replay
  const { error: insertEventErr } = await adminClient.from('payment_webhook_events').insert({
    provider: 'razorpay',
    event_id: eventId,
    event_type: eventType,
    signature_verified: true,
    payload,
  });

  if (insertEventErr && insertEventErr.code === '23505') {
    return NextResponse.json({ received: true, duplicateReplay: true });
  }

  // Handle Razorpay payment.captured / payment.failed events
  const paymentEntity = (
    payload.payload as { payment?: { entity?: { id?: string; order_id?: string; status?: string } } }
  )?.payment?.entity;

  if (paymentEntity?.order_id) {
    const newOrderStatus = eventType === 'payment.captured' ? 'captured' : eventType === 'payment.failed' ? 'failed' : 'pending';
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
    payload.payload as { refund?: { entity?: { id?: string; payment_id?: string; status?: string } } }
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

    await adminClient
      .from('payment_refunds')
      .update({
        status: nextRefundStatus,
        reconciliation_status: 'matched',
        updated_at: new Date().toISOString(),
      })
      .eq('provider_refund_id', refundEntity.id);

    if (eventType === 'refund.processed' && refundEntity.payment_id) {
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

  return NextResponse.json({ received: true, verified: true, eventId });
}
