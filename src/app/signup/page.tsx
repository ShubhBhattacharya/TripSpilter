'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '../../lib/supabase/client';
import {
  Lock,
  Mail,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  Check,
  Zap,
} from 'lucide-react';

function SignupForm() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const supabase = createClient();

  // Password strength checks
  const isMinLength = password.length >= 6;
  const hasNumberOrSpecial = /[0-9!@#$%^&*(),.?":{}|<>]/.test(password);
  const isPasswordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!fullName.trim() || !email.trim() || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (!isMinLength) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (!isPasswordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    if (!isSupabaseConfigured) {
      setError(
        'Supabase authentication is not configured in .env.local. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to register live accounts.'
      );
      return;
    }

    setIsLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setIsLoading(false);
        return;
      }

      if (data?.user && data.session) {
        setSuccessMsg('Account created successfully! Redirecting...');
        setTimeout(() => {
          router.push('/');
          router.refresh();
        }, 500);
      } else {
        setSuccessMsg(
          'Verification email sent! Please check your inbox to confirm your account.'
        );
        setIsLoading(false);
      }
    } catch {
      setError('An error occurred during account creation. Please try again.');
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);

    if (!isSupabaseConfigured) {
      setError(
        'Google OAuth requires Supabase authentication setup. Please configure NEXT_PUBLIC_SUPABASE_URL in .env.local.'
      );
      return;
    }

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (oauthError) {
        setError(oauthError.message);
      }
    } catch {
      setError('Failed to initialize Google signup.');
    }
  };

  const handlePreviewMode = () => {
    setIsLoading(true);
    setTimeout(() => {
      router.push('/');
    }, 400);
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-[#172B4D] flex flex-col justify-center items-center p-4">
      {/* Main Container */}
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#173B70] flex items-center justify-center text-white font-bold text-lg shadow-sm">
              ₹
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xl tracking-tight text-[#173B70]">
                  TripSplit
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase rounded bg-[#1685D4]/10 text-[#1685D4]">
                  Register
                </span>
              </div>
              <p className="text-[11px] text-[#64748B]">Direct-to-Vendor UPI Bill Splitter</p>
            </div>
          </Link>
          <h2 className="text-lg font-bold text-[#172B4D]">Create your account</h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Join your friends, manage outings & split restaurant bills via UPI
          </p>
        </div>

        {/* Missing Supabase Configuration Notice */}
        {!isSupabaseConfigured && (
          <div className="mb-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-800">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Supabase Authentication Not Configured</span>
            </div>
            <p className="text-[11px] text-amber-800/90 leading-relaxed">
              Environment variables <code className="bg-amber-100/80 px-1 py-0.5 rounded text-amber-950 font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="bg-amber-100/80 px-1 py-0.5 rounded text-amber-950 font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> are not configured in .env.local.
            </p>
            <div className="pt-1">
              <button
                type="button"
                onClick={handlePreviewMode}
                className="w-full py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Explore in Local Preview Mode</span>
              </button>
            </div>
          </div>
        )}

        {/* Card */}
        <div className="rounded-2xl bg-white border border-[#E5EAF1] p-6 sm:p-7 shadow-sm">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-700 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-800 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Google OAuth Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-50 text-[#172B4D] border border-[#E5EAF1] text-xs font-semibold flex items-center justify-center gap-2.5 transition-colors shadow-xs"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
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
            <span>Continue with Google</span>
          </button>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#E5EAF1]" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase">
              <span className="bg-white px-3 text-[#64748B] font-medium tracking-wider">
                Or register with email
              </span>
            </div>
          </div>

          <form onSubmit={handleSignup} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                Full Name *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Aarav Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-white border border-[#E5EAF1] focus:border-[#1685D4] focus:ring-2 focus:ring-[#1685D4]/15 rounded-xl pl-9 pr-3 py-2 text-xs text-[#172B4D] placeholder-slate-400 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border border-[#E5EAF1] focus:border-[#1685D4] focus:ring-2 focus:ring-[#1685D4]/15 rounded-xl pl-9 pr-3 py-2 text-xs text-[#172B4D] placeholder-slate-400 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                Password *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white border border-[#E5EAF1] focus:border-[#1685D4] focus:ring-2 focus:ring-[#1685D4]/15 rounded-xl pl-9 pr-9 py-2 text-xs text-[#172B4D] placeholder-slate-400 focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                Confirm Password *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-white border border-[#E5EAF1] focus:border-[#1685D4] focus:ring-2 focus:ring-[#1685D4]/15 rounded-xl pl-9 pr-3 py-2 text-xs text-[#172B4D] placeholder-slate-400 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-[#F4F7FB] border border-[#E5EAF1] space-y-1 text-[11px] text-[#64748B]">
              <div className="flex items-center gap-1.5">
                <Check
                  className={`w-3.5 h-3.5 ${
                    isMinLength ? 'text-emerald-600 font-bold' : 'text-slate-300'
                  }`}
                />
                <span className={isMinLength ? 'text-[#172B4D] font-medium' : ''}>At least 6 characters</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check
                  className={`w-3.5 h-3.5 ${
                    hasNumberOrSpecial ? 'text-emerald-600 font-bold' : 'text-slate-300'
                  }`}
                />
                <span className={hasNumberOrSpecial ? 'text-[#172B4D] font-medium' : ''}>
                  Contains number or symbol
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check
                  className={`w-3.5 h-3.5 ${
                    isPasswordsMatch ? 'text-emerald-600 font-bold' : 'text-slate-300'
                  }`}
                />
                <span className={isPasswordsMatch ? 'text-[#172B4D] font-medium' : ''}>Passwords match</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-[#1685D4] hover:bg-[#1272B7] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors disabled:opacity-50 mt-1"
            >
              {isLoading ? (
                <span>Creating Account...</span>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer Navigation */}
          <div className="mt-5 pt-4 border-t border-[#E5EAF1] text-center text-xs text-[#64748B]">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-semibold text-[#1685D4] hover:text-[#1272B7] transition-colors hover:underline"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F4F7FB] flex items-center justify-center text-[#64748B]">
          Loading registration...
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}