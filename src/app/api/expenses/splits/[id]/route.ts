import { NextResponse } from 'next/server';
import { createClient } from '../../../../../lib/supabase/server';
import { isSupabaseConfigured } from '../../../../../lib/supabase/client';
import { updateSplitStatusSchema } from '../../../../../lib/validations/api';
import { checkRateLimit, getClientIp } from '../../../../../lib/rate-limit';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: splitId } = await params;
  const clientIp = getClientIp(request);
  const rateLimit = checkRateLimit(`split_status_${clientIp}`, 30, 60000);

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: `Too many status updates. Please wait ${rateLimit.reset}s.` },
      { status: 429 }
    );
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

    const { status, transactionRef } = validation.data;

    if (!isSupabaseConfigured) {
      return NextResponse.json({
        message: 'Split status updated in demo mode',
        splitId,
        status,
        paidAt: status === 'paid' ? new Date().toISOString() : null,
        transactionRef,
      });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const updatePayload: {
      status: 'pending' | 'paid';
      paid_at: string | null;
      transaction_ref?: string | null;
    } = {
      status,
      paid_at: status === 'paid' ? new Date().toISOString() : null,
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
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Payment status updated',
      split: updatedSplit,
    });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }
}
