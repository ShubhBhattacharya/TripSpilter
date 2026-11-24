'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '../../lib/supabase/client';
import { useAuth } from '../../components/auth/AuthProvider';
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
  Sparkles,
  Info,
} from 'lucide-react';

function SignupForm() {
  const router = useRouter();
  const { signInAsDemo } = useAuth();

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

  const handleDemoSignup = () => {
    setError(null);
    signInAsDemo({
      name: 'Aarav Sharma',
      email: 'aarav.sharma@example.com',
      upiId: 'aarav@okhdfcbank',
    });
    setSuccessMsg('Account created as Demo Traveler! Redirecting to TripSplit...');
    setTimeout(() => {
      router.push('/');
      router.refresh();
    }, 400);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!fullName.trim() || !email.trim()) {
      setError('Please fill in your name and email address.');
      return;
    }

    if (!agreedToTerms) {
      setError('Please accept the Terms of Service & Privacy Policy.');
      return;
    }

    // Graceful fallback when Supabase is not yet configured in .env.local
    if (!isSupabaseConfigured) {
      const cleanName = fullName.trim();
      signInAsDemo({
        name: cleanName,
        email: email.trim(),
        upiId: `${cleanName.toLowerCase().replace(/\s+/g, '')}@okhdfcbank`,
      });
      setSuccessMsg('Account registered in Demo Mode! Redirecting to TripSplit...');
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 500);
      return;
    }

    if (!password) {
      setError('Please provide a password.');
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

    // Graceful fallback when Supabase is not configured
    if (!isSupabaseConfigured) {
      signInAsDemo({
        name: 'Google Demo Traveler',
        email: 'traveler.google@example.com',
        upiId: 'traveler@okhdfcbank',
      });
      setSuccessMsg('Signed up with Google Demo Account! Redirecting...');
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 400);
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

      {/* Non-blocking Demo Mode Notification when Supabase is not configured */}
      {!isSupabaseConfigured && (
        <div className="mb-4 p-3 rounded-xl bg-sky-50 border border-sky-200 flex items-start gap-2.5 text-xs text-sky-900">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-sky-600" />
          <div className="text-left">
            <p className="font-bold text-sky-950">Demo & Preview Mode Active</p>
            <p className="text-[11px] text-sky-800 mt-0.5 leading-relaxed">
              Supabase cloud credentials are not set in <code className="bg-sky-100/80 px-1 py-0.5 rounded font-mono text-[10px]">.env.local</code>. You can register with any credentials or click the Guest button below to test without interruption.
            </p>
          </div>
        </div>
      )}

      {/* Google OAuth Option */}
      <button
        type="button"
        onClick={handleGoogleSignup}
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
        onClick={handleDemoSignup}
        className="w-full py-2.5 px-4 rounded-xl border border-dashed border-[#1685D4] bg-[#F0F7FF] hover:bg-[#E0EFFF] text-xs font-bold text-[#1685D4] flex items-center justify-center gap-2 transition-all active:scale-[0.99] mb-4 cursor-pointer shadow-2xs"
      >
        <Sparkles className="w-4 h-4 text-[#1685D4]" />
        <span>Continue as Demo / Guest Traveler</span>
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
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="98765 43210"
                maxLength={10}
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
              required={isSupabaseConfigured}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSupabaseConfigured ? 'Create a secure password' : 'Create password (optional in demo)'}
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

        {/* Confirm Password */}
        <div>
          <label className="block text-xs font-semibold text-[#172B4D] mb-1">
            Confirm Password <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type={showPassword ? 'text' : 'password'}
              required={isSupabaseConfigured}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E5EAF1] bg-[#F4F7FB] text-xs font-medium text-[#172B4D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1685D4]/20 focus:border-[#1685D4] transition-all"
            />
          </div>
        </div>

        {/* Password Strength Indicator */}
        {password.length > 0 && isSupabaseConfigured && (
          <div className="space-y-1.5 p-2.5 rounded-xl bg-[#F4F7FB] border border-[#E5EAF1]">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-[#64748B]">Password Strength</span>
              <span
                className={`font-bold ${
                  strengthScore === 3
                    ? 'text-emerald-600'
                    : strengthScore === 2
                    ? 'text-amber-600'
                    : 'text-rose-600'
                }`}
              >
                {strengthScore === 3 ? 'Strong' : strengthScore === 2 ? 'Medium' : 'Weak'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <div
                className={`h-1 rounded-full ${
                  strengthScore >= 1 ? 'bg-rose-500' : 'bg-slate-200'
                }`}
              />
              <div
                className={`h-1 rounded-full ${
                  strengthScore >= 2 ? 'bg-amber-500' : 'bg-slate-200'
                }`}
              />
              <div
                className={`h-1 rounded-full ${
                  strengthScore >= 3 ? 'bg-emerald-500' : 'bg-slate-200'
                }`}
              />
            </div>
            <div className="flex flex-col gap-1 text-[10px] text-[#64748B] pt-1">
              <span className={`flex items-center gap-1 ${isMinLength ? 'text-emerald-600 font-bold' : ''}`}>
                <Check className={`w-3 h-3 ${isMinLength ? 'opacity-100' : 'opacity-30'}`} />
                At least 6 characters
              </span>
              <span className={`flex items-center gap-1 ${isPasswordsMatch ? 'text-emerald-600 font-bold' : ''}`}>
                <Check className={`w-3 h-3 ${isPasswordsMatch ? 'opacity-100' : 'opacity-30'}`} />
                Passwords match
              </span>
            </div>
          </div>
        )}

        {/* Terms and Conditions Checkbox */}
        <div className="flex items-start gap-2 pt-1">
          <input
            id="terms"
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            className="w-4 h-4 mt-0.5 accent-[#1685D4] rounded cursor-pointer"
          />
          <label htmlFor="terms" className="text-xs text-[#64748B] select-none cursor-pointer leading-tight">
            I agree to the{' '}
            <span className="text-[#1685D4] font-semibold hover:underline">Terms of Service</span> and{' '}
            <span className="text-[#1685D4] font-semibold hover:underline">Privacy Policy</span>.
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 rounded-xl bg-[#173B70] hover:bg-[#1685D4] text-white font-bold text-xs tracking-wide shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4 cursor-pointer"
        >
          <span>{isLoading ? 'Creating Account...' : 'Create Account'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      {/* Footer Link */}
      <div className="mt-5 pt-4 border-t border-[#E5EAF1] text-center text-xs text-[#64748B]">
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
      <Suspense fallback={<div className="text-xs text-[#64748B]">Loading signup...</div>}>
        <SignupForm />
      </Suspense>
    </div>
  );
}
