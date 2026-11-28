import { NextResponse } from 'next/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { verifyWebhookSignature, validateWebhookTimestamp } from '../../../../lib/payments/gateway';
import { getServerServiceRoleKey, isValidSupabaseConfig } from '../../../../lib/config/env';

export const runtime = 'nodejs';

const STALE_PROCESSING_TIMEOUT_SECONDS = 300;

interface ProcessWebhookRpcResult {
  status?: 'processed' | 'duplicate_replay' | 'in_progress' | 'validation_error';
  httpStatus?: number;
  error?: string;
  eventId?: string;
  reclaimedStale?: boolean;
}

/**
 * Authorized Server Payment Webhook Endpoint
 * - Verifies HMAC-SHA256 provider signature and replay timestamp window
 * - Fails closed (503) if Supabase config or service_role key is unavailable
 * - Executes event deduplication, stale-lock reclaim (>5m), order/split/refund updates,
 *   and event completion inside a single atomic DB transaction via process_payment_webhook()
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

  const serviceRoleKey = getServerServiceRoleKey();
  if (!isValidSupabaseConfig() || !serviceRoleKey) {
    return NextResponse.json(
      {
        persisted: false,
        error: 'Payment webhook persistence unavailable: Supabase configuration or service role key missing.',
      },
      { status: 503 }
    );
  }

  const eventType = String(payload.event || 'unknown');
  const eventId =
    request.headers.get('x-razorpay-event-id') ||
    String((payload as { id?: string }).id || `${eventType}_${Date.now()}`);

  const adminClient = createSupabaseAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);

  try {
    const { data, error } = await adminClient.rpc('process_payment_webhook', {
      p_provider: 'razorpay',
      p_event_id: eventId,
      p_event_type: eventType,
      p_payload: payload,
      p_stale_after_seconds: STALE_PROCESSING_TIMEOUT_SECONDS,
    });

    if (error) {
      return NextResponse.json({ error: error.message || 'Webhook transaction failed' }, { status: 500 });
    }

    const result = (data || {}) as ProcessWebhookRpcResult;
    if (result.status === 'duplicate_replay') {
      return NextResponse.json({ received: true, duplicateReplay: true, eventId });
    }
    if (result.status === 'in_progress') {
      return NextResponse.json({ error: 'Webhook delivery currently processing' }, { status: 409 });
    }
    if (result.status === 'validation_error') {
      return NextResponse.json(
        { error: result.error || 'Webhook payload validation failed' },
        { status: Number(result.httpStatus) || 422 }
      );
    }

    return NextResponse.json({
      received: true,
      persisted: true,
      eventId,
      reclaimedStale: Boolean(result.reclaimedStale),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Payment webhook processing failure';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
