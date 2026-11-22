'use client';

import React, { useState } from 'react';
import { X, Users, Key, ArrowRight, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface JoinTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoinSuccess?: (tripCode: string) => void;
}

export const JoinTripModal: React.FC<JoinTripModalProps> = ({
  isOpen,
  onClose,
  onJoinSuccess,
}) => {
  const [inviteCode, setInviteCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanCode = inviteCode.trim().toUpperCase();
    if (!cleanCode) {
      setError('Please enter a 6-digit trip invite code or link.');
      return;
    }

    setIsJoining(true);
    setTimeout(() => {
      setIsJoining(false);
      toast.success(`Successfully connected to trip "${cleanCode}"! 🚀`);
      if (onJoinSuccess) onJoinSuccess(cleanCode);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white border border-[#E5EAF1] rounded-2xl shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-[#E5EAF1] flex items-center justify-between bg-[#F4F7FB]/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#173B70] text-white flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#172B4D]">Join An Existing Outing</h3>
              <p className="text-[11px] text-[#64748B]">Connect with your travel buddies</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#172B4D] hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#172B4D] mb-1.5">
              Trip Invite Code or Link
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="e.g. MANALI-2026 or paste invite link"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E5EAF1] bg-[#F4F7FB] text-xs font-medium text-[#172B4D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1685D4]/20 focus:border-[#1685D4] uppercase tracking-wide"
              />
            </div>
            <p className="text-[11px] text-[#64748B] mt-1.5">
              Ask your trip organizer for the 6-character code or WhatsApp invite link.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isJoining}
              className="w-full py-3 rounded-xl bg-[#173B70] hover:bg-[#1685D4] text-white font-bold text-xs shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <span>{isJoining ? 'Connecting to Trip...' : 'Join Outing Space'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
