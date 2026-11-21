'use client';

import React from 'react';
import Link from 'next/link';
import {
  QrCode,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import { currentUser, userSummaryStats } from '../../data/mockData';

interface TopHeaderProps {
  onScanClick?: () => void;
  title?: string;
}

export const TopHeader: React.FC<TopHeaderProps> = ({ onScanClick, title }) => {
  return (
    <header className="sticky top-0 z-40 bg-[#0B1120]/90 backdrop-blur-md border-b border-[#1F2937] px-4 lg:px-8 py-3 transition-colors">
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        {/* Left: Mobile Brand / Page Title */}
        <div className="flex items-center gap-3">
          <div className="lg:hidden flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-slate-950 text-sm">
                ₹
              </div>
              <span className="font-extrabold text-base text-white">TripSplit</span>
            </Link>
          </div>
          {title && (
            <div className="hidden lg:flex items-center gap-2 text-sm text-slate-400">
              <span className="text-slate-600">/</span>
              <span className="text-white font-medium">{title}</span>
            </div>
          )}
        </div>

        {/* Center / Right: Quick Live UPI Balances & Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Balance Pills (Desktop) */}
          <div className="hidden md:flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
              <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
              <span>You Owe:</span>
              <strong className="num-inr font-bold">₹{userSummaryStats.youOwe.toLocaleString('en-IN')}</strong>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
              <span>You Are Owed:</span>
              <strong className="num-inr font-bold">₹{userSummaryStats.youAreOwed.toLocaleString('en-IN')}</strong>
            </div>
          </div>

          {/* Quick Direct Scan Button */}
          <button
            type="button"
            onClick={onScanClick}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-slate-950 font-semibold text-xs shadow-md shadow-emerald-500/20 hover:brightness-110 active:scale-95 transition-all"
          >
            <QrCode className="w-4 h-4 stroke-[2.2]" />
            <span className="hidden sm:inline">Scan Merchant QR</span>
            <span className="sm:hidden">Scan</span>
          </button>

          {/* User profile avatar thumbnail */}
          <div className="flex items-center pl-1 sm:pl-2">
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-8 h-8 rounded-full object-cover ring-2 ring-emerald-500/30"
            />
          </div>
        </div>
      </div>
    </header>
  );
};
