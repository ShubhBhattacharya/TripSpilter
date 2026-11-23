'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '../../lib/supabase/client';
import {
  Lock,
  Mail,
  User,
  Phone,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Check,
} from 'lucide-react';

function SignupForm() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const supabase = createClient();

  // Password strength checks
  const isMinLength = password.length >= 6;
  const hasNumberOrSpecial = /[0-9!@#$%^&*(),.?":{}|<>]/.test(password);
  const isPasswordsMatch = password === confirmPassword && confirmPassword.length > 0;

  // Strength score: 0 to 3
  const strengthScore = (isMinLength ? 1 : 0) + (password.length >= 8 ? 1 : 0) + (hasNumberOrSpecial ? 1 : 0);

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

    if (!agreedToTerms) {
      setError('Please accept the Terms of Service & Privacy Policy.');
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
            phone: phone.trim() ? `+91${phone.trim()}` : null,
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
        setSuccessMsg('Account created successfully! Redirecting to setup...');
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

  const handleGoogleSignup = async () => {
    setError(null);

    if (!isSupabaseConfigured) {
      setError(
        'Google OAuth requires Supabase authentication setup in .env.local.'
      );
      return;
    }

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
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
      setError('Failed to initialize Google signup.');
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
        <h1 className="text-xl font-bold text-[#172B4D]">Create Your Account</h1>
        <p className="text-xs text-[#64748B] mt-1">
          Join thousands of travelers splitting bills directly with zero holding fees.
        </p>
      </div>

      {/* Google OAuth Option */}
      <button
        type="button"
        onClick={handleGoogleSignup}
        className="w-full py-2.5 px-4 rounded-xl border border-[#E5EAF1] bg-[#F4F7FB]/50 hover:bg-[#F4F7FB] text-xs font-semibold text-[#172B4D] flex items-center justify-center gap-2.5 transition-all shadow-2xs hover:shadow-xs active:scale-[0.99] mb-4"
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
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-px bg-[#E5EAF1]" />
        <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">or sign up with email</span>
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

      {/* Registration Form */}
      <form onSubmit={handleSignup} className="space-y-3.5">
        {/* Full Name */}
        <div>
          <label className="block text-xs font-semibold text-[#172B4D] mb-1">
            Full Name <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Aarav Sharma"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E5EAF1] bg-[#F4F7FB] text-xs font-medium text-[#172B4D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1685D4]/20 focus:border-[#1685D4] transition-all"
            />
          </div>
        </div>

        {/* Email Address */}
        <div>
          <label className="block text-xs font-semibold text-[#172B4D] mb-1">
            Email Address <span className="text-rose-500">*</span>
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

        {/* Mobile Number with Country Code (+91) */}
        <div>
          <label className="block text-xs font-semibold text-[#172B4D] mb-1">
            Mobile Number <span className="text-[10px] text-[#64748B] font-normal">(for trip invitations)</span>
          </label>
          <div className="flex gap-2">
            <span className="px-3 py-2 rounded-xl border border-[#E5EAF1] bg-[#F4F7FB] text-xs font-semibold text-[#172B4D] flex items-center">
              🇮🇳 +91
            </span>
            <div className="relative flex-1">
              <Phone className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                placeholder="98765 43210"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E5EAF1] bg-[#F4F7FB] text-xs font-medium text-[#172B4D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1685D4]/20 focus:border-[#1685D4] transition-all"
              />
            </div>
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="block text-xs font-semibold text-[#172B4D] mb-1">
            Password <span className="text-rose-500">*</span>
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

          {/* Password Strength Indicator */}
          {password.length > 0 && (
            <div className="mt-1.5 space-y-1">
              <div className="flex gap-1 h-1">
                <div
                  className={`flex-1 rounded-full ${
                    strengthScore >= 1 ? 'bg-amber-400' : 'bg-slate-200'
                  }`}
                />
                <div
                  className={`flex-1 rounded-full ${
                    strengthScore >= 2 ? 'bg-sky-400' : 'bg-slate-200'
                  }`}
                />
                <div
                  className={`flex-1 rounded-full ${
                    strengthScore >= 3 ? 'bg-emerald-500' : 'bg-slate-200'
                  }`}
                />
              </div>
              <p className="text-[10px] text-[#64748B]">
                {strengthScore <= 1 && 'Weak password'}
                {strengthScore === 2 && 'Good password'}
                {strengthScore >= 3 && 'Strong password'}
              </p>
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-xs font-semibold text-[#172B4D] mb-1">
            Confirm Password <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your password"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E5EAF1] bg-[#F4F7FB] text-xs font-medium text-[#172B4D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1685D4]/20 focus:border-[#1685D4] transition-all"
            />
          </div>
          {confirmPassword && (
            <p className="text-[10px] mt-1 flex items-center gap-1 font-medium">
              {isPasswordsMatch ? (
                <span className="text-emerald-600 flex items-center gap-0.5">
                  <Check className="w-3 h-3" /> Passwords match
                </span>
              ) : (
                <span className="text-rose-500">Passwords do not match</span>
              )}
            </p>
          )}
        </div>

        {/* Terms & Privacy acceptance */}
        <div className="pt-1 flex items-start gap-2">
          <input
            id="terms"
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            className="w-4 h-4 mt-0.5 accent-[#1685D4] rounded cursor-pointer"
          />
          <label htmlFor="terms" className="text-[11px] text-[#64748B] leading-tight select-none cursor-pointer">
            I accept TripSplit&apos;s <span className="text-[#1685D4] underline font-medium">Terms of Service</span> and acknowledge the <span className="text-[#1685D4] underline font-medium">Privacy Policy</span>. We never ask for your UPI PIN.
          </label>
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-xl bg-[#173B70] hover:bg-[#1685D4] text-white font-bold text-xs tracking-wide shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <span>{isLoading ? 'Creating Your Account...' : 'Sign Up Free'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* Footer Link */}
      <div className="mt-6 pt-4 border-t border-[#E5EAF1] text-center text-xs text-[#64748B]">
        Already have an account?{' '}
        <Link href="/login" className="font-bold text-[#1685D4] hover:underline">
          Sign In
        </Link>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-[#F4F7FB] flex flex-col justify-center items-center p-4">
      <Suspense fallback={<div className="text-xs text-[#64748B]">Loading registration...</div>}>
        <SignupForm />
      </Suspense>
    </div>
  );
}
