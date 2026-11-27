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

const uuidSchema = z.string().uuid();

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
  if (!uuidSchema.safeParse(tripId).success) {
    return NextResponse.json({ error: 'Invalid trip UUID' }, { status: 400 });
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
  if (!uuidSchema.safeParse(tripId).success) {
    return NextResponse.json({ error: 'Invalid trip UUID' }, { status: 400 });
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

    if (parsed.data.role === 'member') {
      const { data: currentMembers } = await supabase
        .from('trip_members')
        .select('user_id, role')
        .eq('trip_id', tripId);

      const targetMember = (currentMembers || []).find((m) => String(m.user_id) === parsed.data.memberUserId);
      if (!targetMember) {
        return NextResponse.json({ error: 'Member not found in trip' }, { status: 404 });
      }
      const otherAdmins = (currentMembers || []).filter(
        (m) => String(m.role) === 'admin' && String(m.user_id) !== parsed.data.memberUserId
      );
      if (String(targetMember.role) === 'admin' && otherAdmins.length === 0) {
        return NextResponse.json(
          { error: 'Cannot demote the last remaining trip admin. Promote another member to admin first.' },
          { status: 409 }
        );
      }
    }

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
  if (!uuidSchema.safeParse(tripId).success) {
    return NextResponse.json({ error: 'Invalid trip UUID' }, { status: 400 });
  }

  try {
    const targetMemberId = new URL(request.url).searchParams.get('userId');
    if (targetMemberId && !uuidSchema.safeParse(targetMemberId).success) {
      return NextResponse.json({ error: 'Invalid target userId UUID' }, { status: 400 });
    }
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
      supabase.from('trip_members').select('user_id, role').eq('trip_id', tripId),
      supabase.from('expenses').select('id, paid_by, total_amount, expense_splits(user_id, amount_owed, status)').eq('trip_id', tripId),
      supabase.from('settlements').select('id, from_user_id, to_user_id, amount, status').eq('trip_id', tripId),
    ]);

    const targetRow = (members || []).find((m) => String(m.user_id) === memberIdToRemove);
    if (!targetRow) {
      return NextResponse.json({ error: 'Member not found in trip' }, { status: 404 });
    }
    const remainingAdmins = (members || []).filter(
      (m) => String(m.role) === 'admin' && String(m.user_id) !== memberIdToRemove
    );
    if (String(targetRow.role) === 'admin' && remainingAdmins.length === 0) {
      return NextResponse.json(
        { error: 'The last remaining trip admin cannot leave or be removed without appointing another admin first.' },
        { status: 409 }
      );
    }

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
