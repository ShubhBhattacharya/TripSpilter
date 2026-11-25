'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { createClient, isSupabaseConfigured } from '../../lib/supabase/client';
import { SplitAuthLayout, TripSplitterLogoMark } from '../../components/auth/SplitAuthLayout';
import {
  Mail,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  KeyRound,
} from 'lucide-react';

function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const supabase = React.useMemo(() => (isSupabaseConfigured ? createClient() : null), []);

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError('Please provide your account email address.');
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setSuccessMsg(
        `Demo password recovery simulated for ${trimmedEmail}! In live cloud mode with Supabase credentials configured, a secure password reset link is delivered to your inbox.`
      );
      return;
    }

    setIsLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/auth/callback?next=/reset-password`;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: redirectUrl,
      });

      if (resetError) {
        setError(resetError.message);
        setIsLoading(false);
        return;
      }

      setSuccessMsg(
        'Password recovery link sent! Please check your inbox (and spam folder) for instructions to reset your password.'
      );
      setIsLoading(false);
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      <div className="space-y-2">
        <div className="lg:hidden mb-3">
          <TripSplitterLogoMark darkText={true} />
        </div>
        <div className="w-11 h-11 rounded-2xl bg-[#1666F2]/10 text-[#1666F2] flex items-center justify-center mb-1">
          <KeyRound className="w-5 h-5" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#172B4D]">Reset your password</h1>
        <p className="text-sm text-[#64748B]">
          Enter your registered personal or business email and we&apos;ll send a secure password recovery link.
        </p>
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
      <form onSubmit={handleResetRequest} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[#172B4D] mb-1">
            Registered Email Address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. yourname@example.com"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E5EAF1] bg-[#F4F7FB] text-xs font-medium text-[#172B4D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1685D4]/20 focus:border-[#1685D4] transition-all"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 rounded-xl bg-[#173B70] hover:bg-[#1685D4] text-white font-bold text-xs tracking-wide shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <span>{isLoading ? 'Sending Recovery Link...' : 'Send Recovery Link'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      {/* Footer Navigation */}
      <div className="mt-6 pt-4 border-t border-[#E5EAF1] text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#173B70] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Sign In</span>
        </Link>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <SplitAuthLayout>
      <Suspense fallback={<div className="py-12 text-center text-xs text-[#64748B]">Loading recovery form...</div>}>
        <ForgotPasswordForm />
      </Suspense>
    </SplitAuthLayout>
  );
}
