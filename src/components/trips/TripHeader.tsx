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
import { ImageWithFallback } from '../ui/ImageWithFallback';
import { toast } from 'sonner';

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
  const percentage =
    trip.budget > 0 ? Math.min(100, Math.round((trip.totalSpend / trip.budget) * 100)) : 0;

  const tabs = [
    { id: 'itinerary', label: 'Itinerary & Polls', count: `${trip.itinerary.length} items` },
    { id: 'split', label: 'Direct QR Split', badge: 'Core Feature' },
    { id: 'bookings', label: 'Bookings Vault', count: `${trip.bookings.length} docs` },
    { id: 'balances', label: 'Balances & Settle', count: `${trip.debts.length} dues` },
  ];

  const handleShare = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Trip link copied to clipboard! 📋', {
        description: 'Share with friends to view itinerary and splits.',
      });
    }
  };

  return (
    <div className="relative rounded-xl bg-white border border-[#E5EAF1] shadow-xs overflow-hidden mb-6">
      {/* Background Banner */}
      <div className="relative h-44 sm:h-56 w-full overflow-hidden bg-slate-100">
        <ImageWithFallback
          src={trip.coverImage}
          alt={trip.title}
          fallbackTitle={trip.destination}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />

        {/* Top Badges */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/95 text-[#173B70] shadow-xs backdrop-blur-xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#0A9B78]" />
              {trip.status} Trip
            </span>
          </div>

          <button
            type="button"
            onClick={handleShare}
            className="p-2 rounded-lg bg-black/40 hover:bg-black/60 text-white backdrop-blur-xs transition-colors"
            title="Share Trip Link"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>

        {/* Bottom Title & Details */}
        <div className="absolute bottom-4 left-4 right-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-white/90 font-medium mb-1">
              <MapPin className="w-3.5 h-3.5 text-white" />
              <span>{trip.destination}</span>
              <span className="text-white/60">•</span>
              <Calendar className="w-3.5 h-3.5 text-white" />
              <span>
                {trip.startDate} - {trip.endDate}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {trip.title}
            </h1>
            <p className="text-xs text-white/80 max-w-xl mt-0.5 line-clamp-1">
              {trip.tagline}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenSplit}
              className="px-4 py-2 rounded-lg bg-[#1685D4] hover:bg-[#126bb0] text-white font-medium text-xs flex items-center gap-2 shadow-xs active:scale-95 transition-all"
            >
              <QrCode className="w-4 h-4" />
              <span>Direct UPI Split</span>
            </button>
          </div>
        </div>
      </div>

      {/* Meta Bar: Budget Progress & Members */}
      <div className="px-5 py-3.5 bg-white border-t border-[#E5EAF1] flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Members stack */}
        <div className="flex items-center gap-3">
          <div className="flex -space-x-1.5">
            {trip.members.map((member) => (
              <img
                key={member.id}
                src={member.avatar}
                alt={member.name}
                className="w-7 h-7 rounded-full object-cover ring-2 ring-white"
                title={`${member.name} (${member.upiId})`}
              />
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold text-[#172B4D]">
              {trip.members.map((m) => m.name.split(' ')[0]).join(', ')}
            </p>
            <p className="text-[11px] text-[#64748B]">{trip.members.length} trip members</p>
          </div>
        </div>

        {/* Budget stats */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-[#64748B]">
              Trip Spend:{' '}
              <strong className="text-[#172B4D] num-inr font-bold">
                {formatInr(trip.totalSpend)}
              </strong>{' '}
              / {formatInr(trip.budget)}
            </div>
            <div className="text-[11px] text-[#0A9B78] font-medium">
              {formatInr(Math.max(0, trip.budget - trip.totalSpend))} remaining
            </div>
          </div>

          <div className="w-24 sm:w-32 h-2 rounded-full bg-[#F4F7FB] overflow-hidden">
            <div
              className="h-full bg-[#1685D4] rounded-full transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="px-4 border-t border-[#E5EAF1] bg-[#F4F7FB]/40 flex gap-1 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 py-3 px-3.5 sm:px-4 text-xs font-medium border-b-2 whitespace-nowrap transition-all ${
                isActive
                  ? 'border-[#1685D4] text-[#1685D4] font-semibold bg-white'
                  : 'border-transparent text-[#64748B] hover:text-[#172B4D] hover:bg-white/60'
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-[#1685D4]/10 text-[#1685D4]">
                  {tab.badge}
                </span>
              )}
              {tab.count && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-[#64748B]">
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
