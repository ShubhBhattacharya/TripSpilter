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

  const [customAmounts, setCustomAmounts] = useState<{ [id: string]: number }>({});

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

    if (nextState === 'verified_paid') {
      toast.success(`${name}'s share is Verified Paid! ✅`, {
        description: `${formatInr(computedShares[memberId] || 0)} settled directly to ${vendorName}.`,
      });
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#0A9B78', '#1685D4'],
        });
      } catch {
        // fallback
      }
    } else if (nextState === 'manually_reported_paid') {
      toast.info(`${name} marked as Paid (Self-Reported) 📝`, {
        description: 'Waiting for payee/admin acknowledgement.',
      });
    } else {
      toast.info(`${name}'s status reset to Pending`);
    }
  };

  const handleCopyUri = (uri: string, memberId: string) => {
    navigator.clipboard.writeText(uri);
    setCopiedId(memberId);
    toast.success('UPI Payment Link copied! 📋', {
      description: 'Share on WhatsApp for instant 1-tap UPI payment.',
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

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
      {/* Product USP Banner */}
      <div className="p-5 rounded-xl bg-white border border-[#E5EAF1] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#0A9B78]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#173B70]">
              Direct-to-Vendor UPI Splitter
            </span>
            <span className="text-[10px] bg-[#0A9B78]/10 text-[#0A9B78] px-2 py-0.5 rounded-full border border-[#0A9B78]/20 font-semibold">
              Zero Escrow • Zero Fees
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-[#172B4D]">
            Every member pays the merchant directly from their own UPI app.
          </h3>
          <p className="text-xs text-[#64748B] max-w-2xl">
            No single person pays the bill upfront and chases friends. Scan the counter standee, enter bill total, and each member scans their exact share.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenAiScanner}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#F4F7FB] hover:bg-[#E5EAF1] text-[#173B70] border border-[#E5EAF1] text-xs font-semibold transition-all shrink-0"
        >
          <Camera className="w-4 h-4 text-[#1685D4]" />
          <span>Scan Bill Photo (OCR)</span>
        </button>
      </div>

      {/* Bill Configuration Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 p-5 rounded-xl bg-white border border-[#E5EAF1] shadow-xs">
        {/* Step 1: Merchant Information */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[#172B4D] uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-[#173B70] text-white flex items-center justify-center text-[10px] font-bold">
                1
              </span>
              Merchant UPI ID
            </label>
            <span
              className={`text-[11px] font-mono flex items-center gap-1 ${
                isVpaValid ? 'text-[#0A9B78]' : 'text-amber-600'
              }`}
            >
              {isVpaValid ? '✓ Verified VPA' : '⚠ Invalid format'}
            </span>
          </div>

          <div className="space-y-2">
            <input
              type="text"
              value={vendorUpiId}
              onChange={(e) => setVendorUpiId(e.target.value)}
              placeholder="e.g. cafe1947@okicici"
              className={`w-full bg-[#F4F7FB] border rounded-lg px-3 py-2 text-xs font-mono text-[#172B4D] transition-colors ${
                isVpaValid ? 'border-[#E5EAF1] focus:border-[#1685D4]' : 'border-amber-300'
              }`}
            />
            <input
              type="text"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="Merchant Name (e.g. Cafe 1947 Manali)"
              className="w-full bg-[#F4F7FB] border border-[#E5EAF1] focus:border-[#1685D4] rounded-lg px-3 py-2 text-xs text-[#172B4D] transition-colors"
            />
          </div>
        </div>

        {/* Step 2: Total Bill & Split Mode */}
        <div className="lg:col-span-5 space-y-3">
          <label className="text-xs font-bold text-[#172B4D] uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-[#173B70] text-white flex items-center justify-center text-[10px] font-bold">
              2
            </span>
            Total Bill Amount (₹)
          </label>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-2.5 text-[#64748B] font-bold text-sm">₹</span>
              <input
                type="number"
                min="0"
                value={billAmount}
                onChange={(e) => setBillAmount(Number(e.target.value) || 0)}
                className="w-full bg-[#F4F7FB] border border-[#E5EAF1] focus:border-[#1685D4] rounded-lg pl-8 pr-3 py-2 text-base font-bold text-[#172B4D] num-inr"
              />
            </div>
            {[2000, 4000, 6000].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setBillAmount(amt)}
                className="px-2.5 py-1 text-xs rounded-lg bg-[#F4F7FB] border border-[#E5EAF1] text-[#64748B] hover:text-[#172B4D] num-inr font-medium"
              >
                ₹{amt / 1000}k
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#F4F7FB] border border-[#E5EAF1] text-xs">
            {(['EQUAL', 'EXACT', 'ITEMIZED'] as SplitMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSplitMode(mode)}
                className={`flex-1 py-1.5 rounded-md font-semibold transition-all ${
                  splitMode === mode
                    ? 'bg-white text-[#173B70] shadow-xs'
                    : 'text-[#64748B] hover:text-[#172B4D]'
                }`}
              >
                {mode === 'EQUAL' && 'Equal Split'}
                {mode === 'EXACT' && 'Exact Custom'}
                {mode === 'ITEMIZED' && 'Itemized'}
              </button>
            ))}
          </div>
        </div>

        {/* Step 3: Progress & Summary */}
        <div className="lg:col-span-3 flex flex-col justify-between p-3.5 rounded-xl bg-[#F4F7FB] border border-[#E5EAF1]">
          <div>
            <div className="flex items-center justify-between text-xs text-[#64748B] mb-1">
              <span>Collection Status</span>
              <span className="font-bold text-[#172B4D] num-inr">{collectedPercentage}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#E5EAF1] overflow-hidden mb-2">
              <div
                className="h-full bg-[#0A9B78] rounded-full transition-all duration-300"
                style={{ width: `${collectedPercentage}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-[#047857] font-bold num-inr">
                {formatInr(totalCollected)} Settled
              </span>
              <span className="text-[#B45309] font-medium num-inr">
                {formatInr(Math.max(0, targetTotal - totalCollected))} Left
              </span>
            </div>
          </div>

          <div className="text-[10px] text-[#64748B] mt-2 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-[#0A9B78]" />
            <span>Direct to merchant account</span>
          </div>
        </div>
      </div>

      {/* Exact Custom Sub-Panel */}
      {splitMode === 'EXACT' && (
        <div className="p-4 rounded-xl bg-white border border-[#E5EAF1] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#172B4D] uppercase tracking-wider">
              Specify Exact Shares (Total must equal ₹{billAmount})
            </span>
            {exactSplitStats && !exactSplitStats.isValid && (
              <span className="text-xs font-semibold text-[#DC3545] flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{exactSplitStats.error}</span>
              </span>
            )}
            {exactSplitStats && exactSplitStats.isValid && (
              <span className="text-xs font-semibold text-[#0A9B78] flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>100% matched</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {selectedMemberIds.map((memberId) => {
              const member = members.find((m) => m.id === memberId);
              return (
                <div key={memberId} className="p-2.5 rounded-lg bg-[#F4F7FB] border border-[#E5EAF1]">
                  <p className="text-[11px] font-semibold text-[#172B4D] mb-1 truncate">
                    {member?.name || memberId}
                  </p>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-[#64748B] text-xs">₹</span>
                    <input
                      type="number"
                      min="0"
                      value={customAmounts[memberId] ?? ''}
                      onChange={(e) => handleCustomAmountChange(memberId, parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full bg-white border border-[#E5EAF1] rounded-md pl-6 pr-2 py-1 text-xs text-[#172B4D] font-mono"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Itemized Bill Sub-Panel */}
      {splitMode === 'ITEMIZED' && (
        <div className="p-4 rounded-xl bg-white border border-[#E5EAF1] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#172B4D] uppercase tracking-wider">
              Itemized Line Items
            </span>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#64748B]">GST %:</span>
              <input
                type="number"
                value={gstPercent}
                onChange={(e) => setGstPercent(Number(e.target.value) || 0)}
                className="w-14 bg-[#F4F7FB] border border-[#E5EAF1] rounded-md px-2 py-0.5 text-xs text-[#172B4D] font-mono"
              />
            </div>
          </div>

          <div className="space-y-2">
            {itemizedList.map((item, idx) => (
              <div
                key={item.id}
                className="p-3 rounded-lg bg-[#F4F7FB] border border-[#E5EAF1] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-[#64748B] w-4">{idx + 1}.</span>
                  <div>
                    <p className="text-xs font-semibold text-[#172B4D]">{item.name}</p>
                    <p className="text-xs text-[#0A9B78] font-mono font-bold">
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
                        className={`text-[10px] px-2 py-1 rounded-md border font-medium transition-all ${
                          isAssigned
                            ? 'bg-[#1685D4] text-white border-[#1685D4]'
                            : 'bg-white text-[#64748B] border-[#E5EAF1]'
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
        <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider shrink-0">
          Split Among:
        </span>
        {members.map((member) => {
          const isSelected = selectedMemberIds.includes(member.id);
          return (
            <button
              key={member.id}
              type="button"
              onClick={() => toggleMemberSelection(member.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                isSelected
                  ? 'bg-[#1685D4]/10 text-[#1685D4] border-[#1685D4]/30'
                  : 'bg-white text-[#64748B] border-[#E5EAF1]'
              }`}
            >
              <img
                src={member.avatar}
                alt={member.name}
                className="w-5 h-5 rounded-full object-cover"
              />
              <span>{member.name.split(' ')[0]}</span>
              {isSelected && <Check className="w-3 h-3 text-[#1685D4]" />}
            </button>
          );
        })}
      </div>

      {/* Dynamic Member QR Cards Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-[#172B4D] uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-[#173B70] text-white flex items-center justify-center text-[10px] font-bold">
                3
              </span>
              Member UPI Payment Cards
            </h4>
            <span className="text-xs text-[#64748B]">
              ({selectedMemberIds.length} generated)
            </span>
          </div>
          <span className="text-xs text-[#0A9B78] font-medium hidden sm:inline">
            Direct Merchant Settlements
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {members.map((member) => {
            const isSelected = selectedMemberIds.includes(member.id);
            if (!isSelected) return null;

            const share = computedShares[member.id] || 0;
            const record = paymentRecords[member.id] || { state: 'pending' };

            const badgeStyles: Record<PaymentVerificationState, string> = {
              pending: 'bg-amber-50 text-amber-700 border-amber-200',
              payment_initiated: 'bg-blue-50 text-blue-700 border-blue-200',
              awaiting_confirmation: 'bg-indigo-50 text-indigo-700 border-indigo-200',
              manually_reported_paid: 'bg-teal-50 text-teal-700 border-teal-200',
              verified_paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
              failed: 'bg-rose-50 text-rose-700 border-rose-200',
              rejected: 'bg-slate-100 text-slate-700 border-slate-200',
            };

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
                className="relative flex flex-col justify-between rounded-xl p-4 bg-white border border-[#E5EAF1] shadow-xs hover:border-[#CBD5E1] transition-all"
              >
                {/* Member Header */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={member.avatar}
                      alt={member.name}
                      className="w-8 h-8 rounded-full object-cover ring-1 ring-[#E5EAF1] shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#172B4D] truncate">{member.name}</p>
                      <p className="text-[10px] text-[#64748B] font-mono truncate">
                        {member.upiId}
                      </p>
                    </div>
                  </div>

                  {/* Status Advance Button */}
                  <button
                    type="button"
                    onClick={() => handleAdvanceStatus(member.id)}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all flex items-center gap-1 ${
                      badgeStyles[record.state]
                    }`}
                  >
                    {record.state === 'verified_paid' ? (
                      <CheckCircle2 className="w-3 h-3 text-[#0A9B78]" />
                    ) : (
                      <Clock className="w-3 h-3 text-amber-600" />
                    )}
                    <span>{PAYMENT_STATES_CONFIG[record.state]?.label || 'Pending'}</span>
                  </button>
                </div>

                {/* Share Amount Box */}
                <div className="p-2.5 rounded-lg bg-[#F4F7FB] border border-[#E5EAF1] text-center mb-3">
                  <span className="text-[10px] text-[#64748B] uppercase block tracking-wider font-semibold">
                    Pay Direct to Vendor
                  </span>
                  <div className="text-xl font-bold text-[#172B4D] num-inr mt-0.5">
                    {formatInr(share)}
                  </div>
                  {record.transactionRef && (
                    <span className="text-[9px] font-mono text-[#0A9B78] block mt-0.5">
                      Ref: {record.transactionRef}
                    </span>
                  )}
                </div>

                {/* Scannable QR Code */}
                <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-white border border-[#E5EAF1] shadow-inner mb-3">
                  <QRCodeSVG
                    value={upiUri}
                    size={135}
                    level="M"
                    includeMargin={false}
                    className="rounded"
                  />
                  <div className="mt-1.5 flex items-center gap-1 text-[9px] text-[#64748B] font-medium">
                    <span>Pay {vendorName.slice(0, 18)}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-1.5">
                  <a
                    href={upiUri}
                    className="w-full py-2 px-3 rounded-lg bg-[#1685D4] hover:bg-[#126bb0] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition-all text-center"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Pay via UPI App</span>
                  </a>

                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleCopyUri(upiUri, member.id)}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-[#F4F7FB] hover:bg-[#E5EAF1] text-[#172B4D] text-[11px] font-medium flex items-center justify-center gap-1 transition-colors border border-[#E5EAF1]"
                    >
                      {copiedId === member.id ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-[#0A9B78]" />
                          <span className="text-[#0A9B78]">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-[#64748B]" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>

                    <a
                      href={`https://wa.me/?text=${whatsappShareText}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-1.5 px-2.5 rounded-lg bg-[#0A9B78]/10 hover:bg-[#0A9B78]/20 text-[#0A9B78] text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors border border-[#0A9B78]/30"
                      title="Share link on WhatsApp"
                    >
                      <Share2 className="w-3.5 h-3.5" />
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
