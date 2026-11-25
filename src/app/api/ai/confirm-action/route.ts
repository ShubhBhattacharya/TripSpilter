import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '../../../../lib/supabase/server';
import { isSupabaseConfigured } from '../../../../lib/supabase/client';
import { requireAuthenticatedUser, UnauthorizedError, ForbiddenError } from '../../../../lib/security/auth-guards';

import { executeConfirmedAction } from '../../../../lib/ai/confirm-executor';
import type { PendingActionType } from '../../../../lib/ai/types';

const confirmSchema = z.object({
  actionType: z.enum([
    'CREATE_TRIP',
    'UPDATE_ITINERARY',
    'UPDATE_TRIP',
    'CREATE_EXPENSE',
    'CREATE_SETTLEMENT_PROPOSAL',
    'CREATE_BOOKING_DRAFT',
    'SAVE_PREFERENCES',
  ]),
  approved: z.literal(true),
  payload: z.record(z.string(), z.unknown()),
});

/**
 * Executes AI-prepared draft mutations ONLY after explicit user approval.
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Persisting AI actions requires Supabase configuration' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = confirmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Explicit approval and valid action payload required.' }, { status: 400 });
    }

    const supabase = await createClient();
    const user = await requireAuthenticatedUser(supabase);
    const { actionType, payload } = parsed.data;

    const result = await executeConfirmedAction({
      actionType: actionType as PendingActionType,
      payload,
      userId: user.id,
      supabase,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(
      { executed: true, actionType, message: result.message, record: result.data },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: 'Failed to execute confirmed action' }, { status: 500 });
  }
}
