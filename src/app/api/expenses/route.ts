import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { isSupabaseConfigured } from '../../../lib/supabase/client';
import { createExpenseSchema } from '../../../lib/validations/api';
import {
  checkRateLimit,
  getClientIdentifier,
  applyRateLimitHeaders,
} from '../../../lib/rate-limit';
import {
  requireAuthenticatedUser,
  requireTripMembership,
  UnauthorizedError,
  ForbiddenError,
} from '../../../lib/security/auth-guards';
import { toPaise } from '../../../lib/financial/split-engine';

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

  try {
    const supabase = await createClient();
    const user = await requireAuthenticatedUser(supabase);

    // Enforce trip membership before allowing access to expenses (Prevents IDOR)
    await requireTripMembership(supabase, tripId, user.id);

    const rateLimitId = getClientIdentifier('get_expenses', request, user.id);
    const rateLimit = await checkRateLimit(rateLimitId, 60, 60000);

    const headers = new Headers();
    applyRateLimitHeaders(headers, rateLimit);

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: `Too many requests. Please wait ${rateLimit.reset}s.` },
        { status: 429, headers }
      );
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
          amount_owed_paise,
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
      return NextResponse.json({ error: fetchError.message }, { status: 500, headers });
    }

    return NextResponse.json({ expenses: expenses || [] }, { headers });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
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

    const {
      tripId,
      vendorName,
      vendorUpiId,
      totalAmount,
      splitType,
      notes,
      splits,
      idempotencyKey: _idempotencyKey,
    } = validation.data;

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
            totalAmountPaise: toPaise(totalAmount),
            splitType,
            notes,
            splits,
          },
        },
        { status: 201 }
      );
    }

    const supabase = await createClient();
    const user = await requireAuthenticatedUser(supabase);

    // 1. Verify creator's trip membership (Prevents cross-trip IDOR)
    await requireTripMembership(supabase, tripId, user.id);

    // 2. Rate limit per authenticated user
    const rateLimitId = getClientIdentifier('expense_create', request, user.id);
    const rateLimit = await checkRateLimit(rateLimitId, 25, 60000);

    const headers = new Headers();
    applyRateLimitHeaders(headers, rateLimit);

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: `Too many expense creations. Please wait ${rateLimit.reset}s.` },
        { status: 429, headers }
      );
    }

    // 3. Verify all participants in splits are registered members of this trip
    const { data: tripMembers, error: membersQueryError } = await supabase
      .from('trip_members')
      .select('user_id')
      .eq('trip_id', tripId);

    if (membersQueryError) {
      return NextResponse.json({ error: membersQueryError.message }, { status: 500, headers });
    }

    const validMemberIds = new Set(tripMembers ? tripMembers.map((m) => m.user_id) : []);
    for (const split of splits) {
      if (!validMemberIds.has(split.userId)) {
        return NextResponse.json(
          {
            error: `User ${split.userId} is not a member of trip ${tripId}. All participants must be active trip members.`,
          },
          { status: 400, headers }
        );
      }
    }

    const totalAmountPaise = toPaise(totalAmount);

    // 4. Duplicate Expense Prevention (Idempotency check within a 15-second window)
    const fifteenSecondsAgo = new Date(Date.now() - 15000).toISOString();
    const { data: recentDuplicates } = await supabase
      .from('expenses')
      .select('id, created_at')
      .eq('trip_id', tripId)
      .eq('paid_by', user.id)
      .eq('total_amount_paise', totalAmountPaise)
      .eq('vendor_name', vendorName)
      .gte('created_at', fifteenSecondsAgo);

    if (recentDuplicates && recentDuplicates.length > 0) {
      return NextResponse.json(
        {
          error:
            'A duplicate expense with identical amount, vendor, and payer was submitted within the last 15 seconds. If this was intentional, please wait a moment before resubmitting.',
          duplicateExpenseId: recentDuplicates[0].id,
        },
        { status: 409, headers }
      );
    }

    // 5. Create main expense record with integer paise
    const { data: expenseRecord, error: expenseError } = await supabase
      .from('expenses')
      .insert({
        trip_id: tripId,
        paid_by: user.id,
        vendor_name: vendorName,
        vendor_upi_id: vendorUpiId,
        total_amount: totalAmount,
        total_amount_paise: totalAmountPaise,
        split_type: splitType,
        notes,
      })
      .select()
      .single();

    if (expenseError) {
      return NextResponse.json({ error: expenseError.message }, { status: 500, headers });
    }

    // 6. Batch insert splits with integer paise and strict initial statuses
    const splitsToInsert = splits.map((s) => {
      const sharePaise = toPaise(s.amountOwed);
      const isPayer = s.userId === user.id;
      return {
        expense_id: expenseRecord.id,
        user_id: s.userId,
        amount_owed: s.amountOwed,
        amount_owed_paise: sharePaise,
        // The person who paid out-of-pocket has already fulfilled their share
        status: isPayer ? 'verified_paid' : 'pending',
        paid_at: isPayer ? new Date().toISOString() : null,
      };
    });

    const { error: splitsError } = await supabase
      .from('expense_splits')
      .insert(splitsToInsert);

    if (splitsError) {
      // Clean up orphaned parent record if splits insertion fails
      await supabase.from('expenses').delete().eq('id', expenseRecord.id);
      return NextResponse.json({ error: splitsError.message }, { status: 500, headers });
    }

    return NextResponse.json(
      {
        message: 'Expense and member splits created successfully',
        expense: expenseRecord,
      },
      { status: 201, headers }
    );
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }
}