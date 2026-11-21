'use client';

import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import {
  QrCode,
  Sparkles,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Users,
  Camera,
  RotateCcw,
  Receipt,
  ArrowRight,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { TripMember, SplitMode, MemberSplitShare } from '../../types/trip';
import { generateUpiUri, formatInr } from '../../lib/upi';

interface VendorSplitTabProps {
  members: TripMember[];
  initialVendorName?: string;
  initialVendorUpiId?: string;
  initialAmount?: number;
  onOpenAiScanner?: () => void;
}

export const VendorSplitTab: React.FC<VendorSplitTabProps> = ({
  members,
  initialVendorName = 'Cafe 1947 Manali',
  initialVendorUpiId = 'cafe1947@okicici',
  initialAmount = 4000,
  onOpenAiScanner,
}) => {
  const [vendorName, setVendorName] = useState(initialVendorName);
  const [vendorUpiId, setVendorUpiId] = useState(initialVendorUpiId);
  const [billAmount, setBillAmount] = useState<number>(initialAmount);
  const [splitMode, setSplitMode] = useState<SplitMode>('EQUAL');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(
    members.map((m) => m.id)
  );

  // Exact custom amounts mapping
  const [customAmounts, setCustomAmounts] = useState<{ [id: string]: number }>({});

  // Paid state mapping
  const [paidStatus, setPaidStatus] = useState<{ [id: string]: boolean }>({
    usr_aarav: true,
    usr_priya: true,
    usr_rohan: false,
    usr_kabir: false,
  });

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sync when initial props change (e.g. from bookings split)
  useEffect(() => {
    if (initialVendorName) setVendorName(initialVendorName);
    if (initialVendorUpiId) setVendorUpiId(initialVendorUpiId);
    if (initialAmount) setBillAmount(initialAmount);
  }, [initialVendorName, initialVendorUpiId, initialAmount]);

  // Toggle member participation
  const toggleMemberSelection = (memberId: string) => {
    if (selectedMemberIds.includes(memberId)) {
      if (selectedMemberIds.length > 1) {
        setSelectedMemberIds(selectedMemberIds.filter((id) => id !== memberId));
      }
    } else {
      setSelectedMemberIds([...selectedMemberIds, memberId]);
    }
  };

  // Calculate share for a member
  const getMemberShare = (memberId: string): number => {
    if (!selectedMemberIds.includes(memberId)) return 0;

    if (splitMode === 'EQUAL') {
      const count = selectedMemberIds.length;
      return count > 0 ? Math.round(billAmount / count) : 0;
    }

    if (splitMode === 'EXACT') {
      return customAmounts[memberId] ?? Math.round(billAmount / selectedMemberIds.length);
    }

    if (splitMode === 'ITEMIZED') {
      // Mock itemized split shares
      const ratioMap: { [key: string]: number } = {
        usr_aarav: 0.3,
        usr_priya: 0.25,
        usr_rohan: 0.25,
        usr_kabir: 0.2,
      };
      return Math.round(billAmount * (ratioMap[memberId] || 0.25));
    }

    return 0;
  };

  // Toggle paid status
  const handleTogglePaid = (memberId: string) => {
    const nextStatus = !paidStatus[memberId];
    setPaidStatus((prev) => ({
      ...prev,
      [memberId]: nextStatus,
    }));

    if (nextStatus) {
      // Trigger celebration confetti
      try {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#10B981', '#34D399', '#6EE7B7', '#F59E0B'],
        });
      } catch (err) {
        // fallback
      }
    }
  };

  // Copy UPI Link
  const handleCopyUri = (uri: string, memberId: string) => {
    navigator.clipboard.writeText(uri);
    setCopiedId(memberId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Total collected calculation
  const totalCollected = members.reduce((sum, m) => {
    return sum + (paidStatus[m.id] ? getMemberShare(m.id) : 0);
  }, 0);

  const collectedPercentage =
    billAmount > 0 ? Math.min(100, Math.round((totalCollected / billAmount) * 100)) : 0;

  return (
    <div className="space-y-6">
      {/* USP Banner */}
      <div className="relative p-5 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-[#111827] to-[#111827] border border-emerald-500/30 overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Direct-to-Vendor UPI Splitter
              </span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 font-semibold">
                ZERO ESCROW • ZERO FEES
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-extrabold text-white">
              Every member pays the merchant directly from their own UPI app.
            </h3>
            <p className="text-xs text-slate-300 max-w-2xl">
              No single person pays ₹4,000 upfront and chases friends for days. Scan the standee, enter bill total, and each friend scans their custom QR with their exact share.
            </p>
          </div>

          {/* AI Bill Scan Quick Trigger */}
          <button
            type="button"
            onClick={onOpenAiScanner}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 text-xs font-bold transition-all shrink-0 active:scale-95"
          >
            <Camera className="w-4 h-4 text-teal-300" />
            <span>AI Bill Scan (OCR)</span>
          </button>
        </div>
      </div>

      {/* Bill Configuration Controls: Steps 1 & 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 p-5 rounded-2xl bg-[#111827] border border-[#1F2937] shadow-xl">
        {/* Step 1: Vendor UPI ID & Name */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-black">
                1
              </span>
              Merchant UPI ID
            </label>
            <span className="text-[10px] text-emerald-400 font-mono">Verified VPA</span>
          </div>

          <div className="space-y-2">
            <input
              type="text"
              value={vendorUpiId}
              onChange={(e) => setVendorUpiId(e.target.value)}
              placeholder="e.g. cafe1947@okicici"
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500 transition-colors"
            />
            <input
              type="text"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="Merchant Name (e.g. Cafe 1947 Manali)"
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 transition-colors"
            />
          </div>
        </div>

        {/* Step 2: Total Bill Amount & Split Mode */}
        <div className="lg:col-span-5 space-y-3">
          <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-black">
              2
            </span>
            Total Bill Amount (₹)
          </label>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-2.5 text-slate-500 font-bold text-sm">₹</span>
              <input
                type="number"
                value={billAmount}
                onChange={(e) => setBillAmount(Number(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pl-8 pr-3 py-2 text-base font-extrabold text-white num-inr"
              />
            </div>
            {/* Quick quick-set buttons */}
            {[2000, 4000, 6000].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setBillAmount(amt)}
                className="px-2.5 py-1 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 num-inr"
              >
                ₹{amt / 1000}k
              </button>
            ))}
          </div>

          {/* Split Mode Selector */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            {(['EQUAL', 'EXACT', 'ITEMIZED'] as SplitMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSplitMode(mode)}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition-all ${
                  splitMode === mode
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {mode === 'EQUAL' && 'Equal Split'}
                {mode === 'EXACT' && 'Exact Custom'}
                {mode === 'ITEMIZED' && 'Itemized'}
              </button>
            ))}
          </div>
        </div>

        {/* Step 3 Progress & Quick Stats */}
        <div className="lg:col-span-3 flex flex-col justify-between p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Collection Status</span>
              <span className="font-bold text-white num-inr">{collectedPercentage}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden mb-2">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${collectedPercentage}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-emerald-400 font-bold num-inr">
                {formatInr(totalCollected)} Paid
              </span>
              <span className="text-amber-400 font-medium num-inr">
                {formatInr(Math.max(0, billAmount - totalCollected))} Left
              </span>
            </div>
          </div>

          <div className="text-[10px] text-slate-300 mt-2 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Funds transfer directly to merchant account</span>
          </div>
        </div>
      </div>

      {/* Member Selection Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider shrink-0">
          Split Among:
        </span>
        {members.map((member) => {
          const isSelected = selectedMemberIds.includes(member.id);
          return (
            <button
              key={member.id}
              type="button"
              onClick={() => toggleMemberSelection(member.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                isSelected
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                  : 'bg-slate-900 text-slate-400 border-slate-800 opacity-50'
              }`}
            >
              <img
                src={member.avatar}
                alt={member.name}
                className="w-5 h-5 rounded-full object-cover"
              />
              <span>{member.name.split(' ')[0]}</span>
              {isSelected && <Check className="w-3 h-3 text-emerald-400" />}
            </button>
          );
        })}
      </div>

      {/* STEP 3: SEPARATE MEMBER QR GRID */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-[10px] font-black">
                3
              </span>
              Dynamic Member UPI QR Cards
            </h4>
            <span className="text-xs text-slate-400">
              ({selectedMemberIds.length} shares generated)
            </span>
          </div>
          <span className="text-xs text-emerald-400 font-medium">
            Scan via GPay, PhonePe, Paytm, BHIM, Cred
          </span>
        </div>

        {/* Member QR Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {members.map((member) => {
            const share = getMemberShare(member.id);
            const isSelected = selectedMemberIds.includes(member.id);
            const isPaid = paidStatus[member.id];

            if (!isSelected) return null;

            // Generate precise UPI payment URI
            const upiUri = generateUpiUri({
              payeeVpa: vendorUpiId,
              payeeName: vendorName,
              amount: share,
              transactionNote: `TripSplit ${member.name.split(' ')[0]} - ${vendorName}`,
            });

            return (
              <div
                key={member.id}
                className={`relative flex flex-col justify-between rounded-2xl p-4 transition-all duration-200 border ${
                  isPaid
                    ? 'bg-[#111827] border-emerald-500/40 shadow-emerald-500/5'
                    : 'bg-[#111827] border-[#1F2937] hover:border-slate-700 shadow-xl'
                }`}
              >
                {/* Member Header */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={member.avatar}
                      alt={member.name}
                      className="w-8 h-8 rounded-full object-cover ring-2 ring-slate-800 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{member.name}</p>
                      <p className="text-[10px] text-slate-300 font-mono truncate">
                        {member.upiId}
                      </p>
                    </div>
                  </div>

                  {/* Status Toggle Badge */}
                  <button
                    type="button"
                    onClick={() => handleTogglePaid(member.id)}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all flex items-center gap-1 active:scale-95 ${
                      isPaid
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                    }`}
                  >
                    {isPaid ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Paid ✅</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span>Pending ⏳</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Share Amount Box */}
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-center mb-3">
                  <span className="text-[10px] text-slate-300 uppercase block tracking-wider font-semibold">
                    Pay Direct to Vendor
                  </span>
                  <div className="text-xl font-extrabold text-white num-inr mt-0.5">
                    {formatInr(share)}
                  </div>
                </div>

                {/* Dynamic QR Code Canvas */}
                <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-white shadow-inner mb-3">
                  <QRCodeSVG
                    value={upiUri}
                    size={135}
                    level="M"
                    includeMargin={false}
                    className="rounded"
                  />
                  <div className="mt-1.5 flex items-center gap-1 text-[9px] text-slate-700 font-semibold tracking-tight">
                    <span>Pay {vendorName.slice(0, 18)}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-1.5">
                  {/* Direct Deep link */}
                  <a
                    href={upiUri}
                    className="w-full py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition-all text-center"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Pay via UPI App</span>
                  </a>

                  {/* Copy Link Button */}
                  <button
                    type="button"
                    onClick={() => handleCopyUri(upiUri, member.id)}
                    className="w-full py-1.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] font-medium flex items-center justify-center gap-1 transition-colors"
                  >
                    {copiedId === member.id ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">UPI Link Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-slate-500" />
                        <span>Copy UPI Deep Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
