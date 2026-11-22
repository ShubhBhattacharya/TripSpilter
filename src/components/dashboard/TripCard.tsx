'use client';

import React from 'react';
import Link from 'next/link';
import { MapPin, Calendar, ArrowRight } from 'lucide-react';
import { Trip } from '../../types/trip';
import { formatInr } from '../../lib/upi';
import { ImageWithFallback } from '../ui/ImageWithFallback';

interface TripCardProps {
  trip: Trip;
}

export const TripCard: React.FC<TripCardProps> = ({ trip }) => {
  const percentage =
    trip.budget > 0 ? Math.min(100, Math.round((trip.totalSpend / trip.budget) * 100)) : 0;

  const statusStyles = {
    ACTIVE: 'bg-emerald-50 text-[#047857] border border-emerald-200/80',
    UPCOMING: 'bg-blue-50 text-[#1685D4] border border-blue-200/80',
    COMPLETED: 'bg-slate-100 text-[#64748B] border border-slate-200',
  };

  return (
    <div className="group flex flex-col rounded-xl bg-white border border-[#E5EAF1] hover:border-[#CBD5E1] hover:shadow-sm overflow-hidden transition-all duration-200">
      {/* Cover Image & Destination */}
      <div className="relative h-44 w-full overflow-hidden bg-slate-100">
        <ImageWithFallback
          src={trip.coverImage}
          alt={trip.title}
          fallbackTitle={trip.destination}
          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
        />

        {/* Status Badge */}
        <div className="absolute top-3 left-3">
          <span
            className={`text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
              statusStyles[trip.status]
            }`}
          >
            {trip.status === 'ACTIVE' && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#0A9B78] mr-1.5" />
            )}
            {trip.status}
          </span>
        </div>

        {/* Destination Chip */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-xs text-white font-medium bg-black/60 backdrop-blur-xs px-2.5 py-1 rounded-md">
          <MapPin className="w-3.5 h-3.5 text-white shrink-0" />
          <span className="truncate">{trip.destination}</span>
        </div>
      </div>

      {/* Details Body */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          <h3 className="text-base font-bold text-[#172B4D] group-hover:text-[#1685D4] transition-colors line-clamp-1">
            {trip.title}
          </h3>
          <p className="text-xs text-[#64748B] line-clamp-1 mt-0.5">{trip.tagline}</p>

          <div className="flex items-center gap-2 text-xs text-[#64748B] mt-2.5">
            <Calendar className="w-3.5 h-3.5 text-[#1685D4] shrink-0" />
            <span>
              {trip.startDate} - {trip.endDate}
            </span>
          </div>
        </div>

        {/* Budget & Progress */}
        <div className="space-y-1.5 pt-2 border-t border-[#E5EAF1]">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#64748B]">Total Spent:</span>
            <span className="font-bold text-[#172B4D] num-inr">
              {formatInr(trip.totalSpend)}{' '}
              <span className="text-[#64748B] font-normal">/ {formatInr(trip.budget)}</span>
            </span>
          </div>

          <div className="w-full h-1.5 rounded-full bg-[#F4F7FB] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                percentage > 90 ? 'bg-amber-500' : 'bg-[#1685D4]'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Footer: Member Avatars & View Trip Action */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center -space-x-1.5">
            {trip.members.slice(0, 4).map((member) => (
              <img
                key={member.id}
                src={member.avatar}
                alt={member.name}
                className="w-6 h-6 rounded-full object-cover ring-2 ring-white"
                title={member.name}
              />
            ))}
            {trip.members.length > 4 && (
              <div className="w-6 h-6 rounded-full bg-[#F4F7FB] border border-[#E5EAF1] text-[10px] font-bold text-[#64748B] flex items-center justify-center">
                +{trip.members.length - 4}
              </div>
            )}
          </div>

          <Link
            href={`/trips/${trip.id}`}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#1685D4] hover:text-[#126bb0] group-hover:translate-x-0.5 transition-all"
          >
            <span>View Outing</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
};
