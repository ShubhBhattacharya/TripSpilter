import { NextResponse } from 'next/server';
import { createClient } from '../../../../../lib/supabase/server';
import { isSupabaseConfigured } from '../../../../../lib/supabase/client';
import { updateSplitStatusSchema } from '../../../../../lib/validations/api';
import {
  checkRateLimit,
  getClientIdentifier,
  applyRateLimitHeaders,
} from '../../../../../lib/rate-limit';
import {
  requireAuthenticatedUser,
  UnauthorizedError,
  ForbiddenError,
} from '../../../../../lib/security/auth-guards';
import {
  validatePaymentStateTransition,
  PaymentVerificationState,
} from '../../../../../lib/financial/payment-state-machine';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: splitId } = await params;

  if (!splitId) {
    return NextResponse.json({ error: 'Missing split ID parameter' }, { status: 400 });
  }

  try {
    const rawBody = await request.json();
    const validation = updateSplitStatusSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation Error',
          details: validation.error.issues.map((i) => i.message),
        },
        { status: 400 }
      );
    }

    const { status: requestedStatus, transactionRef } = validation.data;

    // Normalizing legacy UI status "paid"
    const targetStatus = (
      requestedStatus === 'paid' ? 'manually_reported_paid' : requestedStatus
    ) as PaymentVerificationState;

    if (!isSupabaseConfigured) {
      return NextResponse.json({
        message: 'Split status updated in demo mode',
        splitId,
        status: targetStatus,
        paidAt: targetStatus === 'verified_paid' ? new Date().toISOString() : null,
        transactionRef,
      });
    }

    const supabase = await createClient();
    const user = await requireAuthenticatedUser(supabase);

    // Rate limit per user
    const rateLimitId = getClientIdentifier('split_status', request, user.id);
    const rateLimit = await checkRateLimit(rateLimitId, 30, 60000);

    const headers = new Headers();
    applyRateLimitHeaders(headers, rateLimit);

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: `Too many status updates. Please wait ${rateLimit.reset}s.` },
        { status: 429, headers }
      );
    }

    // 1. Fetch split and parent expense to determine authorization context
    const { data: splitRecord, error: splitFetchError } = await supabase
      .from('expense_splits')
      .select(`
        id,
        user_id,
        amount_owed,
        amount_owed_paise,
        status,
        transaction_ref,
        expenses!inner (
          id,
          trip_id,
          paid_by
        )
      `)
      .eq('id', splitId)
      .maybeSingle();

    if (splitFetchError || !splitRecord) {
      return NextResponse.json(
        { error: 'Expense split record not found' },
        { status: 404, headers }
      );
    }

    interface SplitDbRecord {
      id: string;
      user_id: string;
      amount_owed: number;
      amount_owed_paise: number;
      status: string;
      transaction_ref: string | null;
      expenses: {
        id: string;
        trip_id: string;
        paid_by: string;
      };
    }

    const typedRecord = splitRecord as unknown as SplitDbRecord;
    const parentExpense = typedRecord.expenses;
    const tripId = parentExpense.trip_id;
    const creditorId = parentExpense.paid_by;
    const debtorId = typedRecord.user_id;

    // 2. Determine User's Role for this payment
    const isDebtor = user.id === debtorId;
    const isCreditor = user.id === creditorId;

    // Check if user is trip admin
    const { data: memberRow } = await supabase
      .from('trip_members')
      .select('role')
      .eq('trip_id', tripId)
      .eq('user_id', user.id)
      .maybeSingle();

    const isAdmin = memberRow?.role === 'admin';

    // 3. Strict State Machine Validation
    const transitionResult = validatePaymentStateTransition({
      currentStatus: splitRecord.status,
      targetStatus,
      isDebtor,
      isCreditor,
      isAdmin,
      transactionRef,
    });

    if (!transitionResult.allowed) {
      return NextResponse.json(
        {
          error: transitionResult.error || 'Unauthorized payment status transition',
        },
        { status: 403, headers }
      );
    }

    const finalStatus = transitionResult.sanitizedTargetStatus || targetStatus;

    // 4. Prepare update payload
    const updatePayload: {
      status: PaymentVerificationState;
      paid_at: string | null;
      transaction_ref?: string | null;
    } = {
      status: finalStatus,
      paid_at: finalStatus === 'verified_paid' ? new Date().toISOString() : null,
    };

    if (transactionRef !== undefined) {
      updatePayload.transaction_ref = transactionRef;
    }

    const { data: updatedSplit, error: updateError } = await supabase
      .from('expense_splits')
      .update(updatePayload)
      .eq('id', splitId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500, headers });
    }

    return NextResponse.json(
      {
        message: `Payment status transitioned to ${finalStatus}`,
        split: updatedSplit,
      },
      { headers }
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