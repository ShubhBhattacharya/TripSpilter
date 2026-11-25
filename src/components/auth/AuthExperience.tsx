'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '../../lib/supabase/client';
import { useAuth } from './AuthProvider';
import {
  COUNTRY_CODES,
  validateMobileNumber,
  validateEmailAddress,
  evaluatePasswordStrength,
  sanitizeNextRedirect,
} from '../../lib/auth/validation';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Building2,
  User,
  KeyRound,
  Sparkles,
  Check,
  ChevronLeft,
  Info,
  Loader2,
} from 'lucide-react';

type AccountCategory = 'personal' | 'business';
type PersonalMethod = 'mobile' | 'email';

export interface AuthExperienceProps {
  defaultIntent?: 'login' | 'signup';
  defaultMethod?: PersonalMethod;
}

export const AuthExperience: React.FC<AuthExperienceProps> = ({
  defaultIntent = 'login',
  defaultMethod = 'mobile',
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const safeRedirect = sanitizeNextRedirect(searchParams.get('redirectTo'), '/');
  const urlError = searchParams.get('error');
  const urlMessage = searchParams.get('message');
  const initialTab = searchParams.get('type') === 'business' ? 'business' : 'personal';

  const { signInAsDemo } = useAuth();
  const supabase = useMemo(() => (isSupabaseConfigured ? createClient() : null), []);

  // Top-level state
  const [accountType, setAccountType] = useState<AccountCategory>(initialTab);
  const [authIntent, setAuthIntent] = useState<'login' | 'signup'>(defaultIntent);
  const [personalMethod, setPersonalMethod] = useState<PersonalMethod>(defaultMethod);

  // Personal Mobile + OTP state
  const [countryCode, setCountryCode] = useState<string>('+91');
  const [mobileInput, setMobileInput] = useState<string>('');
  const [otpStage, setOtpStage] = useState<boolean>(false);
  const [verifiedE164, setVerifiedE164] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [otpCooldown, setOtpCooldown] = useState<number>(0);

  // Email / Business credentials state
  const [fullName, setFullName] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [agreedToTerms, setAgreedToTerms] = useState<boolean>(true);

  // Feedback state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(() => {
    if (!urlError) return null;
    if (urlError === 'auth-code-error') {
      return 'Authentication code expired or invalid. Please sign in again.';
    }
    if (urlError === 'invalid-auth-request') {
      return 'Invalid authentication session. Please try again.';
    }
    try {
      return decodeURIComponent(urlError);
    } catch {
      return urlError;
    }
  });
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(() => {
    if (urlMessage === 'password-updated') {
      return 'Password updated successfully! Sign in with your new credentials.';
    }
    if (urlMessage === 'email-verified') {
      return 'Email verified! Please sign in to continue.';
    }
    return null;
  });

  // Cooldown countdown ticker for OTP Resend
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

  const clearAlerts = () => {
    setError(null);
    setInfoMsg(null);
    setSuccessMsg(null);
  };

  const switchAccountType = (next: AccountCategory) => {
    if (next === accountType) return;
    clearAlerts();
    setAccountType(next);
    setOtpStage(false);
    setOtpCode('');
  };

  const passwordStats = evaluatePasswordStrength(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const completeDemoSession = (params: { name: string; email: string }) => {
    const handle = params.name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'traveler';
    signInAsDemo({
      name: params.name,
      email: params.email,
      upiId: `${handle}@okhdfcbank`,
    });
    setSuccessMsg(`Signed in as ${params.name} (Local Preview). Redirecting...`);
    setTimeout(() => {
      router.push(safeRedirect);
      router.refresh();
    }, 450);
  };

  // Handler 1: Google OAuth (real Supabase flow + honest preview fallback)
  const handleGoogleAuth = async () => {
    clearAlerts();

    if (!isSupabaseConfigured || !supabase) {
      completeDemoSession({
        name: accountType === 'business' ? 'TripSplitter Team Lead' : 'Google Demo Traveler',
        email: accountType === 'business' ? 'team@company-preview.example' : 'traveler.google@example.com',
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
            safeRedirect
          )}`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      if (oauthError) {
        setError(oauthError.message);
        setIsLoading(false);
      }
    } catch {
      setError('Unable to initialize Google sign-in. Please try again.');
      setIsLoading(false);
    }
  };

  // Handler 2: Personal Mobile-First Auth (Sends real OTP ONLY when Supabase SMS Auth is active)
  const handleMobileContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();

    const validation = validateMobileNumber(countryCode, mobileInput);
    if (!validation.valid) {
      setError(validation.error || 'Please enter a valid mobile number.');
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setInfoMsg(
        `SMS OTP requires live Supabase Phone Auth + an SMS provider (Twilio / MessageBird) configured on the backend. No OTP was sent in local preview mode — please sign in using Google, Email, or Preview below.`
      );
      return;
    }

    setIsLoading(true);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: validation.e164,
      });

      if (otpError) {
        const lower = otpError.message.toLowerCase();
        if (lower.includes('unsupported phone') || lower.includes('phone') || lower.includes('sms')) {
          setError(
            `SMS OTP could not be sent (${otpError.message}). Ensure an SMS provider is configured in Supabase Auth, or sign in instantly via Google or Email below.`
          );
        } else {
          setError(otpError.message);
        }
        setIsLoading(false);
        return;
      }

      setVerifiedE164(validation.e164);
      setOtpStage(true);
      setOtpCooldown(30);
      setSuccessMsg(`Verification code sent to ${validation.e164}.`);
    } catch {
      setError('Unable to initiate OTP request. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();

    if (!isSupabaseConfigured || !supabase) {
      setError('Phone OTP verification requires live Supabase Auth configuration.');
      return;
    }

    const cleanedCode = otpCode.replace(/\D/g, '');
    if (cleanedCode.length < 4 || cleanedCode.length > 8) {
      setError('Please enter the verification code sent to your mobile number.');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error: verifyErr } = await supabase.auth.verifyOtp({
        phone: verifiedE164,
        token: cleanedCode,
        type: 'sms',
      });

      if (verifyErr || !data?.session) {
        setError(verifyErr?.message || 'Invalid or expired verification code.');
        setIsLoading(false);
        return;
      }

      setSuccessMsg('Mobile verified! Redirecting to TripSplitter...');
      setTimeout(() => {
        router.push(safeRedirect);
        router.refresh();
      }, 450);
    } catch {
      setError('Failed to verify OTP code. Please try again.');
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (otpCooldown > 0 || !supabase || !verifiedE164) return;
    clearAlerts();
    setIsLoading(true);
    try {
      const { error: resendErr } = await supabase.auth.signInWithOtp({
        phone: verifiedE164,
      });
      if (resendErr) {
        setError(resendErr.message);
      } else {
        setOtpCooldown(30);
        setSuccessMsg(`A new verification code has been sent to ${verifiedE164}.`);
      }
    } catch {
      setError('Failed to resend verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handler 3: Email Login & Account Registration (Used for both Personal Email and Business Accounts)
  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();

    const emailCheck = validateEmailAddress(email);
    if (!emailCheck.valid) {
      setError(emailCheck.error || 'Please enter a valid email address.');
      return;
    }

    if (authIntent === 'signup' && !fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (authIntent === 'signup' && !agreedToTerms) {
      setError('Please accept the Terms & Conditions and Privacy Policy to continue.');
      return;
    }

    // Graceful preview behavior only when cloud Supabase credentials are absent
    if (!isSupabaseConfigured || !supabase) {
      const prefix = fullName.trim() || emailCheck.normalized.split('@')[0] || 'Traveler';
      completeDemoSession({
        name: prefix.charAt(0).toUpperCase() + prefix.slice(1),
        email: emailCheck.normalized,
      });
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    if (authIntent === 'signup') {
      if (!passwordStats.isMinLength) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (!passwordsMatch) {
        setError('Passwords do not match.');
        return;
      }
    }

    setIsLoading(true);
    try {
      if (authIntent === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: emailCheck.normalized,
          password,
        });

        if (signInError) {
          setError(signInError.message);
          setIsLoading(false);
          return;
        }

        setSuccessMsg('Signed in successfully! Redirecting...');
        setTimeout(() => {
          router.push(safeRedirect);
          router.refresh();
        }, 450);
        return;
      }

      // Signup via Supabase Auth
      const mobileCheck = mobileInput.trim()
        ? validateMobileNumber(countryCode, mobileInput)
        : null;

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: emailCheck.normalized,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            account_type: accountType,
            company_name: accountType === 'business' ? companyName.trim() || null : null,
            phone: mobileCheck?.valid ? mobileCheck.e164 : null,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
            safeRedirect
          )}`,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setIsLoading(false);
        return;
      }

      // Supabase returns an empty identities array if the email already belongs to an existing account
      if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setError('An account with this email already exists. Please sign in instead.');
        setIsLoading(false);
        return;
      }

      if (data?.user && data.session) {
        setSuccessMsg('Account created successfully! Redirecting...');
        setTimeout(() => {
          router.push(safeRedirect);
          router.refresh();
        }, 450);
      } else {
        setSuccessMsg('Verification link sent to your inbox! Confirm your email to activate your account.');
        setIsLoading(false);
      }
    } catch {
      setError('Authentication request failed. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Auth Form Header */}
      <div className="space-y-1.5">
        <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-[#172B4D] leading-tight">
          Welcome to TripSplitter
        </h1>
        <p className="text-sm text-[#64748B]">
          Sign in or create an account to continue your journey.
        </p>
      </div>

      {/* Animated Segmented Account Selector */}
      <div
        role="tablist"
        aria-label="Account Type Selector"
        className="relative grid grid-cols-2 p-1 rounded-full bg-[#F1F5F9] border border-[#E2E8F0] select-none"
      >
        <div
          aria-hidden="true"
          className={`absolute top-1 bottom-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-[#1666F2] shadow-sm transition-transform duration-300 ease-out ${
            accountType === 'business' ? 'translate-x-full' : 'translate-x-0'
          }`}
        />

        <button
          type="button"
          role="tab"
          data-testid="tab-personal"
          aria-selected={accountType === 'personal'}
          onClick={() => switchAccountType('personal')}
          className={`relative z-10 py-2.5 px-3 rounded-full text-[11px] sm:text-xs font-extrabold tracking-wider uppercase flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            accountType === 'personal' ? 'text-white' : 'text-[#475569] hover:text-[#172B4D]'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Personal Account</span>
        </button>

        <button
          type="button"
          role="tab"
          data-testid="tab-business"
          aria-selected={accountType === 'business'}
          onClick={() => switchAccountType('business')}
          className={`relative z-10 py-2.5 px-3 rounded-full text-[11px] sm:text-xs font-extrabold tracking-wider uppercase flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            accountType === 'business' ? 'text-white' : 'text-[#475569] hover:text-[#172B4D]'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Business Account</span>
        </button>
      </div>

      {/* Local Preview Environment Notice when Supabase env vars are absent */}
      {!isSupabaseConfigured && (
        <div className="p-3 rounded-2xl bg-sky-50/80 border border-sky-200/90 flex items-start gap-2.5 text-xs text-sky-900">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#1685D4]" />
          <p className="leading-relaxed">
            <strong>Preview Environment:</strong> Live Supabase auth credentials are not set locally. Google Demo, Email Preview, and Guest Traveler are active without touching production data.
          </p>
        </div>
      )}

      {/* Dynamic Error / Info / Success Banners */}
      {error && (
        <div
          role="alert"
          data-testid="auth-error-alert"
          className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs font-medium text-rose-800"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {infoMsg && (
        <div
          role="status"
          data-testid="auth-info-alert"
          className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs font-medium text-amber-900"
        >
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
          <span>{infoMsg}</span>
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          data-testid="auth-success-alert"
          className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs font-medium text-emerald-800"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PERSONAL ACCOUNT FLOW */}
      {/* ========================================================================= */}
      {accountType === 'personal' && (
        <div className="space-y-5">
          {/* Sub-view 1A: Mobile Number Login + Optional Real OTP Verification */}
          {personalMethod === 'mobile' && !otpStage && (
            <form onSubmit={handleMobileContinue} className="space-y-5" noValidate>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="mobile-number-input" className="block text-xs font-bold text-[#172B4D]">
                    Mobile Number
                  </label>
                  <span className="text-[11px] font-medium text-[#64748B]">Instant OTP when configured</span>
                </div>

                <div className="flex items-center rounded-2xl border border-[#CBD5E1] bg-[#F8FAFC] focus-within:bg-white focus-within:border-[#1666F2] focus-within:ring-4 focus-within:ring-[#1666F2]/10 transition-all overflow-hidden">
                  <select
                    aria-label="Country Dial Code"
                    value={countryCode}
                    onChange={(e) => {
                      setCountryCode(e.target.value);
                      if (error) setError(null);
                    }}
                    className="pl-3.5 pr-2 py-3.5 bg-transparent text-xs sm:text-sm font-bold text-[#172B4D] outline-none cursor-pointer shrink-0"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.iso} ({c.code})
                      </option>
                    ))}
                  </select>

                  <span className="h-6 w-px bg-[#DCE4EF] shrink-0" aria-hidden="true" />

                  <input
                    id="mobile-number-input"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    value={mobileInput}
                    onChange={(e) => {
                      setMobileInput(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Enter mobile number"
                    maxLength={14}
                    className="flex-1 min-w-0 px-3.5 py-3.5 bg-transparent text-sm font-medium text-[#172B4D] placeholder:text-[#94A3B8] outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                data-testid="mobile-continue-btn"
                className="w-full py-3.5 px-6 rounded-full bg-[#1666F2] hover:bg-[#173B70] text-white font-bold text-sm tracking-wide shadow-md hover:shadow-lg active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>REQUESTING OTP...</span>
                  </>
                ) : (
                  <span>CONTINUE</span>
                )}
              </button>
            </form>
          )}

          {/* Sub-view 1B: Real OTP Verification Screen (Rendered ONLY if OTP actually sent) */}
          {personalMethod === 'mobile' && otpStage && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="text-xs">
                  <span className="text-[#64748B] block">Verification code sent to</span>
                  <strong className="text-[#172B4D] font-bold">{verifiedE164}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOtpStage(false);
                    setOtpCode('');
                    clearAlerts();
                  }}
                  className="text-xs font-bold text-[#1666F2] hover:underline shrink-0 cursor-pointer"
                >
                  Edit number
                </button>
              </div>

              <div>
                <label htmlFor="otp-code-input" className="block text-xs font-bold text-[#172B4D] mb-1.5">
                  Enter Verification Code (OTP)
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="otp-code-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={8}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="Enter 6-digit OTP"
                    className="w-full pl-10 pr-4 py-3.5 rounded-2xl border border-[#CBD5E1] bg-[#F8FAFC] focus:bg-white focus:border-[#1666F2] focus:ring-4 focus:ring-[#1666F2]/10 text-sm font-bold tracking-[0.25em] text-[#172B4D] outline-none transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  disabled={otpCooldown > 0 || isLoading}
                  onClick={handleResendOtp}
                  className="font-semibold text-[#1666F2] hover:underline disabled:text-[#94A3B8] disabled:no-underline cursor-pointer"
                >
                  {otpCooldown > 0 ? `Resend OTP in ${otpCooldown}s` : 'Resend OTP'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOtpStage(false);
                    setPersonalMethod('email');
                    clearAlerts();
                  }}
                  className="font-semibold text-[#64748B] hover:text-[#172B4D] cursor-pointer"
                >
                  Use Email instead
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-6 rounded-full bg-[#1666F2] hover:bg-[#173B70] text-white font-bold text-sm tracking-wide shadow-md active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>VERIFYING...</span>
                  </>
                ) : (
                  <span>VERIFY & CONTINUE</span>
                )}
              </button>
            </form>
          )}

          {/* Sub-view 1C: Email Login / Signup Flow */}
          {personalMethod === 'email' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPersonalMethod('mobile');
                    clearAlerts();
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#1666F2] hover:underline cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" /> Back to Mobile Login
                </button>

                <div className="flex items-center gap-1 bg-[#F1F5F9] p-0.5 rounded-lg text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthIntent('login');
                      clearAlerts();
                    }}
                    className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                      authIntent === 'login' ? 'bg-white text-[#172B4D] shadow-2xs' : 'text-[#64748B]'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthIntent('signup');
                      clearAlerts();
                    }}
                    className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                      authIntent === 'signup' ? 'bg-white text-[#172B4D] shadow-2xs' : 'text-[#64748B]'
                    }`}
                  >
                    Create Account
                  </button>
                </div>
              </div>

              <form onSubmit={handleEmailAuthSubmit} className="space-y-3.5" noValidate>
                {authIntent === 'signup' && (
                  <div>
                    <label htmlFor="personal-fullname" className="block text-xs font-bold text-[#172B4D] mb-1">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="personal-fullname"
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Aarav Sharma"
                        className="w-full pl-10 pr-3.5 py-3 rounded-2xl border border-[#CBD5E1] bg-[#F8FAFC] focus:bg-white focus:border-[#1666F2] focus:ring-4 focus:ring-[#1666F2]/10 text-sm font-medium text-[#172B4D] outline-none transition-all"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="personal-email" className="block text-xs font-bold text-[#172B4D] mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="personal-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-3.5 py-3 rounded-2xl border border-[#CBD5E1] bg-[#F8FAFC] focus:bg-white focus:border-[#1666F2] focus:ring-4 focus:ring-[#1666F2]/10 text-sm font-medium text-[#172B4D] outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="personal-password" className="text-xs font-bold text-[#172B4D]">
                      Password
                    </label>
                    {authIntent === 'login' && (
                      <Link href="/forgot-password" className="text-xs font-semibold text-[#1666F2] hover:underline">
                        Forgot password?
                      </Link>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="personal-password"
                      type={showPassword ? 'text' : 'password'}
                      required={isSupabaseConfigured}
                      autoComplete={authIntent === 'login' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={
                        isSupabaseConfigured
                          ? 'Enter password'
                          : 'Enter password (optional in preview mode)'
                      }
                      className="w-full pl-10 pr-10 py-3 rounded-2xl border border-[#CBD5E1] bg-[#F8FAFC] focus:bg-white focus:border-[#1666F2] focus:ring-4 focus:ring-[#1666F2]/10 text-sm font-medium text-[#172B4D] outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#172B4D] cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {authIntent === 'signup' && (
                  <>
                    <div>
                      <label htmlFor="personal-confirm-pw" className="block text-xs font-bold text-[#172B4D] mb-1">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          id="personal-confirm-pw"
                          type={showPassword ? 'text' : 'password'}
                          required={isSupabaseConfigured}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Re-enter password"
                          className="w-full pl-10 pr-3.5 py-3 rounded-2xl border border-[#CBD5E1] bg-[#F8FAFC] focus:bg-white focus:border-[#1666F2] focus:ring-4 focus:ring-[#1666F2]/10 text-sm font-medium text-[#172B4D] outline-none transition-all"
                        />
                      </div>
                    </div>

                    {password.length > 0 && isSupabaseConfigured && (
                      <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1 text-[11px]">
                        <div className="flex justify-between font-semibold">
                          <span className="text-[#64748B]">Password strength</span>
                          <span
                            className={
                              passwordStats.score === 3
                                ? 'text-emerald-600'
                                : passwordStats.score === 2
                                  ? 'text-amber-600'
                                  : 'text-rose-600'
                            }
                          >
                            {passwordStats.score === 3
                              ? 'Strong'
                              : passwordStats.score === 2
                                ? 'Fair'
                                : 'Weak'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[#64748B]">
                          <span className={`inline-flex items-center gap-1 ${passwordStats.isMinLength ? 'text-emerald-600 font-semibold' : ''}`}>
                            <Check className="w-3 h-3" /> 6+ chars
                          </span>
                          <span className={`inline-flex items-center gap-1 ${passwordsMatch ? 'text-emerald-600 font-semibold' : ''}`}>
                            <Check className="w-3 h-3" /> Matches
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {authIntent === 'login' ? (
                  <label className="flex items-center gap-2 text-xs text-[#64748B] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 accent-[#1666F2] rounded cursor-pointer"
                    />
                    Keep me signed in on this browser
                  </label>
                ) : (
                  <label className="flex items-start gap-2 text-xs text-[#64748B] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="w-4 h-4 mt-0.5 accent-[#1666F2] rounded cursor-pointer"
                    />
                    <span>I accept the Terms & Conditions and Privacy Policy below.</span>
                  </label>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  data-testid="email-submit-btn"
                  className="w-full py-3.5 px-6 rounded-full bg-[#1666F2] hover:bg-[#173B70] text-white font-bold text-sm tracking-wide shadow-md hover:shadow-lg active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{authIntent === 'login' ? 'SIGNING IN...' : 'CREATING ACCOUNT...'}</span>
                    </>
                  ) : (
                    <>
                      <span>{authIntent === 'login' ? 'SIGN IN WITH EMAIL' : 'CREATE ACCOUNT'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Divider + Social / Alternative Sign-In Icons */}
          <div className="space-y-4 pt-1">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-[#E2E8F0]" />
              <span className="text-xs font-medium text-[#64748B]">Or continue with</span>
              <div className="flex-1 h-px bg-[#E2E8F0]" />
            </div>

            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={isLoading}
                data-testid="btn-google-auth"
                aria-label="Continue with Google"
                className="flex items-center gap-2.5 px-5 py-2.5 rounded-full border border-[#DCE4EF] bg-white hover:bg-[#F8FAFC] hover:border-[#94A3B8] text-xs font-bold text-[#172B4D] shadow-2xs transition-all active:scale-95 cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Google</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  clearAlerts();
                  setOtpStage(false);
                  setPersonalMethod((prev) => (prev === 'email' ? 'mobile' : 'email'));
                }}
                data-testid="btn-email-toggle"
                aria-label={personalMethod === 'email' ? 'Switch to Mobile Number' : 'Continue with Email'}
                className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full border text-xs font-bold shadow-2xs transition-all active:scale-95 cursor-pointer ${
                  personalMethod === 'email'
                    ? 'border-[#1666F2] bg-blue-50 text-[#1666F2]'
                    : 'border-[#DCE4EF] bg-white hover:bg-[#F8FAFC] hover:border-[#94A3B8] text-[#172B4D]'
                }`}
              >
                <Mail className="w-4 h-4" />
                <span>{personalMethod === 'email' ? 'Mobile OTP' : 'Email'}</span>
              </button>
            </div>

            {!isSupabaseConfigured && (
              <button
                type="button"
                data-testid="btn-demo-preview"
                onClick={() =>
                  completeDemoSession({
                    name: 'Aarav Sharma',
                    email: 'aarav.sharma@example.com',
                  })
                }
                className="w-full py-2.5 px-4 rounded-full border border-dashed border-[#1685D4] bg-[#F0F7FF] hover:bg-[#E0EFFF] text-xs font-bold text-[#1666F2] flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Explore Instant Demo Traveler Preview</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BUSINESS ACCOUNT FLOW (Uses genuine Supabase Auth cleanly) */}
      {/* ========================================================================= */}
      {accountType === 'business' && (
        <div className="space-y-4" data-testid="business-auth-panel">
          <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#172B4D]">Corporate & Organizer Access</p>
              <p className="text-[11px] text-[#64748B]">
                Manage team outings & shared vendor budgets via TripSplitter Auth.
              </p>
            </div>
            <div className="flex items-center gap-1 bg-white border border-[#E2E8F0] p-0.5 rounded-lg text-[11px] font-bold shrink-0">
              <button
                type="button"
                onClick={() => {
                  setAuthIntent('login');
                  clearAlerts();
                }}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  authIntent === 'login' ? 'bg-[#173B70] text-white' : 'text-[#64748B]'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthIntent('signup');
                  clearAlerts();
                }}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  authIntent === 'signup' ? 'bg-[#173B70] text-white' : 'text-[#64748B]'
                }`}
              >
                Register
              </button>
            </div>
          </div>

          <form onSubmit={handleEmailAuthSubmit} className="space-y-3.5" noValidate>
            {authIntent === 'signup' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="biz-fullname" className="block text-xs font-bold text-[#172B4D] mb-1">
                    Contact Name
                  </label>
                  <input
                    id="biz-fullname"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Priya Mehta"
                    className="w-full px-3.5 py-3 rounded-2xl border border-[#CBD5E1] bg-[#F8FAFC] focus:bg-white focus:border-[#1666F2] focus:ring-4 focus:ring-[#1666F2]/10 text-sm font-medium text-[#172B4D] outline-none transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="biz-company" className="block text-xs font-bold text-[#172B4D] mb-1">
                    Company / Organization
                  </label>
                  <input
                    id="biz-company"
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Acme Travels Pvt Ltd"
                    className="w-full px-3.5 py-3 rounded-2xl border border-[#CBD5E1] bg-[#F8FAFC] focus:bg-white focus:border-[#1666F2] focus:ring-4 focus:ring-[#1666F2]/10 text-sm font-medium text-[#172B4D] outline-none transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="biz-email" className="block text-xs font-bold text-[#172B4D] mb-1">
                Business Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="biz-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-3.5 py-3 rounded-2xl border border-[#CBD5E1] bg-[#F8FAFC] focus:bg-white focus:border-[#1666F2] focus:ring-4 focus:ring-[#1666F2]/10 text-sm font-medium text-[#172B4D] outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="biz-password" className="text-xs font-bold text-[#172B4D]">
                  Password
                </label>
                <Link href="/forgot-password" className="text-xs font-semibold text-[#1666F2] hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="biz-password"
                  type={showPassword ? 'text' : 'password'}
                  required={isSupabaseConfigured}
                  autoComplete={authIntent === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    isSupabaseConfigured
                      ? 'Enter password'
                      : 'Enter password (optional in preview mode)'
                  }
                  className="w-full pl-10 pr-10 py-3 rounded-2xl border border-[#CBD5E1] bg-[#F8FAFC] focus:bg-white focus:border-[#1666F2] focus:ring-4 focus:ring-[#1666F2]/10 text-sm font-medium text-[#172B4D] outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#172B4D] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {authIntent === 'signup' && (
              <div>
                <label htmlFor="biz-confirm-pw" className="block text-xs font-bold text-[#172B4D] mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="biz-confirm-pw"
                    type={showPassword ? 'text' : 'password'}
                    required={isSupabaseConfigured}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    className="w-full pl-10 pr-3.5 py-3 rounded-2xl border border-[#CBD5E1] bg-[#F8FAFC] focus:bg-white focus:border-[#1666F2] focus:ring-4 focus:ring-[#1666F2]/10 text-sm font-medium text-[#172B4D] outline-none transition-all"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              data-testid="business-submit-btn"
              className="w-full py-3.5 px-6 rounded-full bg-[#173B70] hover:bg-[#1666F2] text-white font-bold text-sm tracking-wide shadow-md hover:shadow-lg active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{authIntent === 'login' ? 'SIGNING IN...' : 'CREATING BUSINESS ACCOUNT...'}</span>
                </>
              ) : (
                <>
                  <span>
                    {authIntent === 'login' ? 'SIGN IN' : 'CREATE BUSINESS ACCOUNT'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setAuthIntent((prev) => (prev === 'login' ? 'signup' : 'login'));
                clearAlerts();
              }}
              className="text-xs font-semibold text-[#1666F2] hover:underline cursor-pointer"
            >
              {authIntent === 'login'
                ? 'New organization? Create Business Account →'
                : 'Already registered? Sign In to Business Account →'}
            </button>
          </div>
        </div>
      )}

      {/* Account Switch Footer (/login <-> /signup) */}
      <div className="pt-2 text-center text-xs text-[#64748B]">
        {defaultIntent === 'login' ? (
          <>
            New to TripSplitter?{' '}
            <Link href="/signup" className="font-bold text-[#1666F2] hover:underline">
              Create free account
            </Link>
          </>
        ) : (
          <>
            Already have a TripSplitter account?{' '}
            <Link href="/login" className="font-bold text-[#1666F2] hover:underline">
              Sign in
            </Link>
          </>
        )}
      </div>

      {/* Verified Legal & Trust Footer */}
      <footer className="pt-4 border-t border-[#E2E8F0] text-center">
        <p className="text-[11px] text-[#64748B] leading-relaxed">
          By continuing, you agree to TripSplitter&apos;s{' '}
          <Link href="/terms" className="font-semibold text-[#1666F2] hover:underline">
            Terms &amp; Conditions
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="font-semibold text-[#1666F2] hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </footer>
    </div>
  );
};
