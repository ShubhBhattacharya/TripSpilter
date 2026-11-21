'use client';

import React from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  TrendingUp,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { formatInr } from '../../lib/upi';

interface SummaryCardsProps {
  totalSpend: number;
  youOwe: number;
  youAreOwed: number;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  totalSpend,
  youOwe,
  youAreOwed,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Total Trip Spend */}
      <div className="relative p-5 rounded-2xl bg-gradient-to-b from-[#111827] to-[#0d1527] border border-[#1F2937] hover:border-slate-700 transition-all shadow-xl group overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-blue-500/10 transition-colors" />
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Trip Spend
          </span>
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
            <Wallet className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-extrabold text-white num-inr tracking-tight">
            {formatInr(totalSpend)}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          <span>Across all active & upcoming outings</span>
        </div>
      </div>

      {/* You Owe */}
      <div className="relative p-5 rounded-2xl bg-gradient-to-b from-[#111827] to-[#0d1527] border border-[#1F2937] hover:border-amber-500/30 transition-all shadow-xl group overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/10 transition-colors" />
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
            You Owe
          </span>
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
            <ArrowUpRight className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-extrabold text-amber-300 num-inr tracking-tight">
            {formatInr(youOwe)}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
          <span>Pending settlement</span>
          <span className="text-amber-400 font-medium">To 1 member</span>
        </div>
      </div>

      {/* You Are Owed */}
      <div className="relative p-5 rounded-2xl bg-gradient-to-b from-[#111827] to-[#0d1527] border border-[#1F2937] hover:border-emerald-500/30 transition-all shadow-xl group overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/10 transition-colors" />
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            You Are Owed
          </span>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <ArrowDownLeft className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400 num-inr tracking-tight">
            {formatInr(youAreOwed)}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1 text-emerald-300">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            Direct UPI receivable
          </span>
          <span className="text-emerald-400 font-medium">From 2 members</span>
        </div>
      </div>
    </div>
  );
};
