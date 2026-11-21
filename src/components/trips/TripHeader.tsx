'use client';

import React from 'react';
import {
  MapPin,
  Calendar,
  Share2,
  QrCode,
} from 'lucide-react';
import { Trip } from '../../types/trip';
import { formatInr } from '../../lib/upi';

interface TripHeaderProps {
  trip: Trip;
  onOpenSplit: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const TripHeader: React.FC<TripHeaderProps> = ({
  trip,
  onOpenSplit,
  activeTab,
  onTabChange,
}) => {
  const percentage = Math.min(100, Math.round((trip.totalSpend / trip.budget) * 100));

  const tabs = [
    { id: 'itinerary', label: 'Itinerary & Polls', count: `${trip.itinerary.length} items` },
    { id: 'bookings', label: 'Bookings Vault', count: `${trip.bookings.length} docs` },
    { id: 'split', label: 'Direct QR Split', badge: 'Core USP', highlight: true },
    { id: 'balances', label: 'Balances & Settle', count: `${trip.debts.length} dues` },
  ];

  return (
    <div className="relative rounded-3xl bg-[#111827] border border-[#1F2937] overflow-hidden shadow-2xl mb-6">
      {/* Background Banner */}
      <div className="relative h-48 sm:h-64 w-full overflow-hidden">
        <img
          src={trip.coverImage}
          alt={trip.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#111827] via-[#111827]/60 to-black/30" />

        {/* Top Badges */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 backdrop-blur-md flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {trip.status} Trip
            </span>
            <span className="hidden sm:inline-flex px-3 py-1 rounded-full text-xs font-medium bg-black/40 text-slate-300 border border-white/10 backdrop-blur-md">
              Zero-Float UPI Active
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href);
                alert('Trip link copied to clipboard! Share with group members.');
              }}
              className="p-2 rounded-xl bg-black/50 hover:bg-black/70 text-white border border-white/10 backdrop-blur-md transition-colors"
              title="Share Trip Link"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bottom Title & Details */}
        <div className="absolute bottom-4 left-4 right-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold mb-1">
              <MapPin className="w-3.5 h-3.5" />
              <span>{trip.destination}</span>
              <span className="text-slate-500">•</span>
              <Calendar className="w-3.5 h-3.5" />
              <span>
                {trip.startDate} - {trip.endDate}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {trip.title}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl mt-0.5 line-clamp-1">
              {trip.tagline}
            </p>
          </div>

          {/* Quick CTA to Split */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenSplit}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-95 transition-all"
            >
              <QrCode className="w-4 h-4 stroke-[2.5]" />
              <span>Instant QR Split</span>
            </button>
          </div>
        </div>
      </div>

      {/* Meta Bar: Budget Progress & Members */}
      <div className="px-5 py-4 border-t border-[#1F2937] bg-[#0E1526]/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Members stack */}
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {trip.members.map((member) => (
              <img
                key={member.id}
                src={member.avatar}
                alt={member.name}
                className="w-8 h-8 rounded-full object-cover ring-2 ring-[#0B1120]"
                title={`${member.name} (${member.upiId})`}
              />
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold text-white">
              {trip.members.map((m) => m.name.split(' ')[0]).join(', ')}
            </p>
            <p className="text-[11px] text-slate-400">4 active contributors</p>
          </div>
        </div>

        {/* Budget visual */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-slate-400">
              Trip Spend:{' '}
              <strong className="text-white num-inr font-bold">
                {formatInr(trip.totalSpend)}
              </strong>{' '}
              / {formatInr(trip.budget)}
            </div>
            <div className="text-[11px] text-emerald-400">
              {formatInr(trip.budget - trip.totalSpend)} budget remaining
            </div>
          </div>

          <div className="w-24 sm:w-32 h-2.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Switchable Tabs Navigation */}
      <div className="px-4 border-t border-[#1F2937] flex gap-2 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 py-3 px-3.5 sm:px-4 text-xs font-semibold border-b-2 whitespace-nowrap transition-all duration-150 ${
                isActive
                  ? 'border-emerald-400 text-emerald-400 bg-emerald-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="text-[9px] px-1.5 py-0.5 rounded uppercase font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {tab.badge}
                </span>
              )}
              {tab.count && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
