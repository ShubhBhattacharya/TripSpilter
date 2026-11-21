'use client';

import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Receipt,
  CheckCircle2,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { formatInr } from '../../lib/upi';

interface AiBillScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyBill: (billData: {
    merchantName: string;
    totalAmount: number;
    items: { name: string; price: number }[];
  }) => void;
}

export const AiBillScanModal: React.FC<AiBillScanModalProps> = ({
  isOpen,
  onClose,
  onApplyBill,
}) => {
  const [scanning, setScanning] = useState(false);
  const [scannedBill, setScannedBill] = useState<{
    merchant: string;
    date: string;
    billNumber: string;
    items: { name: string; price: number }[];
    subtotal: number;
    gst: number;
    serviceCharge: number;
    total: number;
  } | null>(null);

  if (!isOpen) return null;

  const handleSimulateOcr = () => {
    setScanning(true);
    setScannedBill(null);

    setTimeout(() => {
      setScanning(false);
      setScannedBill({
        merchant: 'Cafe 1947 Riverside Manali',
        date: '25 Nov 2026, 09:42 PM',
        billNumber: 'INV-1947-8821',
        items: [
          { name: 'Woodfired Funghi & Truffle Pizza', price: 950 },
          { name: 'Grilled Rainbow Trout with Herb Butter', price: 1100 },
          { name: 'Penne Alfredo Al Forno', price: 650 },
          { name: 'Himachali Apple Cider & Mocktails (4x)', price: 900 },
        ],
        subtotal: 3600,
        gst: 180,
        serviceCharge: 220,
        total: 4000,
      });
    }, 1500);
  };

  const handleConfirm = () => {
    if (!scannedBill) return;
    onApplyBill({
      merchantName: scannedBill.merchant,
      totalAmount: scannedBill.total,
      items: scannedBill.items,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#111827] border border-[#1F2937] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#1F2937] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-white">AI Bill OCR Scanner</h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  SMART PARSER
                </span>
              </div>
              <p className="text-xs text-slate-400">Instantly extract line items, taxes, and vendor details</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {!scannedBill && !scanning && (
            <div className="border-2 border-dashed border-slate-700 rounded-2xl p-6 flex flex-col items-center justify-center text-center bg-slate-950/60">
              <Receipt className="w-12 h-12 text-slate-500 mb-3" />
              <h4 className="text-sm font-semibold text-white">Upload or Snap Food / Hotel Bill</h4>
              <p className="text-xs text-slate-400 max-w-xs mt-1 mb-4">
                Our vision model recognizes Indian restaurant bills, GST breakup, and calculates individual shares.
              </p>
              <button
                type="button"
                onClick={handleSimulateOcr}
                className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
              >
                <Sparkles className="w-4 h-4" />
                <span>Simulate Scan Cafe 1947 Receipt</span>
              </button>
            </div>
          )}

          {scanning && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="relative">
                <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
                <Sparkles className="w-4 h-4 text-emerald-300 absolute inset-0 m-auto animate-pulse" />
              </div>
              <p className="text-sm font-medium text-white">Scanning Bill with OCR...</p>
              <p className="text-xs text-slate-400">Extracting dishes, pricing, GST & service charge</p>
            </div>
          )}

          {scannedBill && (
            <div className="space-y-3 animate-in fade-in duration-300">
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white">{scannedBill.merchant}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{scannedBill.date} • {scannedBill.billNumber}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Total</span>
                  <span className="text-base font-extrabold text-emerald-400 num-inr">
                    {formatInr(scannedBill.total)}
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-1.5 flex justify-between">
                  <span>Detected Line Items</span>
                  <span>Amount</span>
                </div>
                {scannedBill.items.map((item, index) => (
                  <div key={index} className="flex justify-between text-xs text-slate-200">
                    <span className="truncate pr-2">{item.name}</span>
                    <span className="num-inr font-medium text-slate-300">{formatInr(item.price)}</span>
                  </div>
                ))}

                <div className="border-t border-slate-800 pt-2 space-y-1 text-[11px] text-slate-400">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="num-inr">{formatInr(scannedBill.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST (5%)</span>
                    <span className="num-inr">{formatInr(scannedBill.gst)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Service Charge</span>
                    <span className="num-inr">{formatInr(scannedBill.serviceCharge)}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSimulateOcr}
                  className="px-3 py-2 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-medium"
                >
                  Rescan
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="flex-1 py-2 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20"
                >
                  <span>Apply & Split {formatInr(scannedBill.total)}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
