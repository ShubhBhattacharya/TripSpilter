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
import { createServerPaymentOrder } from '../../../../lib/payments/gateway';
import { toPaise } from '../../../../lib/financial/split-engine';
import { checkRateLimit, getClientIdentifier, applyRateLimitHeaders } from '../../../../lib/rate-limit';

const orderSchema = z.object({
  tripId: z.string().uuid().optional(),
  splitId: z.string().uuid().optional(),
  amountInr: z.number().positive().max(1000000).optional(),
  idempotencyKey: z.string().max(100).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = orderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid order parameters' },
        { status: 400 }
      );
    }

    let userId: string | null = null;
    let authoritativeAmountPaise = parsed.data.amountInr ? toPaise(parsed.data.amountInr) : 0;
    let resolvedTripId = parsed.data.tripId || null;

    const supabase = isSupabaseConfigured ? await createClient() : null;
    if (supabase) {
      const user = await requireAuthenticatedUser(supabase);
      userId = user.id;

      const rateLimit = await checkRateLimit(getClientIdentifier('payment_order', request, user.id), 15, 60000);
      const headers = new Headers();
      applyRateLimitHeaders(headers, rateLimit);
      if (!rateLimit.success) {
        return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers });
      }

      // Authoritative DB amount lookup when splitId is supplied (never trust frontend price!)
      if (parsed.data.splitId) {
        const { data: splitRow, error: splitErr } = await supabase
          .from('expense_splits')
          .select('id, user_id, amount_owed, amount_owed_paise, expenses!inner(trip_id)')
          .eq('id', parsed.data.splitId)
          .maybeSingle();

        if (splitErr || !splitRow) {
          return NextResponse.json({ error: 'Expense split not found' }, { status: 404, headers });
        }

        const parentExpense = splitRow.expenses as unknown as { trip_id: string };
        resolvedTripId = parentExpense.trip_id;
        await requireTripMembership(supabase, resolvedTripId, user.id);

        if (splitRow.user_id !== user.id) {
          return NextResponse.json(
            { error: 'Only the debtor member may initiate payment for this split.' },
            { status: 403, headers }
          );
        }

        authoritativeAmountPaise =
          splitRow.amount_owed_paise || toPaise(Number(splitRow.amount_owed));
      } else if (resolvedTripId) {
        await requireTripMembership(supabase, resolvedTripId, user.id);
      }

      if (parsed.data.idempotencyKey) {
        const { data: existing } = await supabase
          .from('payment_orders')
          .select('*')
          .eq('user_id', user.id)
          .eq('idempotency_key', parsed.data.idempotencyKey)
          .maybeSingle();
        if (existing) {
          return NextResponse.json({ order: existing, idempotentReplay: true }, { headers });
        }
      }
    } else {
      const rl = await checkRateLimit(getClientIdentifier('payment_order', request), 15, 60000);
      if (!rl.success) {
        return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
      }
    }

    if (authoritativeAmountPaise <= 0) {
      return NextResponse.json(
        { error: 'Valid positive payment amount or splitId is required.' },
        { status: 400 }
      );
    }

    const receiptRef = `ts_${Date.now().toString(36)}`;
    const gatewayResult = await createServerPaymentOrder({
      amountPaise: authoritativeAmountPaise,
      currency: 'INR',
      receiptRef,
      notes: {
        ...(resolvedTripId ? { tripId: resolvedTripId } : {}),
        ...(parsed.data.splitId ? { splitId: parsed.data.splitId } : {}),
      },
    });

    if (!gatewayResult.configured) {
      return NextResponse.json(gatewayResult, { status: 200 });
    }

    if (supabase && userId) {
      const { data: dbOrder, error } = await supabase
        .from('payment_orders')
        .insert({
          user_id: userId,
          trip_id: resolvedTripId,
          split_id: parsed.data.splitId || null,
          provider: gatewayResult.provider,
          provider_order_id: gatewayResult.providerOrderId,
          amount_paise: authoritativeAmountPaise,
          currency: 'INR',
          status: 'created',
          idempotency_key: parsed.data.idempotencyKey || null,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505' && parsed.data.idempotencyKey) {
          const { data: winningOrder } = await supabase
            .from('payment_orders')
            .select('*')
            .eq('user_id', userId)
            .eq('idempotency_key', parsed.data.idempotencyKey)
            .maybeSingle();
          if (winningOrder) {
            return NextResponse.json({ order: winningOrder, idempotentReplay: true });
          }
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ...gatewayResult, order: dbOrder }, { status: 201 });
    }

    return NextResponse.json(gatewayResult, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unable to create payment order' },
      { status: 500 }
    );
  }
}
