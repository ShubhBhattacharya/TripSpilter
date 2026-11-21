'use client';

import React, { useState } from 'react';
import { X, MapPin, Calendar, Plus, Users, Sparkles } from 'lucide-react';

interface CreateTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (tripData: {
    title: string;
    destination: string;
    startDate: string;
    endDate: string;
    budget: number;
  }) => void;
}

export const CreateTripModal: React.FC<CreateTripModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [dateRange, setDateRange] = useState('');
  const [budget, setBudget] = useState('35000');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !destination) return;
    onCreate({
      title,
      destination,
      startDate: dateRange.split('-')[0]?.trim() || '10 Dec 2026',
      endDate: dateRange.split('-')[1]?.trim() || '15 Dec 2026',
      budget: Number(budget) || 30000,
    });
    onClose();
  };

  const sampleSuggestions = [
    { title: 'Rishikesh Rafting & Camping', destination: 'Rishikesh, Uttarakhand', budget: 18000 },
    { title: 'Kasol & Tosh Trek Weekend', destination: 'Parvati Valley, HP', budget: 22000 },
    { title: 'Udaipur Lakes & Royal Palaces', destination: 'Udaipur, Rajasthan', budget: 28000 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white border border-[#E5EAF1] rounded-xl shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E5EAF1] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#173B70]/10 text-[#173B70] flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#172B4D]">Create New Trip / Outing</h3>
              <p className="text-xs text-[#64748B]">Set itinerary dates, budget & invite friends</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#172B4D] hover:bg-[#F4F7FB] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#172B4D] mb-1">
              Trip / Outing Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Rishikesh Rafting & Camping Weekend"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#F4F7FB] border border-[#E5EAF1] focus:border-[#1685D4] rounded-lg px-3.5 py-2 text-xs text-[#172B4D] placeholder-slate-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#172B4D] mb-1">
              Destination *
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-[#94A3B8] absolute left-3 top-2.5" />
              <input
                type="text"
                required
                placeholder="e.g., Rishikesh, Uttarakhand"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full bg-[#F4F7FB] border border-[#E5EAF1] focus:border-[#1685D4] rounded-lg pl-9 pr-3.5 py-2 text-xs text-[#172B4D] placeholder-slate-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                Dates
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-[#94A3B8] absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="10 Dec - 15 Dec"
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="w-full bg-[#F4F7FB] border border-[#E5EAF1] focus:border-[#1685D4] rounded-lg pl-9 pr-3 py-2 text-xs text-[#172B4D] placeholder-slate-400 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                Estimated Budget (₹)
              </label>
              <input
                type="number"
                placeholder="35000"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full bg-[#F4F7FB] border border-[#E5EAF1] focus:border-[#1685D4] rounded-lg px-3 py-2 text-xs text-[#172B4D] font-mono focus:outline-none"
              />
            </div>
          </div>

          {/* Quick Suggestions */}
          <div>
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block mb-1.5">
              Popular Destinations
            </span>
            <div className="space-y-1.5">
              {sampleSuggestions.map((item) => (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => {
                    setTitle(item.title);
                    setDestination(item.destination);
                    setBudget(String(item.budget));
                  }}
                  className="w-full p-2.5 rounded-lg bg-[#F4F7FB] hover:bg-slate-100 border border-[#E5EAF1] text-left transition-colors flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs font-semibold text-[#172B4D]">{item.title}</p>
                    <p className="text-[11px] text-[#64748B]">{item.destination}</p>
                  </div>
                  <span className="text-xs text-[#0A9B78] font-bold num-inr">
                    ₹{item.budget.toLocaleString('en-IN')}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-[#E5EAF1]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#64748B] hover:text-[#172B4D]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-[#173B70] hover:bg-[#1685D4] text-white font-medium text-xs shadow-xs transition-colors"
            >
              Create Trip
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
