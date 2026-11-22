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
      isDemo: true,
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
    const headerIdempotencyKey = request.headers.get('idempotency-key')?.trim();
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
      idempotencyKey: bodyIdempotencyKey,
    } = validation.data;

    const idempotencyKey = headerIdempotencyKey || bodyIdempotencyKey;

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
    const rateLimit = await checkRateLimit(rateLimitId, 30, 60000);

    const headers = new Headers();
    applyRateLimitHeaders(headers, rateLimit);

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: `Too many expense creations. Please wait ${rateLimit.reset}s.` },
        { status: 429, headers }
      );
    }

    // 3. Persistent Idempotency Check: Return original result for retries
    if (idempotencyKey) {
      const { data: cachedKey } = await supabase
        .from('idempotency_keys')
        .select('response_status, response_body')
        .eq('user_id', user.id)
        .eq('endpoint', 'POST /api/expenses')
        .eq('key', idempotencyKey)
        .maybeSingle();

      if (cachedKey) {
        headers.set('X-Idempotent-Replay', 'true');
        return NextResponse.json(cachedKey.response_body, {
          status: cachedKey.response_status,
          headers,
        });
      }
    }

    // 4. Verify all participants in splits are registered members of this trip
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

    // 5. Atomic Transactional Execution via Database RPC
    const formattedSplits = splits.map((s) => ({
      userId: s.userId,
      amountOwed: s.amountOwed,
      amountOwedPaise: toPaise(s.amountOwed),
    }));

    const { data: rpcResult, error: rpcError } = await supabase.rpc('create_expense_with_splits', {
      p_trip_id: tripId,
      p_vendor_name: vendorName,
      p_vendor_upi_id: vendorUpiId,
      p_total_amount: totalAmount,
      p_total_amount_paise: totalAmountPaise,
      p_split_type: splitType,
      p_notes: notes || null,
      p_splits: formattedSplits,
      p_idempotency_key: idempotencyKey || null,
    });

    if (!rpcError && rpcResult) {
      const isReplay = rpcResult.isIdempotentReplay;
      if (isReplay) {
        headers.set('X-Idempotent-Replay', 'true');
      }
      return NextResponse.json(
        {
          message: 'Expense and member splits created successfully',
          expense: rpcResult.expense,
          splits: rpcResult.splits,
        },
        { status: isReplay ? 200 : 201, headers }
      );
    }

    // Fallback: Transactional execution with cleanup if RPC is pending migration
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

    // Insert splits; if failed, immediately roll back expense record
    const splitsToInsert = splits.map((s) => {
      const sharePaise = toPaise(s.amountOwed);
      const isPayer = s.userId === user.id;
      return {
        expense_id: expenseRecord.id,
        user_id: s.userId,
        amount_owed: s.amountOwed,
        amount_owed_paise: sharePaise,
        status: isPayer ? 'verified_paid' : 'pending',
        paid_at: isPayer ? new Date().toISOString() : null,
      };
    });

    const { data: insertedSplits, error: splitsError } = await supabase
      .from('expense_splits')
      .insert(splitsToInsert)
      .select();

    if (splitsError) {
      // Rollback orphaned parent expense
      await supabase.from('expenses').delete().eq('id', expenseRecord.id);
      return NextResponse.json(
        { error: `Failed to insert splits. Transaction rolled back: ${splitsError.message}` },
        { status: 500, headers }
      );
    }

    const responsePayload = {
      message: 'Expense and member splits created successfully',
      expense: expenseRecord,
      splits: insertedSplits,
    };

    // Persist idempotency record
    if (idempotencyKey) {
      await supabase
        .from('idempotency_keys')
        .insert({
          user_id: user.id,
          endpoint: 'POST /api/expenses',
          key: idempotencyKey,
          response_status: 201,
          response_body: responsePayload,
        })
        .select()
        .maybeSingle();
    }

    return NextResponse.json(responsePayload, { status: 201, headers });
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