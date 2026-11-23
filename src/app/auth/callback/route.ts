import { NextResponse } from 'next/server';
import { type EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '../../../lib/supabase/server';
import { sanitizeRedirectUrl } from '../../../lib/security/auth-guards';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const rawNext = searchParams.get('next');
  const errorDescription = searchParams.get('error_description') || searchParams.get('error');

  // Handle OAuth or verification errors from Supabase
  if (errorDescription) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDescription)}`
    );
  }

  // Sanitize next parameter against open redirect attacks (CWE-601)
  const isRecoveryFlow = type === 'recovery' || rawNext === '/reset-password';
  const defaultFallback = isRecoveryFlow ? '/reset-password' : '/';
  const safeNext = sanitizeRedirectUrl(rawNext, defaultFallback);

  const supabase = await createClient();

  // Flow 1: PKCE Authorization Code Exchange (Google OAuth, PKCE Magic Links/Recovery)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const destination = isRecoveryFlow ? '/reset-password' : safeNext;
      return NextResponse.redirect(`${origin}${destination}`);
    }
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message || 'auth-code-error')}`
    );
  }

  // Flow 2: Token Hash OTP Verification (Email Confirmation, Token-based Recovery)
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (!error) {
      const destination = isRecoveryFlow ? '/reset-password' : safeNext;
      return NextResponse.redirect(`${origin}${destination}`);
    }
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message || 'otp-verification-error')}`
    );
  }

  // Return the user to login if no valid code or token hash is present
  return NextResponse.redirect(`${origin}/login?error=invalid-auth-request`);
}
