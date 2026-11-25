'use client';

import React, { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '../../lib/supabase/client';
import { SplitAuthLayout, TripSplitterLogoMark } from '../../components/auth/SplitAuthLayout';
import {
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Check,
} from 'lucide-react';

function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const supabase = React.useMemo(() => (isSupabaseConfigured ? createClient() : null), []);

  const isMinLength = password.length >= 6;
  const hasNumberOrSpecial = /[0-9!@#$%^&*(),.?":{}|<>]/.test(password);
  const isPasswordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const strengthScore = (isMinLength ? 1 : 0) + (password.length >= 8 ? 1 : 0) + (hasNumberOrSpecial ? 1 : 0);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!isMinLength) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (!isPasswordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setError('Supabase authentication is not configured in .env.local.');
      return;
    }

    setIsLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
        setIsLoading(false);
        return;
      }

      setSuccessMsg('Your password has been updated successfully! Redirecting to login...');
      setTimeout(() => {
        router.push('/login?message=password-updated');
      }, 1200);
    } catch {
      setError('Failed to update password. Your recovery link may have expired.');
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      <div className="space-y-2">
        <div className="lg:hidden mb-3">
          <TripSplitterLogoMark darkText={true} />
        </div>
        <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#172B4D]">Set New Password</h1>
        <p className="text-xs text-[#64748B] mt-1">
          Create a strong password to secure your TripSplit account and UPI records.
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
      <form onSubmit={handleUpdatePassword} className="space-y-4">
        {/* New Password */}
        <div>
          <label className="block text-xs font-semibold text-[#172B4D] mb-1">
            New Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
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

          {/* Password Strength Meter */}
          {password.length > 0 && (
            <div className="mt-2 space-y-1.5">
              <div className="flex gap-1 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    strengthScore === 1
                      ? 'w-1/3 bg-amber-500'
                      : strengthScore === 2
                      ? 'w-2/3 bg-blue-500'
                      : strengthScore === 3
                      ? 'w-full bg-emerald-500'
                      : 'w-0'
                  }`}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-[#64748B]">
                <span className="flex items-center gap-1">
                  <Check className={`w-3 h-3 ${isMinLength ? 'text-emerald-500' : 'text-slate-300'}`} />
                  Min 6 chars
                </span>
                <span className="flex items-center gap-1">
                  <Check
                    className={`w-3 h-3 ${hasNumberOrSpecial ? 'text-emerald-500' : 'text-slate-300'}`}
                  />
                  Number or symbol
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-xs font-semibold text-[#172B4D] mb-1">
            Confirm New Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your new password"
              className={`w-full pl-9 pr-9 py-2 rounded-xl border bg-[#F4F7FB] text-xs font-medium text-[#172B4D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1685D4]/20 transition-all ${
                confirmPassword && !isPasswordsMatch
                  ? 'border-rose-300'
                  : confirmPassword && isPasswordsMatch
                  ? 'border-emerald-300'
                  : 'border-[#E5EAF1]'
              }`}
            />
          </div>
          {confirmPassword && !isPasswordsMatch && (
            <p className="text-[11px] text-rose-500 mt-1">Passwords do not match yet.</p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading || !isPasswordsMatch || !isMinLength}
          className="w-full py-2.5 rounded-xl bg-[#173B70] hover:bg-[#1685D4] disabled:opacity-50 text-white font-bold text-xs tracking-wide shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2"
        >
          <span>{isLoading ? 'Updating Password...' : 'Save New Password'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <SplitAuthLayout>
      <Suspense fallback={<div className="py-12 text-center text-xs text-[#64748B]">Loading reset form...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </SplitAuthLayout>
  );
}
