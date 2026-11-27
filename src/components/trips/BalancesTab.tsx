'use client';

import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import {
  Receipt,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  X,
  CreditCard,
} from 'lucide-react';
import { DebtSettlement, TripMember } from '../../types/trip';
import { formatInr, generateUpiUri } from '../../lib/upi';
import { toast } from 'sonner';

interface BalancesTabProps {
  tripId?: string;
  debts: DebtSettlement[];
  members: TripMember[];
}

export const BalancesTab: React.FC<BalancesTabProps> = ({ tripId, debts: initialDebts, members }) => {
  const [debts, setDebts] = useState<DebtSettlement[]>(initialDebts);
  const [activePayDebt, setActivePayDebt] = useState<DebtSettlement | null>(null);
  const [gatewayMsg, setGatewayMsg] = useState<string | null>(null);

  const getMember = (id: string): TripMember | undefined => {
    return members.find((m) => m.id === id);
  };

  const handleToggleSettled = async (debtId: string) => {
    const target = debts.find((d) => d.id === debtId);
    const nextStatus = target?.status === 'SETTLED' ? 'PENDING' : 'SETTLED';

    const isRealPersistedTrip = Boolean(
      tripId && !tripId.startsWith('local-') && !tripId.startsWith('trip-')
    );

    if (nextStatus === 'SETTLED' && target && isRealPersistedTrip) {
      try {
        const res = await fetch(`/api/trips/${tripId}/settlements`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromUserId: target.fromMemberId,
            toUserId: target.toMemberId,
            amount: target.amount,
          }),
        });
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          toast.error(errJson.error || 'Failed to save settlement record to PostgreSQL.');
          return;
        }
      } catch {
        toast.error('Network error: unable to record settlement.');
        return;
      }
    }

    setDebts((prevDebts) =>
      prevDebts.map((d) => {
        if (d.id !== debtId) return d;
        if (nextStatus === 'SETTLED') {
          const from = getMember(d.fromMemberId)?.name?.split(' ')[0] || 'Member';
          const to = getMember(d.toMemberId)?.name?.split(' ')[0] || 'Member';
          toast.success('Settlement recorded as Manually Settled', {
            description: `${from} -> ${to} (${formatInr(d.amount)}). Bank/gateway confirmation happens only via webhook.`,
          });
          try {
            confetti({
              particleCount: 40,
              spread: 55,
              origin: { y: 0.6 },
              colors: ['#0A9B78', '#1685D4'],
            });
          } catch {
            // fallback
          }
        } else {
          toast.info('Settlement marked back to Pending');
        }

        return {
          ...d,
          status: nextStatus,
          settledAt: nextStatus === 'SETTLED' ? 'Self-Reported' : undefined,
        };
      })
    );
  };

  const handleGatewayOrderCheck = async (amount: number) => {
    setGatewayMsg(null);
    try {
      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(tripId && !tripId.startsWith('local-') && !tripId.startsWith('trip-') ? { tripId } : {}),
          amountInr: amount,
        }),
      });
      const data = await res.json();
      setGatewayMsg(data.disclaimer || data.error || 'Payment gateway checked.');
    } catch {
      setGatewayMsg('Unable to check payment gateway status.');
    }
  };

  const pendingDebts = debts.filter((d) => d.status === 'PENDING');
  const settledDebts = debts.filter((d) => d.status === 'SETTLED');

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-white border border-[#E5EAF1] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#173B70]/10 text-[#173B70] flex items-center justify-center">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#172B4D]">Simplified Group Balances</h3>
            <p className="text-xs text-[#64748B]">
              Minimizes transactions so members settle with fewest possible UPI transfers
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#64748B]">
            Pending settlements:{' '}
            <strong className="text-[#B45309] font-bold">{pendingDebts.length}</strong>
          </span>
        </div>
      </div>

      {/* Pending Settlements List */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-[#172B4D] uppercase tracking-wider">
          Direct Peer-to-Peer Settlements Due
        </h4>

        {pendingDebts.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-white border border-[#E5EAF1] space-y-2 shadow-xs">
            <CheckCircle2 className="w-8 h-8 text-[#0A9B78] mx-auto" />
            <h5 className="text-sm font-bold text-[#172B4D]">All Debts Settled!</h5>
            <p className="text-xs text-[#64748B]">Nobody owes anyone in this trip.</p>
          </div>
        ) : (
          pendingDebts.map((debt) => {
            const fromMember = getMember(debt.fromMemberId);
            const toMember = getMember(debt.toMemberId);

            if (!fromMember || !toMember) return null;

            return (
              <div
                key={debt.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-xl bg-white border border-[#E5EAF1] hover:border-[#CBD5E1] transition-all shadow-xs group"
              >
                {/* Flow: From -> To */}
                <div className="flex items-center gap-3">
                  {/* Payer Avatar */}
                  <div className="flex items-center gap-2">
                    <img
                      src={fromMember.avatar}
                      alt={fromMember.name}
                      className="w-9 h-9 rounded-full object-cover ring-2 ring-amber-100"
                    />
                    <div>
                      <p className="text-xs font-bold text-[#172B4D]">{fromMember.name}</p>
                      <p className="text-[10px] text-[#64748B] font-mono">{fromMember.upiId}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-center px-2">
                    <span className="text-[10px] text-[#64748B] uppercase font-semibold">pays</span>
                    <ArrowRight className="w-4 h-4 text-[#1685D4] group-hover:translate-x-0.5 transition-transform" />
                  </div>

                  {/* Payee Avatar */}
                  <div className="flex items-center gap-2">
                    <img
                      src={toMember.avatar}
                      alt={toMember.name}
                      className="w-9 h-9 rounded-full object-cover ring-2 ring-emerald-100"
                    />
                    <div>
                      <p className="text-xs font-bold text-[#172B4D]">{toMember.name}</p>
                      <p className="text-[10px] text-[#64748B] font-mono">{toMember.upiId}</p>
                    </div>
                  </div>
                </div>

                {/* Amount & Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-0 border-[#E5EAF1]">
                  <div className="text-left sm:text-right">
                    <span className="text-base sm:text-lg font-bold text-[#172B4D] num-inr">
                      {formatInr(debt.amount)}
                    </span>
                    {debt.notes && (
                      <p className="text-[10px] text-[#64748B] truncate max-w-[180px]">
                        {debt.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActivePayDebt(debt)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1685D4] hover:bg-[#126bb0] text-white text-xs font-semibold shadow-xs active:scale-95 transition-all"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Pay via UPI</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleSettled(debt.id)}
                      className="px-3 py-2 rounded-lg bg-[#F4F7FB] hover:bg-[#E5EAF1] text-[#172B4D] text-xs font-medium border border-[#E5EAF1] transition-colors"
                      title="Mark as Settled"
                    >
                      Mark Settled
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Settled History */}
      {settledDebts.length > 0 && (
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
            Settled History
          </h4>
          <div className="space-y-2">
            {settledDebts.map((debt) => {
              const fromMember = getMember(debt.fromMemberId);
              const toMember = getMember(debt.toMemberId);
              return (
                <div
                  key={debt.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-white border border-[#E5EAF1] text-xs text-[#64748B] shadow-xs"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#0A9B78] shrink-0" />
                    <span>
                      <strong className="text-[#172B4D]">{fromMember?.name}</strong> paid{' '}
                      <strong className="text-[#172B4D]">{toMember?.name}</strong>{' '}
                      <span className="num-inr font-bold text-[#0A9B78]">
                        {formatInr(debt.amount)}
                      </span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleSettled(debt.id)}
                    className="text-[11px] text-[#64748B] hover:text-[#B45309] transition-colors"
                  >
                    Undo
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pay P2P Modal with QR */}
      {activePayDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white border border-[#E5EAF1] rounded-xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E5EAF1] pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-[#1685D4]" />
                <h4 className="text-sm font-bold text-[#172B4D]">Settle Up via UPI</h4>
              </div>
              <button
                type="button"
                onClick={() => setActivePayDebt(null)}
                className="text-[#64748B] hover:text-[#172B4D]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const payee = getMember(activePayDebt.toMemberId);
              if (!payee) return null;

              let upiUri: string | null = null;
              let vpaError: string | null = null;
              try {
                upiUri = generateUpiUri({
                  payeeVpa: payee.upiId,
                  payeeName: payee.name,
                  amount: activePayDebt.amount,
                  transactionNote: `TripSplit Settlement to ${payee.name}`,
                });
              } catch (err) {
                vpaError = err instanceof Error ? err.message : 'Member has not set a valid UPI ID yet.';
              }

              return (
                <div className="space-y-4 text-center">
                  <div>
                    <span className="text-xs text-[#64748B]">Paying directly to:</span>
                    <h4 className="text-base font-bold text-[#172B4D]">{payee.name}</h4>
                    <p className="text-xs text-[#1685D4] font-mono">{payee.upiId || 'No UPI ID set'}</p>
                  </div>

                  <div className="text-2xl font-bold text-[#172B4D] num-inr">
                    {formatInr(activePayDebt.amount)}
                  </div>

                  {/* Scannable QR Code or VPA Warning */}
                  {upiUri ? (
                    <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-[#F4F7FB] border border-[#E5EAF1] mx-auto w-48 shadow-inner">
                      <QRCodeSVG value={upiUri} size={150} level="M" />
                      <span className="text-[9px] text-[#64748B] font-medium mt-1.5">
                        Scan via GPay / PhonePe / Paytm
                      </span>
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                      {vpaError}
                    </div>
                  )}

                  {gatewayMsg && (
                    <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
                      {gatewayMsg}
                    </p>
                  )}

                  <div className="space-y-2">
                    {upiUri && (
                      <a
                        href={upiUri}
                        className="w-full py-2.5 px-4 rounded-lg bg-[#1685D4] hover:bg-[#126bb0] text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs active:scale-95"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open in UPI App</span>
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => void handleGatewayOrderCheck(activePayDebt.amount)}
                      className="w-full py-2 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200"
                    >
                      Check Gateway Online Checkout
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        void handleToggleSettled(activePayDebt.id);
                        setActivePayDebt(null);
                      }}
                      className="w-full py-2 px-4 rounded-lg bg-[#F4F7FB] hover:bg-[#E5EAF1] text-[#0A9B78] text-xs font-semibold transition-colors border border-[#E5EAF1]"
                    >
                      Mark as Reported Settled (Manual)
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
