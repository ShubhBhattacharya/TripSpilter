import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '../../../../lib/supabase/server';
import { isSupabaseConfigured } from '../../../../lib/supabase/client';
import {
  requireAuthenticatedUser,
  requireTripAdmin,
  requireTripMembership,
  UnauthorizedError,
  ForbiddenError,
} from '../../../../lib/security/auth-guards';
import { checkRateLimit, getClientIdentifier, applyRateLimitHeaders } from '../../../../lib/rate-limit';

const createInviteSchema = z.object({
  tripId: z.string().uuid(),
  email: z.string().email().max(160).optional(),
  role: z.enum(['member', 'admin']).default('member'),
  expiresInHours: z.number().int().min(1).max(720).default(72),
});

export async function GET(request: Request) {
  const tripId = new URL(request.url).searchParams.get('tripId');
  if (!tripId) {
    return NextResponse.json({ error: 'tripId query parameter is required' }, { status: 400 });
  }
  if (!isSupabaseConfigured) {
    return NextResponse.json({ invitations: [], configured: false });
  }
  if (!z.string().uuid().safeParse(tripId).success) {
    return NextResponse.json({ error: 'Invalid tripId UUID' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const user = await requireAuthenticatedUser(supabase);
    await requireTripMembership(supabase, tripId, user.id);

    const { data, error } = await supabase
      .from('trip_invitations')
      .select('id, trip_id, invite_code, email, role, status, expires_at, created_at')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ invitations: data || [] });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: 'Unable to fetch invitations' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Trip invitations require Supabase configuration' }, { status: 503 });
  }

  const headers = new Headers();
  try {
    const body = await request.json();
    const parsed = createInviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid invitation payload' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const user = await requireAuthenticatedUser(supabase);
    await requireTripAdmin(supabase, parsed.data.tripId, user.id);

    const rl = await checkRateLimit(getClientIdentifier('trip_invite_create', request, user.id), 20, 60000);
    applyRateLimitHeaders(headers, rl);
    if (!rl.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers });
    }

    const inviteCode = `TS-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const expiresAt = new Date(Date.now() + parsed.data.expiresInHours * 3600000).toISOString();

    const { data, error } = await supabase
      .from('trip_invitations')
      .insert({
        trip_id: parsed.data.tripId,
        invite_code: inviteCode,
        invited_by: user.id,
        email: parsed.data.email?.toLowerCase() || null,
        role: parsed.data.role,
        status: 'pending',
        expires_at: expiresAt,
      })
      .select('id, trip_id, invite_code, email, role, status, expires_at')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers });
    return NextResponse.json({ invitation: data }, { status: 201, headers });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: 'Unable to create trip invitation' }, { status: 400 });
  }
}
