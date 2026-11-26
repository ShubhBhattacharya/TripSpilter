'use client';

import React, { useState } from 'react';
import {
  FolderLock,
  Download,
  Eye,
  QrCode,
  FileText,
  Building2,
  Bus,
  Compass,
  Utensils,
  Plus,
  X,
} from 'lucide-react';
import { BookingVaultItem } from '../../types/trip';
import { formatInr } from '../../lib/upi';
import { toast } from 'sonner';

interface BookingsVaultTabProps {
  tripId?: string;
  bookings: BookingVaultItem[];
  onSplitBooking: (booking: BookingVaultItem) => void;
  onBookingAdded?: (booking: BookingVaultItem) => void;
}

export const BookingsVaultTab: React.FC<BookingsVaultTabProps> = ({
  tripId,
  bookings: initialBookings,
  onSplitBooking,
  onBookingAdded,
}) => {
  const [bookings, setBookings] = useState<BookingVaultItem[]>(initialBookings);
  const [selectedPreview, setSelectedPreview] = useState<BookingVaultItem | null>(null);
  const [showAddBooking, setShowAddBooking] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [vendorInput, setVendorInput] = useState('');
  const [refInput, setRefInput] = useState('');
  const [categoryInput, setCategoryInput] = useState<'Hotel' | 'Flight' | 'Bus' | 'Train' | 'Rental' | 'Activity' | 'Other'>('Hotel');
  const [amountInput, setAmountInput] = useState('');
  const [isSavingBooking, setIsSavingBooking] = useState(false);

  const handleDownloadVoucher = (booking: BookingVaultItem) => {
    const content = [
      'TRIPSPLIT BOOKING VOUCHER RECORD',
      '=================================',
      `Title: ${booking.title}`,
      `Category: ${booking.category}`,
      `Vendor: ${booking.vendorName}`,
      `Reference / PNR: ${booking.bookingRef}`,
      `Date: ${booking.date}`,
      `Amount: INR ${booking.totalAmount}`,
      `Status: ${booking.status}`,
      `Booked By: ${booking.bookedBy}`,
      booking.notes ? `Notes: ${booking.notes}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${booking.bookingRef || 'voucher'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Voucher text receipt downloaded.');
  };

  const handleAddBookingDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleInput.trim() || !vendorInput.trim()) return;

    const amt = Math.max(0, Number(amountInput) || 0);
    setIsSavingBooking(true);
    let createdItem: BookingVaultItem = {
      id: `bk-${Date.now()}`,
      title: titleInput.trim(),
      vendorName: vendorInput.trim(),
      bookingRef: refInput.trim() || `DRAFT-${Date.now().toString(36).toUpperCase()}`,
      category: categoryInput === 'Rental' || categoryInput === 'Other' ? 'Hotel' : categoryInput === 'Activity' ? 'Activity Pass' : categoryInput,
      date: new Date().toISOString().split('T')[0],
      totalAmount: amt,
      bookedBy: 'You',
      status: 'Draft',
      documentType: 'PDF',
    };

    try {
      if (tripId && !tripId.startsWith('local-') && !tripId.startsWith('trip-')) {
        const res = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tripId,
            title: titleInput.trim(),
            vendorName: vendorInput.trim(),
            category: categoryInput,
            amount: amt,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.booking) {
            createdItem = {
              ...createdItem,
              id: data.booking.id,
              bookingRef: data.booking.booking_ref,
            };
          }
        }
      }
    } catch {
      // fallback cleanly to local draft state
    } finally {
      setIsSavingBooking(false);
    }

    setBookings((prev) => [createdItem, ...prev]);
    onBookingAdded?.(createdItem);
    setTitleInput('');
    setVendorInput('');
    setRefInput('');
    setAmountInput('');
    setShowAddBooking(false);
    toast.success('Booking draft added to vault!');
  };

  const getCategoryIcon = (category: BookingVaultItem['category']) => {
    switch (category) {
      case 'Hotel':
        return <Building2 className="w-4 h-4 text-indigo-600" />;
      case 'Bus':
        return <Bus className="w-4 h-4 text-[#1685D4]" />;
      case 'Activity Pass':
        return <Compass className="w-4 h-4 text-[#047857]" />;
      case 'Table Reservation':
        return <Utensils className="w-4 h-4 text-amber-600" />;
      default:
        return <FileText className="w-4 h-4 text-[#64748B]" />;
    }
  };

  const getStatusBadge = (status: BookingVaultItem['status']) => {
    switch (status) {
      case 'Settled':
      case 'Confirmed by supplier':
      case 'Confirmed':
        return 'bg-emerald-50 text-[#047857] border border-emerald-200';
      case 'Refunded':
        return 'bg-teal-50 text-teal-700 border border-teal-200';
      case 'Cancelled':
      case 'Failed':
        return 'bg-rose-50 text-rose-700 border border-rose-200';
      case 'Pending confirmation':
      case 'Pending Split':
      case 'Refund pending':
        return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'Draft':
      default:
        return 'bg-blue-50 text-[#1685D4] border border-blue-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Vault Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-xl bg-white border border-[#E5EAF1] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#173B70]/10 text-[#173B70] flex items-center justify-center">
            <FolderLock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#172B4D]">Trip Bookings & Voucher Vault</h3>
            <p className="text-xs text-[#64748B]">
              Central repository for hotel bookings, bus vouchers, and activity passes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddBooking(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#F4F7FB] hover:bg-[#E5EAF1] text-[#172B4D] text-xs font-semibold border border-[#E5EAF1] transition-colors"
          >
            <Plus className="w-4 h-4 text-[#1685D4]" />
            <span>Add Booking Draft</span>
          </button>
        </div>
      </div>

      {/* Bookings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {bookings.map((booking) => (
          <div
            key={booking.id}
            className="flex flex-col justify-between p-5 rounded-xl bg-white border border-[#E5EAF1] hover:border-[#CBD5E1] transition-all shadow-xs group"
          >
            <div className="space-y-3">
              {/* Category & Status */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[#172B4D]">
                  {getCategoryIcon(booking.category)}
                  <span>{booking.category}</span>
                </span>
                <span
                  className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${getStatusBadge(
                    booking.status
                  )}`}
                >
                  {booking.status}
                </span>
              </div>

              {/* Title & Vendor */}
              <div>
                <h4 className="text-sm sm:text-base font-bold text-[#172B4D] group-hover:text-[#1685D4] transition-colors line-clamp-1">
                  {booking.title}
                </h4>
                <p className="text-xs text-[#64748B] mt-0.5 font-medium">{booking.vendorName}</p>
              </div>

              {/* Booking Ref Pill */}
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[#F4F7FB] border border-[#E5EAF1] text-xs">
                <span className="text-[#64748B] font-mono text-[11px]">REF / PNR:</span>
                <span className="text-[#172B4D] font-mono font-semibold tracking-wide">
                  {booking.bookingRef}
                </span>
                <span className="text-[#CBD5E1] ml-auto">•</span>
                <span className="text-[#64748B] text-[11px]">{booking.date}</span>
              </div>

              {booking.notes && (
                <p className="text-[11px] text-[#64748B] line-clamp-2 leading-relaxed">
                  {booking.notes}
                </p>
              )}
            </div>

            {/* Bottom: Cost & Split action */}
            <div className="mt-4 pt-3 border-t border-[#E5EAF1] flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] text-[#64748B] uppercase block">Total Value</span>
                <span className="text-base font-bold text-[#172B4D] num-inr">
                  {formatInr(booking.totalAmount)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPreview(booking)}
                  className="p-2 rounded-lg bg-[#F4F7FB] hover:bg-[#E5EAF1] text-[#64748B] hover:text-[#172B4D] transition-colors border border-[#E5EAF1]"
                  title="View Voucher Preview"
                >
                  <Eye className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    toast.info(`Loaded booking into Direct Split`, {
                      description: `${booking.title} (${formatInr(booking.totalAmount)})`,
                    });
                    onSplitBooking(booking);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1685D4] hover:bg-[#126bb0] text-white text-xs font-semibold transition-all active:scale-95 shadow-xs"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Split This Booking</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Voucher Preview Modal */}
      {selectedPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white border border-[#E5EAF1] rounded-xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E5EAF1] pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#1685D4]" />
                <h4 className="text-sm font-bold text-[#172B4D]">Voucher Preview</h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPreview(null)}
                className="text-[#64748B] hover:text-[#172B4D]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-lg bg-[#F4F7FB] border border-[#E5EAF1] space-y-2 text-xs">
              <p className="text-[#64748B]">Document: <strong className="text-[#172B4D]">{selectedPreview.title}</strong></p>
              <p className="text-[#64748B]">Vendor: <strong className="text-[#172B4D]">{selectedPreview.vendorName}</strong></p>
              <p className="text-[#64748B]">Booking Reference: <strong className="text-[#1685D4] font-mono">{selectedPreview.bookingRef}</strong></p>
              <p className="text-[#64748B]">Total Value: <strong className="text-[#172B4D] num-inr">{formatInr(selectedPreview.totalAmount)}</strong></p>
              <p className="text-[#64748B]">Booked By: <strong className="text-[#172B4D]">{selectedPreview.bookedBy}</strong></p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleDownloadVoucher(selectedPreview)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#F4F7FB] hover:bg-[#E5EAF1] text-[#172B4D] text-xs font-semibold border border-[#E5EAF1]"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Voucher</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const b = selectedPreview;
                  setSelectedPreview(null);
                  onSplitBooking(b);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1685D4] hover:bg-[#126bb0] text-white text-xs font-semibold shadow-xs"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Direct Split {formatInr(selectedPreview.totalAmount)}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Add Booking Draft Modal */}
      {showAddBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <form
            onSubmit={handleAddBookingDraft}
            className="w-full max-w-md bg-white border border-[#E5EAF1] rounded-xl p-5 space-y-3.5 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-[#E5EAF1] pb-2.5">
              <h4 className="text-sm font-bold text-[#172B4D]">Add Booking Record</h4>
              <button
                type="button"
                onClick={() => setShowAddBooking(false)}
                className="text-[#64748B] hover:text-[#172B4D]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              required
              placeholder="Booking title (e.g. Hotel Stay 2 Nights)"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E5EAF1] text-xs"
            />
            <input
              type="text"
              required
              placeholder="Vendor / Airline / Property name"
              value={vendorInput}
              onChange={(e) => setVendorInput(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E5EAF1] text-xs"
            />
            <div className="grid grid-cols-2 gap-2.5">
              <select
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value as typeof categoryInput)}
                className="px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E5EAF1] text-xs"
              >
                <option value="Hotel">Hotel</option>
                <option value="Flight">Flight</option>
                <option value="Bus">Bus</option>
                <option value="Train">Train</option>
                <option value="Activity">Activity</option>
              </select>
              <input
                type="number"
                min={0}
                required
                placeholder="Amount (₹)"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E5EAF1] text-xs"
              />
            </div>
            <input
              type="text"
              placeholder="External Reference / PNR (optional)"
              value={refInput}
              onChange={(e) => setRefInput(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E5EAF1] text-xs font-mono"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddBooking(false)}
                className="px-3 py-2 text-xs text-[#64748B]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingBooking}
                className="px-4 py-2 rounded-lg bg-[#173B70] text-white text-xs font-semibold disabled:opacity-50"
              >
                {isSavingBooking ? 'Saving...' : 'Save Booking'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
