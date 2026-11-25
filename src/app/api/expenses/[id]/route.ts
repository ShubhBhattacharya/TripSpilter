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
import { toPaise } from '../../../../lib/financial/split-engine';

const updateExpenseSchema = z.object({
  vendorName: z.string().min(1).max(100).optional(),
  totalAmount: z.number().positive().max(10000000).optional(),
  notes: z.string().max(250).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: expenseId } = await params;
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Editing expenses requires Supabase configuration' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = updateExpenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Validation error' }, { status: 400 });
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
      return NextResponse.json({ error: 'Only payer or trip admin can modify this expense.' }, { status: 403 });
    }

    const patch: Record<string, unknown> = {};
    if (parsed.data.vendorName !== undefined) patch.vendor_name = parsed.data.vendorName;
    if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes;
    if (parsed.data.totalAmount !== undefined) {
      patch.total_amount = parsed.data.totalAmount;
      patch.total_amount_paise = toPaise(parsed.data.totalAmount);
    }

    const { data, error } = await supabase
      .from('expenses')
      .update(patch)
      .eq('id', expenseId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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

    return NextResponse.json({ deleted: true, expenseId });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: 'Unable to delete expense' }, { status: 500 });
  }
}
