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
import { createServerPaymentRefund } from '../../../../lib/payments/gateway';
import { toPaise } from '../../../../lib/financial/split-engine';
import {
  calculateReservedAndProcessedPaise,
  validateRefundRequest,
} from '../../../../lib/financial/refund-engine';
import { dispatchTripNotifications, recordTripActivity } from '../../../../lib/notifications/server';
import { checkRateLimit, getClientIdentifier, applyRateLimitHeaders } from '../../../../lib/rate-limit';

const refundSchema = z.object({
  paymentOrderId: z.string().uuid(),
  amountInr: z.number().positive().max(1000000).optional(),
  reason: z.string().min(3).max(200).optional(),
  idempotencyKey: z.string().min(4).max(100).optional(),
});

function isMissingRpcError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const code = err.code || '';
  const msg = (err.message || '').toLowerCase();
  return code === 'PGRST202' || code === '42883' || msg.includes('reserve_payment_refund') || msg.includes('could not find the function');
}

export async function GET(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ refunds: [], configured: false });
  }

  try {
    const url = new URL(request.url);
    const paymentOrderId = url.searchParams.get('paymentOrderId');
    const tripId = url.searchParams.get('tripId');

    const supabase = await createClient();
    const user = await requireAuthenticatedUser(supabase);

    let orderAmountPaise: number | null = null;
    let query = supabase
      .from('payment_refunds')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (paymentOrderId) {
      const { data: orderRow, error: orderErr } = await supabase
        .from('payment_orders')
        .select('id, user_id, trip_id, amount_paise')
        .eq('id', paymentOrderId)
        .maybeSingle();

      if (orderErr || !orderRow) {
        return NextResponse.json({ error: 'Payment order not found' }, { status: 404 });
      }
      if (orderRow.user_id !== user.id) {
        if (!orderRow.trip_id) {
          return NextResponse.json(
            { error: 'Unauthorized: you cannot access refund history for another user.' },
            { status: 403 }
          );
        }
        await requireTripMembership(supabase, orderRow.trip_id, user.id);
      }
      orderAmountPaise = Number(orderRow.amount_paise);
      query = query.eq('payment_order_id', paymentOrderId);
    } else if (tripId) {
      await requireTripMembership(supabase, tripId, user.id);
      query = query.eq('trip_id', tripId);
    } else {
      query = query.eq('user_id', user.id);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = data || [];
    const summary = calculateReservedAndProcessedPaise(
      rows.map((r) => ({ id: String(r.id), amountPaise: Number(r.amount_paise), status: String(r.status) }))
    );

    const remainingRefundablePaise =
      orderAmountPaise !== null ? Math.max(0, orderAmountPaise - summary.reservedTotalPaise) : null;

    return NextResponse.json({ refunds: rows, summary, remainingRefundablePaise, configured: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: 'Unable to load refund history' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: 'Payment refunds require Supabase and payment provider credentials', configured: false },
      { status: 503 }
    );
  }

  const headers = new Headers();

  try {
    const headerIdemKey = request.headers.get('idempotency-key')?.trim();
    const body = await request.json();
    const parsed = refundSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid refund payload' },
        { status: 400 }
      );
    }

    const idempotencyKey = headerIdemKey || parsed.data.idempotencyKey;
    const supabase = await createClient();
    const user = await requireAuthenticatedUser(supabase);

    const rl = await checkRateLimit(getClientIdentifier('payment_refund', request, user.id), 10, 60000);
    applyRateLimitHeaders(headers, rl);
    if (!rl.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers });
    }

    // 1. Authoritative order lookup & ownership check
    const { data: order, error: orderErr } = await supabase
      .from('payment_orders')
      .select('*')
      .eq('id', parsed.data.paymentOrderId)
      .maybeSingle();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Payment order not found' }, { status: 404, headers });
    }

    if (order.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Only the original payer can initiate a refund request for this order.' },
        { status: 403, headers }
      );
    }

    const { data: existingRefundRows, error: existingErr } = await supabase
      .from('payment_refunds')
      .select('id, amount_paise, status, idempotency_key')
      .eq('payment_order_id', order.id);

    if (existingErr) {
      return NextResponse.json({ error: existingErr.message }, { status: 500, headers });
    }

    const existingList = (existingRefundRows || []).map((r) => ({
      id: String(r.id),
      amountPaise: Number(r.amount_paise),
      status: String(r.status),
    }));

    if (idempotencyKey) {
      const replay = (existingRefundRows || []).find((r) => r.idempotency_key === idempotencyKey);
      if (replay) {
        headers.set('X-Idempotent-Replay', 'true');
        return NextResponse.json({ refund: replay, idempotentReplay: true }, { status: 200, headers });
      }
    }

    const { reservedTotalPaise } = calculateReservedAndProcessedPaise(existingList);
    const defaultRemaining = Math.max(0, Number(order.amount_paise) - reservedTotalPaise);
    const refundPaise = parsed.data.amountInr ? toPaise(parsed.data.amountInr) : defaultRemaining;

    const validation = validateRefundRequest({
      orderStatus: String(order.status),
      orderAmountPaise: Number(order.amount_paise),
      requestedPaise: refundPaise,
      existingRefunds: existingList,
    });

    if (!validation.allowed || !order.provider_payment_id) {
      return NextResponse.json(
        {
          error:
            validation.error ||
            'Missing verified provider_payment_id on order; cannot execute refund.',
          remainingRefundablePaise: validation.remainingRefundablePaise,
        },
        { status: 400, headers }
      );
    }

    // 2. FAIL-CLOSED Atomic Row-Locked DB Reservation BEFORE calling external payment provider
    // Never bypass row locking with a non-atomic direct INSERT fallback!
    const { data: rpcReserve, error: rpcReserveErr } = await supabase.rpc('reserve_payment_refund', {
      p_payment_order_id: order.id,
      p_amount_paise: refundPaise,
      p_reason: parsed.data.reason || null,
      p_idempotency_key: idempotencyKey || null,
    });

    if (rpcReserveErr || !rpcReserve) {
      if (isMissingRpcError(rpcReserveErr)) {
        return NextResponse.json(
          {
            error:
              'Refunds BLOCKED: atomic reserve_payment_refund RPC is not deployed on the database. Apply migration 20261126_95_market_readiness_final.sql first.',
            status: 'blocked_missing_rpc',
            migrationRequired: 'supabase/migrations/20261126_95_market_readiness_final.sql',
          },
          { status: 503, headers }
        );
      }
      const code = rpcReserveErr?.code;
      const status = code === '42501' ? 403 : code === 'P0002' ? 404 : code === '22003' || code === '22000' ? 409 : 500;
      return NextResponse.json(
        { error: rpcReserveErr?.message || 'Atomic refund reservation rejected' },
        { status, headers }
      );
    }

    if (rpcReserve.isIdempotentReplay) {
      headers.set('X-Idempotent-Replay', 'true');
      return NextResponse.json(
        { refund: rpcReserve.refund, idempotentReplay: true },
        { status: 200, headers }
      );
    }

    const reservedRefund = rpcReserve.refund as Record<string, unknown>;
    const refundId = String(reservedRefund.id);

    // 3. Call external payment provider after durable row-locked reservation exists
    let gatewayRefund;
    try {
      gatewayRefund = await createServerPaymentRefund({
        providerPaymentId: order.provider_payment_id,
        amountPaise: refundPaise,
        reason: parsed.data.reason,
        idempotencyKey,
      });
    } catch (gatewayErr) {
      const errMsg = gatewayErr instanceof Error ? gatewayErr.message : 'Provider call failed';
      await supabase.rpc('finalize_payment_refund', {
        p_refund_id: refundId,
        p_new_status: 'failed',
        p_provider_refund_id: null,
        p_error_message: errMsg,
        p_reconciliation_status: 'not_applicable',
      });
      return NextResponse.json({ error: errMsg, refundId }, { status: 502, headers });
    }

    if (!gatewayRefund.configured) {
      await supabase.rpc('finalize_payment_refund', {
        p_refund_id: refundId,
        p_new_status: 'waiting_for_credentials',
        p_provider_refund_id: null,
        p_error_message: gatewayRefund.disclaimer,
        p_reconciliation_status: 'not_applicable',
      });
      return NextResponse.json({ refundId, ...gatewayRefund }, { status: 503, headers });
    }

    // 4. Reconcile provider refund result back into Postgres
    const { data: finalizedRow, error: finalizeErr } = await supabase.rpc('finalize_payment_refund', {
      p_refund_id: refundId,
      p_new_status: gatewayRefund.status,
      p_provider_refund_id: gatewayRefund.providerRefundId,
      p_error_message: null,
      p_reconciliation_status: 'matched',
    });

    if (finalizeErr || !finalizedRow) {
      return NextResponse.json(
        {
          error:
            finalizeErr?.message ||
            'Provider accepted refund but database reconciliation failed. Manual/webhook reconciliation required.',
          reconciliationRequired: true,
          refundId,
          providerRefundId: gatewayRefund.providerRefundId,
        },
        { status: 502, headers }
      );
    }

    await Promise.all([
      order.trip_id
        ? recordTripActivity({
            supabase,
            tripId: order.trip_id,
            userId: user.id,
            actionType: 'PAYMENT_REFUND_INITIATED',
            description: `Initiated ₹${(refundPaise / 100).toFixed(2)} refund (${gatewayRefund.status})`,
            metadata: { refundId, providerRefundId: gatewayRefund.providerRefundId },
          })
        : Promise.resolve(),
      dispatchTripNotifications({
        supabase,
        tripId: order.trip_id,
        recipientUserIds: [user.id],
        includeActor: true,
        title: `Refund ${gatewayRefund.status}: ₹${(refundPaise / 100).toFixed(2)}`,
        message: 'Your gateway refund was logged and awaits final settlement webhook reconciliation.',
        type: 'payment',
        actorUserId: user.id,
      }),
    ]);

    return NextResponse.json({ refund: finalizedRow, ...gatewayRefund }, { status: 201, headers });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Refund initiation failed' },
      { status: 500, headers }
    );
  }
}
