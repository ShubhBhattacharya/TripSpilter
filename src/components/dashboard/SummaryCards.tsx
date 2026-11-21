'use client';

import React from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
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
      {/* 1. Total Trip Expenses */}
      <div className="p-5 rounded-xl bg-white border border-[#E5EAF1] shadow-xs hover:border-[#CBD5E1] transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
            Total Trip Expenses
          </span>
          <div className="w-8 h-8 rounded-lg bg-[#173B70]/10 text-[#173B70] flex items-center justify-center">
            <Wallet className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl sm:text-3xl font-bold text-[#172B4D] num-inr tracking-tight">
          {formatInr(totalSpend)}
        </div>
        <p className="mt-2 text-xs text-[#64748B]">
          Combined spending across your outings
        </p>
      </div>

      {/* 2. You Owe */}
      <div className="p-5 rounded-xl bg-white border border-[#E5EAF1] shadow-xs hover:border-amber-200 transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[#B45309] uppercase tracking-wider">
            You Owe
          </span>
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-[#B45309] flex items-center justify-center">
            <ArrowUpRight className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl sm:text-3xl font-bold text-[#B45309] num-inr tracking-tight">
          {formatInr(youOwe)}
        </div>
        <p className="mt-2 text-xs text-[#64748B]">
          Pending settlements to group members
        </p>
      </div>

      {/* 3. You Are Owed */}
      <div className="p-5 rounded-xl bg-white border border-[#E5EAF1] shadow-xs hover:border-emerald-200 transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[#047857] uppercase tracking-wider">
            You Are Owed
          </span>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#047857] flex items-center justify-center">
            <ArrowDownLeft className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl sm:text-3xl font-bold text-[#047857] num-inr tracking-tight">
          {formatInr(youAreOwed)}
        </div>
        <p className="mt-2 text-xs text-[#64748B]">
          Direct UPI receivables from friends
        </p>
      </div>
    </div>
  );
};
