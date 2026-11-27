import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '../../../../../lib/supabase/server';
import { isSupabaseConfigured } from '../../../../../lib/supabase/client';
import {
  requireAuthenticatedUser,
  requireTripMembership,
  requireTripAdmin,
  UnauthorizedError,
  ForbiddenError,
} from '../../../../../lib/security/auth-guards';
import { evaluateMemberRemovalSafety } from '../../../../../lib/financial/split-engine';
import { recordTripActivity } from '../../../../../lib/notifications/server';

const rolePatchSchema = z.object({
  memberUserId: z.string().uuid(),
  role: z.enum(['member', 'admin']),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Supabase configuration required', configured: false }, { status: 503 });
  }

  try {
    const supabase = await createClient();
    const user = await requireAuthenticatedUser(supabase);
    await requireTripMembership(supabase, tripId, user.id);

    const { data, error } = await supabase
      .from('trip_members')
      .select('id, trip_id, user_id, role, joined_at, profiles(id, display_name, full_name, upi_id, avatar_url)')
      .eq('trip_id', tripId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ members: data || [] });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: 'Unable to load trip members' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Supabase configuration required' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = rolePatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid role payload' }, { status: 400 });
    }

    const supabase = await createClient();
    const user = await requireAuthenticatedUser(supabase);
    await requireTripAdmin(supabase, tripId, user.id);

    const { data, error } = await supabase
      .from('trip_members')
      .update({ role: parsed.data.role })
      .eq('trip_id', tripId)
      .eq('user_id', parsed.data.memberUserId)
      .select('*')
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Member not found in trip' }, { status: 404 });

    return NextResponse.json({ member: data });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: 'Unable to update member role' }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Supabase configuration required' }, { status: 503 });
  }

  try {
    const targetMemberId = new URL(request.url).searchParams.get('userId');
    const supabase = await createClient();
    const user = await requireAuthenticatedUser(supabase);

    const memberIdToRemove = targetMemberId || user.id;
    const isSelfLeave = memberIdToRemove === user.id;

    if (!isSelfLeave) {
      await requireTripAdmin(supabase, tripId, user.id);
    } else {
      await requireTripMembership(supabase, tripId, user.id);
    }

    const [{ data: members }, { data: expenses }, { data: settlements }] = await Promise.all([
      supabase.from('trip_members').select('user_id').eq('trip_id', tripId),
      supabase.from('expenses').select('id, paid_by, total_amount, expense_splits(user_id, amount_owed, status)').eq('trip_id', tripId),
      supabase.from('settlements').select('id, from_user_id, to_user_id, amount, status').eq('trip_id', tripId),
    ]);

    const safety = evaluateMemberRemovalSafety({
      memberIdToRemove,
      memberIds: Array.from(new Set((members || []).map((m) => String(m.user_id)))),
      expenses: (expenses || []).map((e) => ({
        id: String(e.id),
        paidBy: String(e.paid_by),
        totalAmount: Number(e.total_amount),
      })),
      splits: (expenses || []).flatMap((e) =>
        (e.expense_splits || []).map((sp: { user_id: string; amount_owed: number; status: string }) => ({
          expenseId: String(e.id),
          userId: String(sp.user_id),
          amountOwed: Number(sp.amount_owed),
          status: String(sp.status),
        }))
      ),
      settlements: (settlements || []).map((st) => ({
        id: String(st.id),
        fromUserId: String(st.from_user_id),
        toUserId: String(st.to_user_id),
        amount: Number(st.amount),
        status: String(st.status),
      })),
    });

    if (!safety.canRemoveSafely) {
      return NextResponse.json(
        { error: safety.reason || 'Member has unsettled balances', outstandingNetRupees: safety.outstandingNetRupees },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from('trip_members')
      .delete()
      .eq('trip_id', tripId)
      .eq('user_id', memberIdToRemove);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await recordTripActivity({
      supabase,
      tripId,
      userId: user.id,
      actionType: isSelfLeave ? 'MEMBER_LEFT_TRIP' : 'MEMBER_REMOVED',
      description: isSelfLeave ? 'Member left trip after settling balances' : `Removed member ${memberIdToRemove.slice(0, 8)}`,
    });

    return NextResponse.json({ removed: true, tripId, userId: memberIdToRemove });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: 'Unable to remove trip member' }, { status: 500 });
  }
}
