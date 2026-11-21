'use client';

import React, { useState, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Camera,
  ShieldCheck,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  Share2,
} from 'lucide-react';
import { TripMember, SplitMode } from '../../types/trip';
import { formatInr } from '../../lib/upi';
import {
  calculateEqualSplit,
  validateAndCalculateExactSplit,
  calculateItemizedSplit,
  ItemizedBillItem,
  toRupees,
  toPaise,
} from '../../lib/financial/split-engine';
import {
  buildVerifiedUpiUri,
  PaymentVerificationState,
  PAYMENT_STATES_CONFIG,
  UPI_VPA_REGEX,
} from '../../lib/financial/upi-engine';
import { toast } from 'sonner';

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

  // Exact custom amounts mapping (in Rupees)
  const [customAmounts, setCustomAmounts] = useState<{ [id: string]: number }>({});

  // Itemized bill items
  const [itemizedList, setItemizedList] = useState<ItemizedBillItem[]>([
    {
      id: 'item-1',
      name: 'Woodfired Truffle Pizza',
      price: 1200,
      assignedMemberIds: members.slice(0, 2).map((m) => m.id),
    },
    {
      id: 'item-2',
      name: 'Grilled Himalayan Trout',
      price: 1400,
      assignedMemberIds: members.slice(1, 3).map((m) => m.id),
    },
    {
      id: 'item-3',
      name: 'Cider & Beverages',
      price: 1400,
      assignedMemberIds: members.map((m) => m.id),
    },
  ]);
  const [gstPercent, setGstPercent] = useState<number>(5);

  // Rich payment state mapping: memberId -> { state, transactionRef }
  const [paymentRecords, setPaymentRecords] = useState<{
    [memberId: string]: {
      state: PaymentVerificationState;
      transactionRef?: string;
    };
  }>({
    [members[0]?.id || 'm1']: { state: 'verified_paid', transactionRef: 'UTR982736152' },
    [members[1]?.id || 'm2']: { state: 'manually_reported_paid' },
  });

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Toggle member participation
  const toggleMemberSelection = (memberId: string) => {
    if (selectedMemberIds.includes(memberId)) {
      if (selectedMemberIds.length > 1) {
        setSelectedMemberIds(selectedMemberIds.filter((id) => id !== memberId));
      } else {
        toast.error('At least one member must be included in the split');
      }
    } else {
      setSelectedMemberIds([...selectedMemberIds, memberId]);
    }
  };

  // Compute precise member shares via financial engine
  const computedShares = useMemo<{ [memberId: string]: number }>(() => {
    if (splitMode === 'EQUAL') {
      try {
        const splits = calculateEqualSplit({
          totalAmount: billAmount,
          memberIds: selectedMemberIds,
        });
        const map: { [id: string]: number } = {};
        splits.forEach((s) => {
          map[s.memberId] = s.amount;
        });
        return map;
      } catch {
        return {};
      }
    }

    if (splitMode === 'EXACT') {
      const map: { [id: string]: number } = {};
      selectedMemberIds.forEach((id) => {
        map[id] = customAmounts[id] ?? 0;
      });
      return map;
    }

    if (splitMode === 'ITEMIZED') {
      try {
        const res = calculateItemizedSplit({
          items: itemizedList.filter((it) => it.assignedMemberIds.length > 0),
          gstPercentage: gstPercent,
        });
        const map: { [id: string]: number } = {};
        Object.entries(res.memberShares).forEach(([id, share]) => {
          map[id] = share.amount;
        });
        return map;
      } catch {
        return {};
      }
    }

    return {};
  }, [splitMode, billAmount, selectedMemberIds, customAmounts, itemizedList, gstPercent]);

  // Exact split validation stats
  const exactSplitStats = useMemo(() => {
    if (splitMode !== 'EXACT') return null;
    const sharesInput = selectedMemberIds.map((id) => ({
      memberId: id,
      amount: customAmounts[id] || 0,
    }));
    return validateAndCalculateExactSplit({
      totalAmount: billAmount,
      shares: sharesInput,
    });
  }, [splitMode, selectedMemberIds, customAmounts, billAmount]);

  const handleCustomAmountChange = (memberId: string, val: number) => {
    setCustomAmounts((prev) => ({
      ...prev,
      [memberId]: Math.max(0, val),
    }));
  };

  // Cycle / transition payment status
  const handleAdvanceStatus = (memberId: string) => {
    const current = paymentRecords[memberId]?.state || 'pending';
    let nextState: PaymentVerificationState = 'manually_reported_paid';

    if (current === 'pending' || current === 'payment_initiated') {
      nextState = 'manually_reported_paid';
    } else if (current === 'manually_reported_paid' || current === 'awaiting_confirmation') {
      nextState = 'verified_paid';
    } else {
      nextState = 'pending';
    }

    setPaymentRecords((prev) => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        state: nextState,
        transactionRef:
          nextState === 'verified_paid'
            ? prev[memberId]?.transactionRef || `TXN${Date.now().toString().slice(-6)}`
            : prev[memberId]?.transactionRef,
      },
    }));

    const member = members.find((m) => m.id === memberId);
    const name = member?.name?.split(' ')[0] || 'Member';
    const meta = PAYMENT_STATES_CONFIG[nextState];

    if (nextState === 'verified_paid') {
      toast.success(`${name}'s share is Verified Paid! ✅`, {
        description: `${formatInr(computedShares[memberId] || 0)} settled directly to ${vendorName}.`,
      });
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#10B981', '#34D399', '#6EE7B7'],
        });
      } catch {
        // confetti fallback
      }
    } else if (nextState === 'manually_reported_paid') {
      toast.info(`${name} marked as Paid (Self-Reported) 📝`, {
        description: 'Waiting for payee/admin acknowledgement.',
      });
    } else {
      toast.info(`${name}'s payment status reset to Pending`);
    }
  };

  // Copy UPI Deep Link
  const handleCopyUri = (uri: string, memberId: string) => {
    navigator.clipboard.writeText(uri);
    setCopiedId(memberId);
    toast.success('UPI Payment Link copied to clipboard! 📋', {
      description: 'Paste into WhatsApp group for instant 1-tap UPI payment.',
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Total collected calculation
  const totalCollectedPaise = useMemo(() => {
    return members.reduce((sum, m) => {
      const rec = paymentRecords[m.id];
      if (rec?.state === 'verified_paid' || rec?.state === 'manually_reported_paid') {
        return sum + toPaise(computedShares[m.id] || 0);
      }
      return sum;
    }, 0);
  }, [members, paymentRecords, computedShares]);

  const totalCollected = toRupees(totalCollectedPaise);
  const targetTotal =
    splitMode === 'ITEMIZED'
      ? Object.values(computedShares).reduce((a, b) => a + b, 0)
      : billAmount;

  const collectedPercentage =
    targetTotal > 0 ? Math.min(100, Math.round((totalCollected / targetTotal) * 100)) : 0;

  const isVpaValid = UPI_VPA_REGEX.test(vendorUpiId.trim());

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
              Eliminate awkward peer debts. Generate separate QR codes with exact paise distribution. Each friend scans with GPay, PhonePe, Paytm, or BHIM.
            </p>
          </div>

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
            <span
              className={`text-[10px] font-mono flex items-center gap-1 ${
                isVpaValid ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {isVpaValid ? '✓ Valid VPA' : '⚠ Invalid format'}
            </span>
          </div>

          <div className="space-y-2">
            <input
              type="text"
              value={vendorUpiId}
              onChange={(e) => setVendorUpiId(e.target.value)}
              placeholder="e.g. cafe1947@okicici"
              className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500 transition-colors ${
                isVpaValid ? 'border-slate-800 focus:border-emerald-500' : 'border-amber-500/50'
              }`}
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
                min="0"
                value={billAmount}
                onChange={(e) => setBillAmount(Number(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pl-8 pr-3 py-2 text-base font-extrabold text-white num-inr"
              />
            </div>
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

        {/* Step 3: Progress & Quick Stats */}
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
                {formatInr(totalCollected)} Settled
              </span>
              <span className="text-amber-400 font-medium num-inr">
                {formatInr(Math.max(0, targetTotal - totalCollected))} Left
              </span>
            </div>
          </div>

          <div className="text-[10px] text-slate-300 mt-2 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Funds transfer directly to merchant account</span>
          </div>
        </div>
      </div>

      {/* EXACT CUSTOM INPUT SUB-PANEL */}
      {splitMode === 'EXACT' && (
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Specify Exact Shares
              </span>
              <span className="text-xs text-slate-400">
                (Total must match ₹{billAmount})
              </span>
            </div>
            {exactSplitStats && !exactSplitStats.isValid && (
              <span className="text-xs font-semibold text-rose-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{exactSplitStats.error}</span>
              </span>
            )}
            {exactSplitStats && exactSplitStats.isValid && (
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Exactly Allocated! 100% matched</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {selectedMemberIds.map((memberId) => {
              const member = members.find((m) => m.id === memberId);
              return (
                <div key={memberId} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <p className="text-[11px] font-bold text-slate-300 mb-1 truncate">
                    {member?.name || memberId}
                  </p>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-slate-500 text-xs">₹</span>
                    <input
                      type="number"
                      min="0"
                      value={customAmounts[memberId] ?? ''}
                      onChange={(e) => handleCustomAmountChange(memberId, parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-6 pr-2 py-1 text-xs text-white font-mono"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ITEMIZED BILL BREAKDOWN SUB-PANEL */}
      {splitMode === 'ITEMIZED' && (
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Itemized Line Items & Assigned Consumers
            </span>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">GST %:</span>
              <input
                type="number"
                value={gstPercent}
                onChange={(e) => setGstPercent(Number(e.target.value) || 0)}
                className="w-14 bg-slate-950 border border-slate-700 rounded-lg px-2 py-0.5 text-xs text-white font-mono"
              />
            </div>
          </div>

          <div className="space-y-2">
            {itemizedList.map((item, idx) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-500 w-4">{idx + 1}.</span>
                  <div>
                    <p className="text-xs font-bold text-white">{item.name}</p>
                    <p className="text-xs text-emerald-400 font-mono font-semibold">
                      ₹{item.price}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {members.map((m) => {
                    const isAssigned = item.assignedMemberIds.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          const nextIds = isAssigned
                            ? item.assignedMemberIds.filter((id) => id !== m.id)
                            : [...item.assignedMemberIds, m.id];
                          if (nextIds.length > 0) {
                            setItemizedList((prev) =>
                              prev.map((it) => (it.id === item.id ? { ...it, assignedMemberIds: nextIds } : it))
                            );
                          }
                        }}
                        className={`text-[10px] px-2 py-1 rounded-lg border font-medium transition-all ${
                          isAssigned
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-900 text-slate-500 border-slate-800 opacity-60'
                        }`}
                      >
                        {m.name.split(' ')[0]}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* STEP 3: DYNAMIC MEMBER QR CARDS */}
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
          <span className="text-xs text-emerald-400 font-medium hidden sm:inline">
            Direct Merchant Settlements
          </span>
        </div>

        {/* Member QR Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {members.map((member) => {
            const isSelected = selectedMemberIds.includes(member.id);
            if (!isSelected) return null;

            const share = computedShares[member.id] || 0;
            const record = paymentRecords[member.id] || { state: 'pending' };
            const stateMeta = PAYMENT_STATES_CONFIG[record.state];

            // Generate verified UPI URI with NPCI spec
            const upiUri = buildVerifiedUpiUri({
              payeeVpa: vendorUpiId,
              payeeName: vendorName,
              amount: share,
              transactionNote: `TripSplit ${member.name.split(' ')[0]} - ${vendorName}`,
            });

            const whatsappShareText = encodeURIComponent(
              `Hi ${member.name.split(' ')[0]}! Pay your exact ₹${share} share for ${vendorName} directly via UPI:\n${upiUri}`
            );

            return (
              <div
                key={member.id}
                className={`relative flex flex-col justify-between rounded-2xl p-4 transition-all duration-200 border ${
                  stateMeta.isConfirmed
                    ? 'bg-[#111827] border-emerald-500/40 shadow-emerald-500/5'
                    : stateMeta.isSelfReported
                    ? 'bg-[#111827] border-teal-500/30'
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

                  {/* Status Advance Button */}
                  <button
                    type="button"
                    onClick={() => handleAdvanceStatus(member.id)}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all flex items-center gap-1 active:scale-95 ${stateMeta.badgeColor}`}
                    title={stateMeta.description}
                  >
                    {stateMeta.isConfirmed ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Clock className="w-3 h-3 text-amber-400" />
                    )}
                    <span>{stateMeta.label}</span>
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
                  {record.transactionRef && (
                    <span className="text-[9px] font-mono text-emerald-400 block mt-0.5">
                      Ref: {record.transactionRef}
                    </span>
                  )}
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
                  <a
                    href={upiUri}
                    className="w-full py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition-all text-center"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Pay via UPI App</span>
                  </a>

                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleCopyUri(upiUri, member.id)}
                      className="flex-1 py-1.5 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] font-medium flex items-center justify-center gap-1 transition-colors"
                    >
                      {copiedId === member.id ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-400" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>

                    <a
                      href={`https://wa.me/?text=${whatsappShareText}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-1.5 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 text-[10px] font-medium flex items-center justify-center gap-1 transition-colors"
                      title="Share link on WhatsApp"
                    >
                      <Share2 className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
