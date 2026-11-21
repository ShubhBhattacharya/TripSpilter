import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { isSupabaseConfigured } from '../../../lib/supabase/client';
import { createExpenseSchema } from '../../../lib/validations/api';
import { checkRateLimit, getClientIp } from '../../../lib/rate-limit';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tripId = searchParams.get('tripId');

  if (!tripId) {
    return NextResponse.json({ error: 'tripId query parameter is required' }, { status: 400 });
  }

  if (!isSupabaseConfigured) {
    return NextResponse.json({
      message: 'Demo mode expenses',
      expenses: [],
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: expenses, error: fetchError } = await supabase
    .from('expenses')
    .select(`
      *,
      paid_by_profile:profiles!expenses_paid_by_fkey (
        id,
        display_name,
        upi_id,
        avatar_url
      ),
      expense_splits (
        id,
        user_id,
        amount_owed,
        status,
        paid_at,
        transaction_ref,
        profile:profiles!expense_splits_user_id_fkey (
          id,
          display_name,
          upi_id,
          avatar_url
        )
      )
    `)
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false });

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  return NextResponse.json({ expenses });
}

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  const rateLimit = checkRateLimit(`expense_create_${clientIp}`, 20, 60000);

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: `Too many expense creations. Please wait ${rateLimit.reset}s.` },
      { status: 429 }
    );
  }

  try {
    const rawBody = await request.json();
    const validation = createExpenseSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation Error',
          details: validation.error.issues.map((i) => i.message),
        },
        { status: 400 }
      );
    }

    const { tripId, vendorName, vendorUpiId, totalAmount, splitType, notes, splits } =
      validation.data;

    // Validate splits sum
    const totalSplitSum = splits.reduce((acc, s) => acc + s.amountOwed, 0);
    // Allow slight 1-2 rupee rounding difference
    if (Math.abs(totalSplitSum - totalAmount) > 2) {
      return NextResponse.json(
        {
          error: `Sum of member shares (₹${totalSplitSum}) does not equal total bill amount (₹${totalAmount})`,
        },
        { status: 400 }
      );
    }

    if (!isSupabaseConfigured) {
      return NextResponse.json(
        {
          message: 'Expense created in demo mode',
          expense: {
            id: `exp-${Date.now()}`,
            tripId,
            vendorName,
            vendorUpiId,
            totalAmount,
            splitType,
            notes,
            splits,
          },
        },
        { status: 201 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Create main expense record
    const { data: expenseRecord, error: expenseError } = await supabase
      .from('expenses')
      .insert({
        trip_id: tripId,
        paid_by: user.id,
        vendor_name: vendorName,
        vendor_upi_id: vendorUpiId,
        total_amount: totalAmount,
        split_type: splitType,
        notes,
      })
      .select()
      .single();

    if (expenseError) {
      return NextResponse.json({ error: expenseError.message }, { status: 500 });
    }

    // 2. Batch insert splits for all participating members
    const splitsToInsert = splits.map((s) => ({
      expense_id: expenseRecord.id,
      user_id: s.userId,
      amount_owed: s.amountOwed,
      status: s.userId === user.id ? 'paid' : 'pending',
      paid_at: s.userId === user.id ? new Date().toISOString() : null,
    }));

    const { error: splitsError } = await supabase
      .from('expense_splits')
      .insert(splitsToInsert);

    if (splitsError) {
      return NextResponse.json({ error: splitsError.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        message: 'Expense and member splits created successfully',
        expense: expenseRecord,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }
}
