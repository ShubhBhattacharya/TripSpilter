import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { sanitizeRedirectUrl } from '../../../lib/security/auth-guards';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const rawNext = searchParams.get('next');

  // Sanitize next parameter against open redirect attacks (CWE-601)
  const safeNext = sanitizeRedirectUrl(rawNext, '/');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  // Return the user to login with error explanation
  return NextResponse.redirect(`${origin}/login?error=auth-code-error`);
}