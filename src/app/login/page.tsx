'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '../../lib/supabase/client';
import { useAuth } from '../../components/auth/AuthProvider';
import {
  Lock,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Info,
} from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/';
  const urlError = searchParams.get('error');
  const urlMessage = searchParams.get('message');

  const { signInAsDemo } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    if (urlError) {
      if (urlError === 'auth-code-error') return 'Authentication code expired or invalid. Please sign in again.';
      if (urlError === 'invalid-auth-request') return 'Invalid authentication session. Please try again.';
      return decodeURIComponent(urlError);
    }
    return null;
  });
  const [successMsg, setSuccessMsg] = useState<string | null>(() => {
    if (urlMessage === 'password-updated') return 'Password updated successfully! You can now sign in with your new password.';
    if (urlMessage === 'email-verified') return 'Email verified successfully! Please enter your credentials to continue.';
    return null;
  });

  const supabase = createClient();

  const handleDemoLogin = () => {
    setError(null);
    signInAsDemo({
      name: 'Aarav Sharma',
      email: 'aarav.sharma@example.com',
      upiId: 'aarav@okhdfcbank',
    });
    setSuccessMsg('Signed in as Demo Traveler! Redirecting to TripSplit...');
    setTimeout(() => {
      router.push(redirectTo);
      router.refresh();
    }, 400);
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!email) {
      setError('Please provide your email address.');
      return;
    }

    // Graceful fallback when Supabase is not yet configured in .env.local
    if (!isSupabaseConfigured) {
      const displayName = email.split('@')[0] || 'Traveler';
      signInAsDemo({
        name: displayName.charAt(0).toUpperCase() + displayName.slice(1),
        email: email.trim(),
        upiId: `${displayName.toLowerCase()}@okhdfcbank`,
      });
      setSuccessMsg('Signed in as Demo Traveler! Redirecting...');
      setTimeout(() => {
        router.push(redirectTo);
        router.refresh();
      }, 400);
      return;
    }

    if (!password) {
      setError('Please provide your password.');
      return;
    }

    setIsLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setIsLoading(false);
        return;
      }

      setSuccessMsg('Login successful! Redirecting to TripSplit...');
      setTimeout(() => {
        router.push(redirectTo);
        router.refresh();
      }, 500);
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setSuccessMsg(null);

    // Graceful fallback when Supabase Google OAuth is not yet configured
    if (!isSupabaseConfigured) {
      signInAsDemo({
        name: 'Google Demo Traveler',
        email: 'traveler.google@example.com',
        upiId: 'traveler@okhdfcbank',
      });
      setSuccessMsg('Signed in with Google Demo Account! Redirecting...');
      setTimeout(() => {
        router.push(redirectTo);
        router.refresh();
      }, 400);
      return;
    }

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
            redirectTo
          )}`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (oauthError) {
        setError(oauthError.message);
      }
    } catch {
      setError('Failed to initialize Google login.');
    }
  };

  return (
    <div className="w-full max-w-md bg-white border border-[#E5EAF1] rounded-2xl shadow-xl overflow-hidden p-6 sm:p-8">
      {/* Brand Header */}
      <div className="text-center mb-6">
        <Link href="/" className="inline-flex items-center gap-2.5 mb-3 group">
          <div className="w-10 h-10 rounded-xl bg-[#173B70] text-white flex items-center justify-center font-black text-xl shadow-xs group-hover:bg-[#1685D4] transition-colors">
            <span>₹</span>
          </div>
          <span className="font-extrabold text-xl text-[#172B4D] tracking-tight">TripSplit</span>
        </Link>
        <h1 className="text-xl font-bold text-[#172B4D]">Welcome Back!</h1>
        <p className="text-xs text-[#64748B] mt-1">
          Enter your login information to access your group outings & splits.
        </p>
      </div>

      {/* Non-blocking Demo Mode Notification when Supabase is not configured */}
      {!isSupabaseConfigured && (
        <div className="mb-4 p-3 rounded-xl bg-sky-50 border border-sky-200 flex items-start gap-2.5 text-xs text-sky-900">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-sky-600" />
          <div className="text-left">
            <p className="font-bold text-sky-950">Demo & Preview Mode Active</p>
            <p className="text-[11px] text-sky-800 mt-0.5 leading-relaxed">
              Supabase cloud credentials are not set in <code className="bg-sky-100/80 px-1 py-0.5 rounded font-mono text-[10px]">.env.local</code>. You can test all features using Google Demo, Email, or the Guest button below without interruption.
            </p>
          </div>
        </div>
      )}

      {/* Google OAuth Option */}
      <button
        type="button"
        onClick={handleGoogleLogin}
        className="w-full py-2.5 px-4 rounded-xl border border-[#E5EAF1] bg-[#F4F7FB]/50 hover:bg-[#F4F7FB] text-xs font-semibold text-[#172B4D] flex items-center justify-center gap-2.5 transition-all shadow-2xs hover:shadow-xs active:scale-[0.99] mb-3 cursor-pointer"
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

      {/* Seamless Demo / Guest Traveler Button */}
      <button
        type="button"
        onClick={handleDemoLogin}
        className="w-full py-2.5 px-4 rounded-xl border border-dashed border-[#1685D4] bg-[#F0F7FF] hover:bg-[#E0EFFF] text-xs font-bold text-[#1685D4] flex items-center justify-center gap-2 transition-all active:scale-[0.99] mb-4 cursor-pointer shadow-2xs"
      >
        <Sparkles className="w-4 h-4 text-[#1685D4]" />
        <span>Continue as Demo / Guest Traveler</span>
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-px bg-[#E5EAF1]" />
        <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">or continue with email</span>
        <div className="flex-1 h-px bg-[#E5EAF1]" />
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleEmailLogin} className="space-y-4">
        {/* Email */}
        <div>
          <label className="block text-xs font-semibold text-[#172B4D] mb-1">
            Email Address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="aarav@example.com"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E5EAF1] bg-[#F4F7FB] text-xs font-medium text-[#172B4D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1685D4]/20 focus:border-[#1685D4] transition-all"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-[#172B4D]">Password</label>
            <Link
              href="/forgot-password"
              className="text-[11px] font-semibold text-[#1685D4] hover:underline"
            >
              Forgot Password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type={showPassword ? 'text' : 'password'}
              required={isSupabaseConfigured}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSupabaseConfigured ? 'Enter your password' : 'Enter password (optional in demo mode)'}
              className="w-full pl-9 pr-9 py-2 rounded-xl border border-[#E5EAF1] bg-[#F4F7FB] text-xs font-medium text-[#172B4D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1685D4]/20 focus:border-[#1685D4] transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#172B4D]"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Remember Me */}
        <div className="flex items-center gap-2">
          <input
            id="rememberMe"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-4 h-4 accent-[#1685D4] rounded cursor-pointer"
          />
          <label htmlFor="rememberMe" className="text-xs text-[#64748B] select-none cursor-pointer">
            Remember me on this browser
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 rounded-xl bg-[#173B70] hover:bg-[#1685D4] text-white font-bold text-xs tracking-wide shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>{isLoading ? 'Signing In...' : 'Sign In'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      {/* Footer Link */}
      <div className="mt-6 pt-4 border-t border-[#E5EAF1] text-center text-xs text-[#64748B]">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="font-bold text-[#1685D4] hover:underline">
          Sign Up Free
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#F4F7FB] flex flex-col justify-center items-center p-4">
      <Suspense fallback={<div className="text-xs text-[#64748B]">Loading login...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
