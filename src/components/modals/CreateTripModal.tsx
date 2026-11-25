'use client';

import React, { useState, useEffect } from 'react';
import { X, MapPin, Calendar, Plus } from 'lucide-react';

interface CreateTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTitle?: string;
  initialDestination?: string;
  initialBudget?: number;
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
  initialTitle = '',
  initialDestination = '',
  initialBudget = 35000,
  onCreate,
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [destination, setDestination] = useState(initialDestination);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(
    () => new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0]
  );
  const [budget, setBudget] = useState(String(initialBudget || 35000));
  const [dateError, setDateError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => {
        if (initialTitle) setTitle(initialTitle);
        if (initialDestination) setDestination(initialDestination);
        if (initialBudget) setBudget(String(initialBudget));
        setDateError(null);
      }, 0);
      return () => clearTimeout(t);
    }
  }, [isOpen, initialTitle, initialDestination, initialBudget]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDateError(null);
    if (!title.trim() || !destination.trim()) return;
    if (endDate < startDate) {
      setDateError('End date cannot be earlier than start date.');
      return;
    }

    onCreate({
      title: title.trim(),
      destination: destination.trim(),
      startDate,
      endDate,
      budget: Math.max(0, Number(budget) || 0),
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
            aria-label="Close create trip modal"
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
              minLength={2}
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
                minLength={2}
                placeholder="e.g., Rishikesh, Uttarakhand"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full bg-[#F4F7FB] border border-[#E5EAF1] focus:border-[#1685D4] rounded-lg pl-9 pr-3.5 py-2 text-xs text-[#172B4D] placeholder-slate-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                Start Date
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2.5 top-2.5 pointer-events-none" />
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-[#F4F7FB] border border-[#E5EAF1] focus:border-[#1685D4] rounded-lg pl-8 pr-2 py-2 text-xs text-[#172B4D] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                End Date
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-[#F4F7FB] border border-[#E5EAF1] focus:border-[#1685D4] rounded-lg px-2.5 py-2 text-xs text-[#172B4D] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                Budget (₹)
              </label>
              <input
                type="number"
                min={0}
                placeholder="35000"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full bg-[#F4F7FB] border border-[#E5EAF1] focus:border-[#1685D4] rounded-lg px-3 py-2 text-xs text-[#172B4D] font-mono focus:outline-none"
              />
            </div>
          </div>

          {dateError && (
            <p className="text-xs text-[#DC3545] font-medium">{dateError}</p>
          )}

          {/* Quick Suggestions */}
          <div>
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block mb-1.5">
              Popular Templates
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
