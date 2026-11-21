'use client';

import React from 'react';
import Link from 'next/link';
import { MapPin, Calendar, ArrowUpRight } from 'lucide-react';
import { Trip } from '../../types/trip';
import { formatInr } from '../../lib/upi';
import { ImageWithFallback } from '../ui/ImageWithFallback';

interface TripCardProps {
  trip: Trip;
}

export const TripCard: React.FC<TripCardProps> = ({ trip }) => {
  const percentage = Math.min(100, Math.round((trip.totalSpend / trip.budget) * 100));

  const statusStyles = {
    ACTIVE: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    UPCOMING: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    COMPLETED: 'bg-slate-700/40 text-slate-400 border-slate-700',
  };

  return (
    <Link
      href={`/trips/${trip.id}`}
      className="group flex flex-col rounded-2xl bg-[#111827] border border-[#1F2937] hover:border-emerald-500/40 overflow-hidden shadow-xl transition-all duration-200 hover:-translate-y-1"
    >
      {/* Cover Image & Overlays */}
      <div className="relative h-44 w-full overflow-hidden bg-slate-900">
        <ImageWithFallback
          src={trip.coverImage}
          alt={trip.title}
          fallbackTitle={trip.destination}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#111827] via-[#111827]/40 to-transparent" />

        {/* Status Pill */}
        <div className="absolute top-3 left-3">
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border backdrop-blur-md ${
              statusStyles[trip.status]
            }`}
          >
            {trip.status === 'ACTIVE' && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1.5" />
            )}
            {trip.status}
          </span>
        </div>

        {/* Destination Pill */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-xs text-white/90 font-medium bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-lg">
          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="truncate">{trip.destination}</span>
        </div>

        {/* Action arrow icon */}
        <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-all">
          <ArrowUpRight className="w-4 h-4" />
        </div>
      </div>

      {/* Body Details */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          <h3 className="text-base font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-1">
            {trip.title}
          </h3>
          <p className="text-xs text-slate-400 line-clamp-1 mt-1">{trip.tagline}</p>
        </div>

        {/* Date and Members Row */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-[#1F2937]/70">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>
              {trip.startDate} - {trip.endDate.split(' ')[0]}
            </span>
          </div>

          {/* Member avatars */}
          <div className="flex -space-x-2 items-center">
            {trip.members.map((member) => (
              <img
                key={member.id}
                src={member.avatar}
                alt={member.name}
                className="w-6 h-6 rounded-full object-cover ring-2 ring-[#111827]"
                title={member.name}
              />
            ))}
          </div>
        </div>

        {/* Budget Progress Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Budget Spent</span>
            <div className="flex items-center gap-1">
              <span className="text-white font-semibold num-inr">
                {formatInr(trip.totalSpend)}
              </span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-400 num-inr">{formatInr(trip.budget)}</span>
            </div>
          </div>

          {/* Progress track */}
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden relative">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                percentage > 90
                  ? 'bg-rose-500'
                  : percentage > 75
                  ? 'bg-amber-400'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-300">
            <span>{percentage}% utilized</span>
            <span>{formatInr(Math.max(0, trip.budget - trip.totalSpend))} remaining</span>
          </div>
        </div>
      </div>
    </Link>
  );
};
