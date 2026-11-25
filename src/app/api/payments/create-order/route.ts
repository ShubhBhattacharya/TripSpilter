import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '../../../../lib/supabase/server';
import { isSupabaseConfigured } from '../../../../lib/supabase/client';
import { requireAuthenticatedUser, UnauthorizedError } from '../../../../lib/security/auth-guards';
import { createServerPaymentOrder } from '../../../../lib/payments/gateway';
import { toPaise } from '../../../../lib/financial/split-engine';

const orderSchema = z.object({
  tripId: z.string().uuid().optional(),
  splitId: z.string().uuid().optional(),
  amountInr: z.number().positive().max(1000000),
  idempotencyKey: z.string().max(100).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = orderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid order parameters' }, { status: 400 });
    }

    const amountPaise = toPaise(parsed.data.amountInr);
    const receiptRef = `ts_${Date.now().toString(36)}`;

    let userId: string | null = null;
    const supabase = isSupabaseConfigured ? await createClient() : null;
    if (supabase) {
      const user = await requireAuthenticatedUser(supabase);
      userId = user.id;

      // Return idempotent existing order if already created with same key
      if (parsed.data.idempotencyKey) {
        const { data: existing } = await supabase
          .from('payment_orders')
          .select('*')
          .eq('user_id', user.id)
          .eq('idempotency_key', parsed.data.idempotencyKey)
          .maybeSingle();
        if (existing) {
          return NextResponse.json({ order: existing, idempotentReplay: true });
        }
      }
    }

    const gatewayResult = await createServerPaymentOrder({
      amountPaise,
      currency: 'INR',
      receiptRef,
      notes: {
        ...(parsed.data.tripId ? { tripId: parsed.data.tripId } : {}),
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
          trip_id: parsed.data.tripId || null,
          split_id: parsed.data.splitId || null,
          provider: gatewayResult.provider,
          provider_order_id: gatewayResult.providerOrderId,
          amount_paise: amountPaise,
          currency: 'INR',
          status: 'created',
          idempotency_key: parsed.data.idempotencyKey || null,
        })
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ...gatewayResult, order: dbOrder }, { status: 201 });
    }

    return NextResponse.json(gatewayResult, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unable to create payment order' },
      { status: 500 }
    );
  }
}
