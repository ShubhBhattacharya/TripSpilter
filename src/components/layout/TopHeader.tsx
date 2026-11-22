'use client';

import React from 'react';
import Link from 'next/link';
import {
  QrCode,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';

interface TopHeaderProps {
  onScanClick?: () => void;
  title?: string;
  youOwe?: number;
  youAreOwed?: number;
}

export const TopHeader: React.FC<TopHeaderProps> = ({ onScanClick, title, youOwe, youAreOwed }) => {
  const { profile, user, signOut } = useAuth();
  const activeAvatar =
    profile?.avatar_url || user?.user_metadata?.avatar_url || '';
  const activeName = profile?.display_name || user?.user_metadata?.full_name || (user ? 'Account' : 'Traveler');

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E5EAF1] px-4 lg:px-8 py-3 transition-colors shadow-xs">
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        {/* Left: Mobile Brand / Page Title */}
        <div className="flex items-center gap-3">
          <div className="lg:hidden flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#173B70] flex items-center justify-center font-bold text-white text-sm">
                ₹
              </div>
              <span className="font-bold text-base text-[#172B4D]">TripSplit</span>
            </Link>
          </div>
          {title && (
            <div className="hidden lg:flex items-center gap-2 text-sm text-[#64748B]">
              <span className="text-[#CBD5E1]">/</span>
              <span className="text-[#172B4D] font-medium">{title}</span>
            </div>
          )}
        </div>

        {/* Right: Quick UPI Balances & Scan Action */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Balance Pills (Desktop) — Only displayed when live receivables/payables exist */}
          <div className="hidden md:flex items-center gap-2 text-xs">
            {youOwe !== undefined && youOwe > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200/60 text-[#B45309]">
                <ArrowUpRight className="w-3.5 h-3.5 text-amber-600" />
                <span className="font-medium">You Owe:</span>
                <strong className="num-inr font-bold">₹{youOwe.toLocaleString('en-IN')}</strong>
              </div>
            )}

            {youAreOwed !== undefined && youAreOwed > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200/60 text-[#047857]">
                <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-medium">You Are Owed:</span>
                <strong className="num-inr font-bold">₹{youAreOwed.toLocaleString('en-IN')}</strong>
              </div>
            )}
          </div>

          {/* Quick Direct Scan Button */}
          <button
            type="button"
            onClick={onScanClick}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#1685D4] hover:bg-[#126bb0] text-white font-medium text-xs shadow-xs active:scale-95 transition-all"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Scan Merchant QR</span>
            <span className="sm:hidden">Scan QR</span>
          </button>

          {/* User profile avatar thumbnail */}
          <div className="flex items-center pl-1 sm:pl-2">
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Do you want to sign out of TripSplit?')) {
                  signOut();
                }
              }}
              title={`${activeName} (Click to Sign Out)`}
            >
              <img
                src={activeAvatar}
                alt={activeName}
                className="w-8 h-8 rounded-full object-cover ring-2 ring-[#E5EAF1] hover:ring-[#1685D4] transition-all cursor-pointer"
              />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
