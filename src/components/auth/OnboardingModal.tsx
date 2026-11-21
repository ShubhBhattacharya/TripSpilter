'use client';

import React, { useState } from 'react';
import { useAuth } from './AuthProvider';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  User,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const OnboardingModal: React.FC = () => {
  const { showOnboarding, setShowOnboarding, profile, user, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState(
    profile?.display_name || user?.user_metadata?.full_name || ''
  );
  const [upiId, setUpiId] = useState(profile?.upi_id || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!showOnboarding) return null;

  // Strict Indian UPI ID regex validation (e.g. name@bank)
  const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
  const isValidUpi = upiRegex.test(upiId.trim());

  const handleBankSuffix = (suffix: string) => {
    const base = upiId.includes('@') ? upiId.split('@')[0] : upiId;
    setUpiId(`${base || 'yourname'}${suffix}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!displayName.trim()) {
      setError('Please provide a display name so your friends recognize you.');
      return;
    }

    if (!isValidUpi) {
      setError('Please enter a valid Indian UPI ID (e.g., name@okhdfcbank or 9876543210@paytm).');
      return;
    }

    setIsSubmitting(true);
    const success = await updateProfile({
      displayName: displayName.trim(),
      upiId: upiId.trim().toLowerCase(),
    });

    setIsSubmitting(false);

    if (success) {
      try {
        confetti({
          particleCount: 80,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#10B981', '#34D399', '#6EE7B7', '#F59E0B'],
        });
      } catch {
        // ignore
      }
      setShowOnboarding(false);
    } else {
      setError('Failed to save profile. Please check your connection and try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#111827] border border-[#1F2937] rounded-3xl shadow-2xl overflow-hidden flex flex-col relative">
        <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Modal Header */}
        <div className="p-6 border-b border-[#1F2937] text-center relative">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-slate-950 font-bold mx-auto flex items-center justify-center mb-3 shadow-lg shadow-emerald-500/25">
            <Sparkles className="w-6 h-6 stroke-[2.2]" />
          </div>
          <h3 className="text-xl font-extrabold text-white">Welcome to TripSplit! 🇮🇳</h3>
          <p className="text-xs text-slate-400 mt-1">
            Complete your profile to receive zero-float direct UPI settlements from your trip buddies.
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Display Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Display Name *
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                placeholder="e.g. Aarav Sharma"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* UPI ID */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Your Primary UPI ID *
              </label>
              <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Never share PIN
              </span>
            </div>
            <div className="relative">
              <CreditCard className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                placeholder="username@okhdfcbank"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value.toLowerCase())}
                className={`w-full bg-slate-950 border rounded-xl pl-10 pr-10 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:outline-none transition-colors ${
                  upiId
                    ? isValidUpi
                      ? 'border-emerald-500/60 focus:border-emerald-400'
                      : 'border-amber-500/60 focus:border-amber-400'
                    : 'border-slate-800 focus:border-emerald-500'
                }`}
              />
              {upiId && (
                <div className="absolute right-3.5 top-3">
                  {isValidUpi ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                  )}
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-300 mt-1">
              Used when group members settle debts directly to your bank account.
            </p>

            {/* Quick Bank Suffix Suggestions */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-slate-300">Quick handles:</span>
              {['@okhdfcbank', '@oksbi', '@paytm', '@ybl', '@icici'].map((suffix) => (
                <button
                  key={suffix}
                  type="button"
                  onClick={() => handleBankSuffix(suffix)}
                  className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 hover:border-emerald-500/40 transition-colors font-mono"
                >
                  {suffix}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !displayName || !isValidUpi}
              className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-98 transition-all"
            >
              {isSubmitting ? (
                <span>Saving Profile...</span>
              ) : (
                <>
                  <span>Save & Enter TripSplit</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
