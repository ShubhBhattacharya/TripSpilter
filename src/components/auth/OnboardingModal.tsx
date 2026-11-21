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
          colors: ['#1685D4', '#0A9B78', '#173B70', '#F59E0B'],
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white border border-[#E5EAF1] rounded-2xl shadow-xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-6 border-b border-[#E5EAF1] text-center bg-[#F4F7FB]/50">
          <div className="w-10 h-10 rounded-xl bg-[#173B70] text-white mx-auto flex items-center justify-center mb-2.5 shadow-xs">
            <Sparkles className="w-5 h-5 text-white stroke-[2]" />
          </div>
          <h3 className="text-lg font-bold text-[#172B4D]">Welcome to TripSplit! 🇮🇳</h3>
          <p className="text-xs text-[#64748B] mt-1 max-w-xs mx-auto">
            Complete your profile to receive zero-float direct UPI settlements from your trip buddies.
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Display Name */}
          <div>
            <label className="block text-xs font-semibold text-[#172B4D] mb-1">
              Display Name *
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                placeholder="e.g. Aarav Sharma"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-white border border-[#E5EAF1] focus:border-[#1685D4] focus:ring-2 focus:ring-[#1685D4]/15 rounded-xl pl-9 pr-3 py-2 text-xs text-[#172B4D] placeholder-slate-400 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* UPI ID */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-[#172B4D]">
                Your Primary UPI ID *
              </label>
              <span className="text-[11px] text-[#0A9B78] font-medium flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Never share PIN
              </span>
            </div>
            <div className="relative">
              <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                placeholder="username@okhdfcbank"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value.toLowerCase())}
                className={`w-full bg-white border rounded-xl pl-9 pr-9 py-2 text-xs font-mono text-[#172B4D] placeholder-slate-400 focus:outline-none transition-colors ${
                  upiId
                    ? isValidUpi
                      ? 'border-[#0A9B78] focus:border-[#0A9B78] focus:ring-2 focus:ring-[#0A9B78]/15'
                      : 'border-amber-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/15'
                    : 'border-[#E5EAF1] focus:border-[#1685D4] focus:ring-2 focus:ring-[#1685D4]/15'
                }`}
              />
              {upiId && (
                <div className="absolute right-3 top-2.5">
                  {isValidUpi ? (
                    <CheckCircle2 className="w-4 h-4 text-[#0A9B78]" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                  )}
                </div>
              )}
            </div>
            <p className="text-[11px] text-[#64748B] mt-1">
              Used when group members settle debts directly to your bank account.
            </p>

            {/* Quick Bank Suffix Suggestions */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-[#64748B]">Quick handles:</span>
              {['@okhdfcbank', '@oksbi', '@paytm', '@ybl', '@icici'].map((suffix) => (
                <button
                  key={suffix}
                  type="button"
                  onClick={() => handleBankSuffix(suffix)}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-[#F4F7FB] border border-[#E5EAF1] text-[#64748B] hover:text-[#1685D4] hover:border-[#1685D4]/40 transition-colors font-mono"
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
              className="w-full py-2.5 px-4 rounded-xl bg-[#1685D4] hover:bg-[#1272B7] disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
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