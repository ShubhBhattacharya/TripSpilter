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

interface BalancesTabProps {
  debts: DebtSettlement[];
  members: TripMember[];
}

export const BalancesTab: React.FC<BalancesTabProps> = ({ debts: initialDebts, members }) => {
  const [debts, setDebts] = useState<DebtSettlement[]>(initialDebts);
  const [activePayDebt, setActivePayDebt] = useState<DebtSettlement | null>(null);

  const getMember = (id: string): TripMember | undefined => {
    return members.find((m) => m.id === id);
  };

  const handleToggleSettled = (debtId: string) => {
    setDebts((prevDebts) =>
      prevDebts.map((d) => {
        if (d.id !== debtId) return d;
        const newStatus = d.status === 'SETTLED' ? 'PENDING' : 'SETTLED';

        if (newStatus === 'SETTLED') {
          try {
            confetti({
              particleCount: 50,
              spread: 60,
              origin: { y: 0.6 },
              colors: ['#10B981', '#34D399'],
            });
          } catch {
            // fallback
          }
        }

        return {
          ...d,
          status: newStatus,
          settledAt: newStatus === 'SETTLED' ? 'Just now' : undefined,
        };
      })
    );
  };

  const pendingDebts = debts.filter((d) => d.status === 'PENDING');
  const settledDebts = debts.filter((d) => d.status === 'SETTLED');

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#111827] border border-[#1F2937] shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Simplified Group Balances</h3>
            <p className="text-xs text-slate-400">
              Minimizes transactions so members settle with fewest possible UPI transfers
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">
            Pending settlements:{' '}
            <strong className="text-amber-400 font-bold">{pendingDebts.length}</strong>
          </span>
        </div>
      </div>

      {/* Pending Settlements List */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Direct Peer-to-Peer Settlements Due
        </h4>

        {pendingDebts.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-[#111827] border border-[#1F2937] space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <h5 className="text-sm font-bold text-white">All Debts Settled!</h5>
            <p className="text-xs text-slate-400">Nobody owes anyone in this trip.</p>
          </div>
        ) : (
          pendingDebts.map((debt) => {
            const fromMember = getMember(debt.fromMemberId);
            const toMember = getMember(debt.toMemberId);

            if (!fromMember || !toMember) return null;

            return (
              <div
                key={debt.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-[#111827] border border-[#1F2937] hover:border-slate-700 transition-all shadow-xl group"
              >
                {/* Flow: From -> To */}
                <div className="flex items-center gap-3">
                  {/* Payer Avatar */}
                  <div className="flex items-center gap-2">
                    <img
                      src={fromMember.avatar}
                      alt={fromMember.name}
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-amber-500/30"
                    />
                    <div>
                      <p className="text-xs font-bold text-white">{fromMember.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{fromMember.upiId}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-center px-2">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">pays</span>
                    <ArrowRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-1 transition-transform" />
                  </div>

                  {/* Payee Avatar */}
                  <div className="flex items-center gap-2">
                    <img
                      src={toMember.avatar}
                      alt={toMember.name}
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-emerald-500/30"
                    />
                    <div>
                      <p className="text-xs font-bold text-white">{toMember.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{toMember.upiId}</p>
                    </div>
                  </div>
                </div>

                {/* Amount & Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-0 border-slate-800">
                  <div className="text-left sm:text-right">
                    <span className="text-lg font-extrabold text-white num-inr">
                      {formatInr(debt.amount)}
                    </span>
                    {debt.notes && (
                      <p className="text-[10px] text-slate-400 truncate max-w-[180px]">
                        {debt.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Pay via UPI button */}
                    <button
                      type="button"
                      onClick={() => setActivePayDebt(debt)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Pay via UPI</span>
                    </button>

                    {/* Mark Settled Toggle */}
                    <button
                      type="button"
                      onClick={() => handleToggleSettled(debt.id)}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
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
        <div className="space-y-3 pt-4">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Settled History
          </h4>
          <div className="space-y-2">
            {settledDebts.map((debt) => {
              const fromMember = getMember(debt.fromMemberId);
              const toMember = getMember(debt.toMemberId);
              return (
                <div
                  key={debt.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/60 text-xs text-slate-400"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      <strong className="text-white">{fromMember?.name}</strong> paid{' '}
                      <strong className="text-white">{toMember?.name}</strong>{' '}
                      <span className="num-inr font-bold text-emerald-400">
                        {formatInr(debt.amount)}
                      </span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleSettled(debt.id)}
                    className="text-[11px] text-slate-300 hover:text-amber-400 transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-[#111827] border border-[#1F2937] rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-400" />
                <h4 className="text-sm font-bold text-white">Settle Up via UPI</h4>
              </div>
              <button
                type="button"
                onClick={() => setActivePayDebt(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const payee = getMember(activePayDebt.toMemberId);
              if (!payee) return null;

              const upiUri = generateUpiUri({
                payeeVpa: payee.upiId,
                payeeName: payee.name,
                amount: activePayDebt.amount,
                transactionNote: `TripSplit Manali Settlement to ${payee.name}`,
              });

              return (
                <div className="space-y-4 text-center">
                  <div>
                    <span className="text-xs text-slate-400">Paying directly to:</span>
                    <h4 className="text-base font-bold text-white">{payee.name}</h4>
                    <p className="text-xs text-emerald-400 font-mono">{payee.upiId}</p>
                  </div>

                  <div className="text-2xl font-black text-white num-inr">
                    {formatInr(activePayDebt.amount)}
                  </div>

                  {/* Scannable QR Code */}
                  <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-white mx-auto w-48 shadow-inner">
                    <QRCodeSVG value={upiUri} size={150} level="M" />
                    <span className="text-[9px] text-slate-800 font-bold mt-1">
                      Scan via GPay / PhonePe / Paytm
                    </span>
                  </div>

                  <div className="space-y-2">
                    <a
                      href={upiUri}
                      className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 active:scale-95"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open in UPI App</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => {
                        handleToggleSettled(activePayDebt.id);
                        setActivePayDebt(null);
                      }}
                      className="w-full py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold transition-colors"
                    >
                      Mark as Paid & Settled ✅
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
