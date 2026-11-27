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
import { calculateEqualSplit, toPaise } from '../../../../lib/financial/split-engine';
import { upiIdRegex } from '../../../../lib/validations/api';
import { dispatchTripNotifications, recordTripActivity } from '../../../../lib/notifications/server';

const updateExpenseSchema = z.object({
  vendorName: z.string().min(1).max(100).optional(),
  vendorUpiId: z.string().regex(upiIdRegex, 'Invalid Indian UPI ID format').optional(),
  totalAmount: z.number().positive().max(10000000).optional(),
  splitType: z.enum(['EQUAL', 'EXACT', 'PERCENTAGE', 'ITEMIZED']).optional(),
  notes: z.string().max(250).optional(),
  splits: z
    .array(
      z.object({
        userId: z.string().uuid(),
        amountOwed: z.number().min(0),
      })
    )
    .min(1)
    .optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: expenseId } = await params;
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Editing expenses requires Supabase configuration' }, { status: 503 });
  }
  if (!z.string().uuid().safeParse(expenseId).success) {
    return NextResponse.json({ error: 'Invalid expense UUID' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = updateExpenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Validation error' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const user = await requireAuthenticatedUser(supabase);

    const { data: expense } = await supabase
      .from('expenses')
      .select('id, trip_id, paid_by, vendor_name, vendor_upi_id, total_amount, total_amount_paise, split_type, notes, expense_splits(id, user_id, amount_owed, amount_owed_paise)')
      .eq('id', expenseId)
      .maybeSingle();

    if (!expense) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });

    const membership = await requireTripMembership(supabase, expense.trip_id, user.id);
    if (expense.paid_by !== user.id && !membership.isAdmin) {
      return NextResponse.json({ error: 'Only payer or trip admin can modify this expense.' }, { status: 403 });
    }

    const nextTotal = parsed.data.totalAmount ?? Number(expense.total_amount);
    const nextTotalPaise = toPaise(nextTotal);
    const existingSplits = (expense.expense_splits || []) as Array<{
      id: string;
      user_id: string;
      amount_owed: number;
      amount_owed_paise: number;
    }>;

    // Resolve target splits in integer paise ensuring zero-tolerance Sum(splits) === totalAmount
    let targetSplits: Array<{ userId: string; amountOwed: number; amountOwedPaise: number }> | null = null;
    if (parsed.data.splits) {
      targetSplits = parsed.data.splits.map((s) => ({
        userId: s.userId,
        amountOwed: s.amountOwed,
        amountOwedPaise: toPaise(s.amountOwed),
      }));
      const splitSumPaise = targetSplits.reduce((acc, s) => acc + s.amountOwedPaise, 0);
      if (splitSumPaise !== nextTotalPaise) {
        return NextResponse.json(
          {
            error: `Sum of updated splits (₹${(splitSumPaise / 100).toFixed(2)}) must equal total bill (₹${(nextTotalPaise / 100).toFixed(2)}).`,
          },
          { status: 400 }
        );
      }
    } else if (parsed.data.totalAmount !== undefined && existingSplits.length > 0) {
      const recalculated = calculateEqualSplit({
        totalAmount: parsed.data.totalAmount,
        memberIds: existingSplits.map((s) => s.user_id),
      });
      targetSplits = recalculated.map((s) => ({
        userId: s.memberId,
        amountOwed: s.amount,
        amountOwedPaise: s.amountPaise,
      }));
    }

    // Prefer atomic update_expense_with_splits RPC when splits change
    if (targetSplits) {
      const rpcSplits = targetSplits;
      const { data: rpcUpdated, error: rpcErr } = await supabase.rpc('update_expense_with_splits', {
        p_expense_id: expenseId,
        p_vendor_name: parsed.data.vendorName || expense.vendor_name,
        p_vendor_upi_id: parsed.data.vendorUpiId || expense.vendor_upi_id,
        p_total_amount: nextTotal,
        p_total_amount_paise: nextTotalPaise,
        p_split_type: parsed.data.splitType || expense.split_type,
        p_notes: parsed.data.notes !== undefined ? parsed.data.notes : expense.notes,
        p_splits: rpcSplits,
      });

      if (!rpcErr && rpcUpdated) {
        await Promise.all([
          dispatchTripNotifications({
            supabase,
            tripId: expense.trip_id,
            recipientUserIds: rpcSplits.map((s) => s.userId),
            title: `Expense updated: ${parsed.data.vendorName || expense.vendor_name}`,
            message: `Updated bill total is ₹${nextTotal.toLocaleString('en-IN')}.`,
            type: 'expense',
            actorUserId: user.id,
          }),
          recordTripActivity({
            supabase,
            tripId: expense.trip_id,
            userId: user.id,
            actionType: 'EXPENSE_UPDATED',
            description: `Edited expense "${parsed.data.vendorName || expense.vendor_name}" (₹${nextTotal.toLocaleString('en-IN')})`,
            metadata: { expenseId, totalAmountPaise: nextTotalPaise },
          }),
        ]);
        return NextResponse.json(rpcUpdated);
      }
    }

    const patch: Record<string, unknown> = {};
    if (parsed.data.vendorName !== undefined) patch.vendor_name = parsed.data.vendorName;
    if (parsed.data.vendorUpiId !== undefined) patch.vendor_upi_id = parsed.data.vendorUpiId;
    if (parsed.data.splitType !== undefined) patch.split_type = parsed.data.splitType;
    if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes;
    if (parsed.data.totalAmount !== undefined) {
      patch.total_amount = parsed.data.totalAmount;
      patch.total_amount_paise = nextTotalPaise;
    }

    if (targetSplits) {
      for (const share of targetSplits) {
        const existingRow = existingSplits.find((es) => es.user_id === share.userId);
        if (existingRow) {
          await supabase
            .from('expense_splits')
            .update({
              amount_owed: share.amountOwed,
              amount_owed_paise: share.amountOwedPaise,
            })
            .eq('id', existingRow.id);
        }
      }
    }

    const { data, error } = await supabase
      .from('expenses')
      .update(patch)
      .eq('id', expenseId)
      .select('*, expense_splits(*)')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await recordTripActivity({
      supabase,
      tripId: expense.trip_id,
      userId: user.id,
      actionType: 'EXPENSE_UPDATED',
      description: `Edited expense "${parsed.data.vendorName || expense.vendor_name}"`,
      metadata: { expenseId },
    });

    return NextResponse.json({ expense: data });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: 'Invalid expense update' }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: expenseId } = await params;
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Deleting expenses requires Supabase configuration' }, { status: 503 });
  }
  if (!z.string().uuid().safeParse(expenseId).success) {
    return NextResponse.json({ error: 'Invalid expense UUID' }, { status: 400 });
  }

  try {
    const confirmed = new URL(request.url).searchParams.get('confirm') === 'true';
    if (!confirmed) {
      return NextResponse.json({ error: 'Explicit ?confirm=true required to delete expense.' }, { status: 400 });
    }

    const supabase = await createClient();
    const user = await requireAuthenticatedUser(supabase);

    const { data: expense } = await supabase
      .from('expenses')
      .select('id, trip_id, paid_by')
      .eq('id', expenseId)
      .maybeSingle();

    if (!expense) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });

    const membership = await requireTripMembership(supabase, expense.trip_id, user.id);
    if (expense.paid_by !== user.id && !membership.isAdmin) {
      return NextResponse.json({ error: 'Only payer or trip admin can delete this expense.' }, { status: 403 });
    }

    const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await recordTripActivity({
      supabase,
      tripId: expense.trip_id,
      userId: user.id,
      actionType: 'EXPENSE_DELETED',
      description: `Deleted expense (${expenseId.slice(0, 8)}) after confirmation`,
      metadata: { expenseId },
    });

    return NextResponse.json({ deleted: true, expenseId });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: 'Unable to delete expense' }, { status: 500 });
  }
}
