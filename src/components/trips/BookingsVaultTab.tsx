'use client';

import React, { useState } from 'react';
import {
  FolderLock,
  Download,
  Eye,
  QrCode,
  FileText,
  CheckCircle2,
  Clock,
  Building2,
  Bus,
  Compass,
  Utensils,
  Plus,
  X,
  ExternalLink,
} from 'lucide-react';
import { BookingVaultItem } from '../../types/trip';
import { formatInr } from '../../lib/upi';

interface BookingsVaultTabProps {
  bookings: BookingVaultItem[];
  onSplitBooking: (booking: BookingVaultItem) => void;
}

export const BookingsVaultTab: React.FC<BookingsVaultTabProps> = ({
  bookings,
  onSplitBooking,
}) => {
  const [selectedPreview, setSelectedPreview] = useState<BookingVaultItem | null>(null);

  const getCategoryIcon = (category: BookingVaultItem['category']) => {
    switch (category) {
      case 'Hotel':
        return <Building2 className="w-4 h-4 text-indigo-400" />;
      case 'Bus':
        return <Bus className="w-4 h-4 text-sky-400" />;
      case 'Activity Pass':
        return <Compass className="w-4 h-4 text-emerald-400" />;
      case 'Table Reservation':
        return <Utensils className="w-4 h-4 text-amber-400" />;
      default:
        return <FileText className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusBadge = (status: BookingVaultItem['status']) => {
    switch (status) {
      case 'Settled':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Pending Split':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Confirmed':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Vault Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-[#111827] border border-[#1F2937]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
            <FolderLock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Trip Bookings & Voucher Vault</h3>
            <p className="text-xs text-slate-400">
              Centralized repository for PDF vouchers, tickets, and reservations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => alert('Voucher upload ready. Drag or select ticket PDF.')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition-colors"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Upload Ticket / Voucher</span>
          </button>
        </div>
      </div>

      {/* Bookings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {bookings.map((booking) => (
          <div
            key={booking.id}
            className="flex flex-col justify-between p-5 rounded-2xl bg-[#111827] border border-[#1F2937] hover:border-slate-700 transition-all shadow-xl group"
          >
            <div className="space-y-3">
              {/* Top row: category & status */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                  {getCategoryIcon(booking.category)}
                  <span>{booking.category}</span>
                </span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getStatusBadge(
                    booking.status
                  )}`}
                >
                  {booking.status}
                </span>
              </div>

              {/* Title & Ref */}
              <div>
                <h4 className="text-sm sm:text-base font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-1">
                  {booking.title}
                </h4>
                <p className="text-xs text-slate-400 mt-0.5 font-medium">{booking.vendorName}</p>
              </div>

              {/* Booking Ref Pill */}
              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800/80 text-xs">
                <span className="text-slate-300 font-mono text-[11px]">PNR / REF:</span>
                <span className="text-emerald-400 font-mono font-semibold tracking-wide">
                  {booking.bookingRef}
                </span>
                <span className="text-slate-600 ml-auto">•</span>
                <span className="text-slate-400 text-[11px]">{booking.date}</span>
              </div>

              {booking.notes && (
                <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                  {booking.notes}
                </p>
              )}
            </div>

            {/* Bottom Row: Amount & Action Buttons */}
            <div className="mt-4 pt-3 border-t border-[#1F2937] flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] text-slate-300 uppercase block">Total Cost</span>
                <span className="text-base font-extrabold text-white num-inr">
                  {formatInr(booking.totalAmount)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Preview / View button */}
                <button
                  type="button"
                  onClick={() => setSelectedPreview(booking)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                  title="View Voucher Preview"
                >
                  <Eye className="w-4 h-4" />
                </button>

                {/* ONE-CLICK SPLIT THIS BOOKING BUTTON */}
                <button
                  type="button"
                  onClick={() => onSplitBooking(booking)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-all active:scale-95 shadow-sm"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Split This Booking</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Voucher Preview Drawer / Modal */}
      {selectedPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-[#111827] border border-[#1F2937] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                <h4 className="text-sm font-bold text-white">Voucher Preview</h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPreview(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <p className="text-slate-400">Document: <strong className="text-white">{selectedPreview.title}</strong></p>
              <p className="text-slate-400">Vendor: <strong className="text-white">{selectedPreview.vendorName}</strong></p>
              <p className="text-slate-400">Booking Reference: <strong className="text-emerald-400 font-mono">{selectedPreview.bookingRef}</strong></p>
              <p className="text-slate-400">Total Value: <strong className="text-white num-inr">{formatInr(selectedPreview.totalAmount)}</strong></p>
              <p className="text-slate-400">Booked By: <strong className="text-white">{selectedPreview.bookedBy}</strong></p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => alert('Simulated voucher download started.')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const b = selectedPreview;
                  setSelectedPreview(null);
                  onSplitBooking(b);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Direct Split {formatInr(selectedPreview.totalAmount)}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
