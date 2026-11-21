'use client';

import React from 'react';
import Link from 'next/link';
import { Plus, QrCode, Sparkles, ArrowRight } from 'lucide-react';

interface QuickActionBarProps {
  onCreateTrip: () => void;
  onScanMerchant: () => void;
  onScanBillAi: () => void;
}

export const QuickActionBar: React.FC<QuickActionBarProps> = ({
  onCreateTrip,
  onScanMerchant,
  onScanBillAi,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {/* 1. Create New Outing */}
      <button
        type="button"
        onClick={onCreateTrip}
        className="flex items-center justify-between p-4 rounded-2xl bg-[#111827] border border-[#1F2937] hover:border-emerald-500/50 hover:bg-[#131d30] transition-all group text-left shadow-lg"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center group-hover:scale-105 group-hover:bg-emerald-500/20 transition-all">
            <Plus className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
              Create New Outing
            </h4>
            <p className="text-xs text-slate-400">Plan itinerary & add friends</p>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
      </button>

      {/* 2. Scan Merchant QR (Direct UPI) */}
      <button
        type="button"
        onClick={onScanMerchant}
        className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 to-[#111827] border border-emerald-500/30 hover:border-emerald-500/60 transition-all group text-left shadow-lg relative overflow-hidden"
      >
        <div className="absolute -top-12 -right-12 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-all">
            <QrCode className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                Scan Merchant QR
              </h4>
              <span className="text-[9px] uppercase px-1 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                USP
              </span>
            </div>
            <p className="text-xs text-slate-400">Split & pay vendor directly</p>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-1 transition-all" />
      </button>

      {/* 3. Scan Bill (AI OCR) */}
      <button
        type="button"
        onClick={onScanBillAi}
        className="flex items-center justify-between p-4 rounded-2xl bg-[#111827] border border-[#1F2937] hover:border-teal-500/50 hover:bg-[#131d30] transition-all group text-left shadow-lg"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center group-hover:scale-105 group-hover:bg-teal-500/20 transition-all">
            <Sparkles className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white group-hover:text-teal-300 transition-colors">
              Scan Bill (AI OCR)
            </h4>
            <p className="text-xs text-slate-400">Auto-parse dishes & taxes</p>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-teal-400 group-hover:translate-x-1 transition-all" />
      </button>
    </div>
  );
};
