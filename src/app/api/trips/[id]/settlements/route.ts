import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '../../../../../lib/supabase/server';
import { isSupabaseConfigured } from '../../../../../lib/supabase/client';
import {
  requireAuthenticatedUser,
  requireTripMembership,
  UnauthorizedError,
  ForbiddenError,
} from '../../../../../lib/security/auth-guards';
import { calculateNetBalances, optimizeSettlements, toPaise } from '../../../../../lib/financial/split-engine';
import { dispatchTripNotifications, recordTripActivity } from '../../../../../lib/notifications/server';

const createSettlementSchema = z.object({
  fromUserId: z.string().uuid(),
  toUserId: z.string().uuid(),
  amount: z.number().positive().max(10000000),
  upiRef: z.string().max(100).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Settlements require Supabase configuration', configured: false }, { status: 503 });
  }

  try {
    const supabase = await createClient();
    const user = await requireAuthenticatedUser(supabase);
    await requireTripMembership(supabase, tripId, user.id);

    const [{ data: members }, { data: expenses }, { data: settlements }] = await Promise.all([
      supabase.from('trip_members').select('user_id, profiles(display_name, full_name, upi_id)').eq('trip_id', tripId),
      supabase
        .from('expenses')
        .select('id, paid_by, total_amount, expense_splits(id, expense_id, user_id, amount_owed, status)')
        .eq('trip_id', tripId),
      supabase.from('settlements').select('*').eq('trip_id', tripId).order('created_at', { ascending: false }),
    ]);

    const memberIds = Array.from(new Set((members || []).map((m) => m.user_id)));
    const rawExpenses = (expenses || []).map((e) => ({
      id: e.id,
      paidBy: e.paid_by,
      totalAmount: Number(e.total_amount),
    }));
    const rawSplits = (expenses || []).flatMap((e) =>
      (e.expense_splits || []).map((sp: { id: string; expense_id: string; user_id: string; amount_owed: number; status: string }) => ({
        expenseId: e.id,
        userId: sp.user_id,
        amountOwed: Number(sp.amount_owed),
        status: sp.status,
      }))
    );
    const rawSettlements = (settlements || []).map((st) => ({
      id: st.id,
      fromUserId: st.from_user_id,
      toUserId: st.to_user_id,
      amount: Number(st.amount),
      status: st.status,
    }));

    const { balances, isZeroSum, totalTripSpend } = calculateNetBalances({
      memberIds,
      expenses: rawExpenses,
      splits: rawSplits,
      settlements: rawSettlements,
    });
    const suggestedTransfers = optimizeSettlements(balances);

    return NextResponse.json({
      tripId,
      totalTripSpend,
      isZeroSum,
      balances: Object.values(balances),
      suggestedTransfers,
      recordedSettlements: settlements || [],
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: 'Unable to calculate settlements' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Saving settlements requires Supabase configuration' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = createSettlementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Validation error' }, { status: 400 });
    }

    const supabase = await createClient();
    const user = await requireAuthenticatedUser(supabase);
    await requireTripMembership(supabase, tripId, user.id);

    if (parsed.data.fromUserId !== user.id && parsed.data.toUserId !== user.id) {
      return NextResponse.json({ error: 'Settlement must involve the authenticated user.' }, { status: 403 });
    }
    if (parsed.data.fromUserId === parsed.data.toUserId) {
      return NextResponse.json({ error: 'Payer and recipient cannot be the same user.' }, { status: 400 });
    }

    const { data: participants } = await supabase
      .from('trip_members')
      .select('user_id')
      .eq('trip_id', tripId)
      .in('user_id', [parsed.data.fromUserId, parsed.data.toUserId]);

    if (!participants || participants.length < 2) {
      return NextResponse.json({ error: 'Both settlement participants must be active members of this trip.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('settlements')
      .insert({
        trip_id: tripId,
        from_user_id: parsed.data.fromUserId,
        to_user_id: parsed.data.toUserId,
        amount: parsed.data.amount,
        amount_paise: toPaise(parsed.data.amount),
        status: 'manually_reported_paid',
        upi_ref: parsed.data.upiRef || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await Promise.all([
      dispatchTripNotifications({
        supabase,
        tripId,
        recipientUserIds: [parsed.data.fromUserId, parsed.data.toUserId],
        title: `Settlement reported: ₹${parsed.data.amount.toLocaleString('en-IN')}`,
        message: 'A peer-to-peer settlement transfer was marked as manually paid and awaits recipient verification.',
        type: 'settlement',
        actorUserId: user.id,
      }),
      recordTripActivity({
        supabase,
        tripId,
        userId: user.id,
        actionType: 'SETTLEMENT_REPORTED',
        description: `Settlement of ₹${parsed.data.amount.toLocaleString('en-IN')} reported`,
        metadata: { settlementId: data.id, amount: parsed.data.amount },
      }),
    ]);

    return NextResponse.json({ settlement: data }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: 'Invalid settlement payload' }, { status: 400 });
  }
}
