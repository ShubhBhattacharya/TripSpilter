import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '../../../../../lib/supabase/server';
import { isSupabaseConfigured } from '../../../../../lib/supabase/client';
import { requireAuthenticatedUser, UnauthorizedError } from '../../../../../lib/security/auth-guards';
import { checkRateLimit, getClientIdentifier, applyRateLimitHeaders } from '../../../../../lib/rate-limit';

const acceptInviteSchema = z.object({
  inviteCode: z.string().min(4).max(80),
});

export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: 'Redeeming persisted trip invitations requires Supabase configuration', configured: false },
      { status: 503 }
    );
  }

  const headers = new Headers();
  try {
    const body = await request.json();
    const parsed = acceptInviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Valid inviteCode is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const user = await requireAuthenticatedUser(supabase);

    const rl = await checkRateLimit(getClientIdentifier('trip_invite_accept', request, user.id), 15, 60000);
    applyRateLimitHeaders(headers, rl);
    if (!rl.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers });
    }

    // Extract code cleanly even when a trailing slash or ?code=... invite URL is pasted
    const rawInput = parsed.data.inviteCode.trim();
    const codeMatch = rawInput.match(/[?&]code=([A-Za-z0-9_-]+)/i) || rawInput.match(/^code=([A-Za-z0-9_-]+)/i);
    const pathSegment = rawInput.split('?')[0].split('/').filter(Boolean).pop() || rawInput;
    const cleanedCode = (codeMatch ? codeMatch[1] : pathSegment).trim().toUpperCase();

    const { data, error } = await supabase.rpc('accept_trip_invitation', {
      p_invite_code: cleanedCode,
    });

    if (error) {
      const code = error.code;
      const status = code === 'P0002' ? 404 : code === '42501' ? 403 : code === '22000' ? 409 : 500;
      return NextResponse.json({ error: error.message }, { status, headers });
    }

    return NextResponse.json(data, { status: 200, headers });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    return NextResponse.json({ error: 'Unable to redeem trip invitation' }, { status: 400 });
  }
}
