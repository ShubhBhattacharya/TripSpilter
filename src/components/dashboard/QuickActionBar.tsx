'use client';

import React from 'react';
import Link from 'next/link';
import { Plus, QrCode, Sparkles, ArrowRight, Receipt } from 'lucide-react';

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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* 1. Create New Trip */}
      <button
        type="button"
        onClick={onCreateTrip}
        className="flex items-center justify-between p-4 rounded-xl bg-white border border-[#E5EAF1] hover:border-[#1685D4] hover:shadow-xs transition-all group text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#1685D4]/10 text-[#1685D4] flex items-center justify-center font-bold">
            <Plus className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#172B4D] group-hover:text-[#1685D4] transition-colors">
              Create New Trip
            </h4>
            <p className="text-[11px] text-[#64748B]">Set itinerary & invite friends</p>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-[#CBD5E1] group-hover:text-[#1685D4] group-hover:translate-x-0.5 transition-all" />
      </button>

      {/* 2. Scan Merchant QR */}
      <button
        type="button"
        onClick={onScanMerchant}
        className="flex items-center justify-between p-4 rounded-xl bg-white border border-[#E5EAF1] hover:border-[#0A9B78] hover:shadow-xs transition-all group text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#0A9B78]/10 text-[#0A9B78] flex items-center justify-center font-bold">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#172B4D] group-hover:text-[#0A9B78] transition-colors">
              Scan Merchant QR
            </h4>
            <p className="text-[11px] text-[#64748B]">Instant zero-float standee split</p>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-[#CBD5E1] group-hover:text-[#0A9B78] group-hover:translate-x-0.5 transition-all" />
      </button>

      {/* 3. Upload Bill (OCR) */}
      <button
        type="button"
        onClick={onScanBillAi}
        className="flex items-center justify-between p-4 rounded-xl bg-white border border-[#E5EAF1] hover:border-[#173B70] hover:shadow-xs transition-all group text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#173B70]/10 text-[#173B70] flex items-center justify-center font-bold">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#172B4D] group-hover:text-[#173B70] transition-colors">
              Upload Bill Photo
            </h4>
            <p className="text-[11px] text-[#64748B]">Parse line items & GST</p>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-[#CBD5E1] group-hover:text-[#173B70] group-hover:translate-x-0.5 transition-all" />
      </button>

      {/* 4. Direct QR Split */}
      <Link
        href="/qr-split"
        className="flex items-center justify-between p-4 rounded-xl bg-white border border-[#E5EAF1] hover:border-[#1685D4] hover:shadow-xs transition-all group text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-[#172B4D] flex items-center justify-center font-bold">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#172B4D] group-hover:text-[#1685D4] transition-colors">
              Quick QR Split
            </h4>
            <p className="text-[11px] text-[#64748B]">Generate separate member QRs</p>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-[#CBD5E1] group-hover:text-[#1685D4] group-hover:translate-x-0.5 transition-all" />
      </Link>
    </div>
  );
};
