'use client';

import React, { useState } from 'react';
import {
  X,
  QrCode,
  Camera,
  Upload,
  CheckCircle2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface ScanMerchantQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVendor: (vendor: { name: string; upiId: string; amount?: number }) => void;
}

export const ScanMerchantQrModal: React.FC<ScanMerchantQrModalProps> = ({
  isOpen,
  onClose,
  onSelectVendor,
}) => {
  const [manualUpi, setManualUpi] = useState('');
  const [merchantName, setMerchantName] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scannedSuccess, setScannedSuccess] = useState(false);

  if (!isOpen) return null;

  const sampleVendors = [
    { name: 'Cafe 1947 Manali', upiId: 'cafe1947@okicici', tag: 'Dinner / Cafe' },
    { name: 'Zostel Manali Hostel', upiId: 'zostel.manali@hdfcbank', tag: 'Stay / Dorm' },
    { name: 'Solang Aero Sports Club', upiId: 'solangvalley@icici', tag: 'Activities' },
    { name: 'Murthal Haveli Restaurant', upiId: 'haveli.murthal@paytm', tag: 'Dhaba' },
  ];

  const handleSimulateScan = (vendor: { name: string; upiId: string }) => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setScannedSuccess(true);
      setTimeout(() => {
        onSelectVendor(vendor);
        onClose();
        setScannedSuccess(false);
      }, 700);
    }, 1200);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualUpi) return;
    onSelectVendor({
      name: merchantName || manualUpi.split('@')[0].toUpperCase(),
      upiId: manualUpi,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#111827] border border-[#1F2937] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#1F2937] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Scan Merchant UPI QR</h3>
              <p className="text-xs text-slate-400">Scan at bill counter to generate instant split</p>
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

        {/* Viewfinder Area */}
        <div className="p-5 flex flex-col items-center">
          <div className="relative w-64 h-64 rounded-2xl bg-slate-950 border-2 border-dashed border-slate-700 flex flex-col items-center justify-center overflow-hidden group">
            {/* Corner styling */}
            <div className="absolute top-2 left-2 w-5 h-5 border-t-2 border-l-2 border-emerald-400 rounded-tl" />
            <div className="absolute top-2 right-2 w-5 h-5 border-t-2 border-r-2 border-emerald-400 rounded-tr" />
            <div className="absolute bottom-2 left-2 w-5 h-5 border-b-2 border-l-2 border-emerald-400 rounded-bl" />
            <div className="absolute bottom-2 right-2 w-5 h-5 border-b-2 border-r-2 border-emerald-400 rounded-br" />

            {isScanning ? (
              <div className="w-full h-full flex flex-col items-center justify-center relative">
                <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-bounce shadow-lg shadow-emerald-400/50" />
                <Camera className="w-10 h-10 text-emerald-400 animate-pulse mb-2" />
                <span className="text-xs text-emerald-300 font-medium">Detecting Merchant QR...</span>
              </div>
            ) : scannedSuccess ? (
              <div className="flex flex-col items-center text-center p-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce mb-2" />
                <span className="text-sm font-semibold text-white">Merchant QR Detected!</span>
                <span className="text-xs text-emerald-300">Generating member split codes...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center p-4">
                <Camera className="w-10 h-10 text-slate-500 mb-2 group-hover:text-emerald-400 transition-colors" />
                <p className="text-xs text-slate-400 font-medium">Point camera at BharatPe, Paytm, PhonePe or GPay Standee</p>
                <button
                  type="button"
                  onClick={() => handleSimulateScan(sampleVendors[0])}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-medium border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
                >
                  ⚡ Simulate Scan Cafe 1947
                </button>
              </div>
            )}
          </div>

          {/* Quick Mock Vendors */}
          <div className="w-full mt-5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              Or pick frequent trip vendor
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {sampleVendors.map((vendor) => (
                <button
                  key={vendor.upiId}
                  type="button"
                  onClick={() => handleSimulateScan(vendor)}
                  className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-left transition-all hover:bg-slate-850 flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs font-semibold text-white">{vendor.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{vendor.upiId}</p>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                    {vendor.tag}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Manual Input Form */}
          <form onSubmit={handleManualSubmit} className="w-full mt-4 pt-4 border-t border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              Or enter Merchant UPI ID manually
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="merchant@okhdfcbank"
                value={manualUpi}
                onChange={(e) => setManualUpi(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
              />
              <button
                type="submit"
                disabled={!manualUpi}
                className="px-4 py-2 bg-emerald-500 disabled:opacity-40 text-slate-950 font-semibold rounded-xl text-xs hover:bg-emerald-400 transition-colors flex items-center gap-1"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
