import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '../../../../lib/supabase/server';
import { isSupabaseConfigured } from '../../../../lib/supabase/client';
import {
  requireAuthenticatedUser,
  UnauthorizedError,
  ForbiddenError,
} from '../../../../lib/security/auth-guards';
import { createServerPaymentRefund } from '../../../../lib/payments/gateway';
import { toPaise } from '../../../../lib/financial/split-engine';
import { checkRateLimit, getClientIdentifier, applyRateLimitHeaders } from '../../../../lib/rate-limit';

const refundSchema = z.object({
  paymentOrderId: z.string().uuid(),
  amountInr: z.number().positive().max(1000000).optional(),
  reason: z.string().min(3).max(200).optional(),
});

export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: 'Payment refunds require Supabase and payment provider credentials', configured: false },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const parsed = refundSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid refund payload' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const user = await requireAuthenticatedUser(supabase);

    const rl = await checkRateLimit(getClientIdentifier('payment_refund', request, user.id), 10, 60000);
    const headers = new Headers();
    applyRateLimitHeaders(headers, rl);
    if (!rl.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers });
    }

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

    if (order.status !== 'captured' || !order.provider_payment_id) {
      return NextResponse.json(
        { error: `Only captured gateway orders can be refunded (current status: ${order.status}).` },
        { status: 400, headers }
      );
    }

    const refundPaise = parsed.data.amountInr ? toPaise(parsed.data.amountInr) : Number(order.amount_paise);
    if (refundPaise > Number(order.amount_paise)) {
      return NextResponse.json(
        { error: 'Refund amount cannot exceed original captured amount.' },
        { status: 400, headers }
      );
    }

    const gatewayRefund = await createServerPaymentRefund({
      providerPaymentId: order.provider_payment_id,
      amountPaise: refundPaise,
      reason: parsed.data.reason,
    });

    const { data: refundRow } = await supabase
      .from('payment_refunds')
      .insert({
        payment_order_id: order.id,
        user_id: user.id,
        trip_id: order.trip_id,
        provider: gatewayRefund.provider === 'razorpay' ? 'razorpay' : order.provider,
        provider_refund_id: gatewayRefund.providerRefundId,
        amount_paise: refundPaise,
        currency: order.currency || 'INR',
        status: gatewayRefund.status,
        reason: parsed.data.reason || null,
      })
      .select('*')
      .maybeSingle();

    if (!gatewayRefund.configured) {
      return NextResponse.json(
        {
          refund: refundRow || null,
          ...gatewayRefund,
        },
        { status: 503, headers }
      );
    }

    return NextResponse.json({ refund: refundRow, ...gatewayRefund }, { status: 201, headers });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Refund initiation failed' },
      { status: 502 }
    );
  }
}
