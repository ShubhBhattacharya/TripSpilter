'use client';

import React, { useState } from 'react';
import {
  Clock,
  MapPin,
  ExternalLink,
  Receipt,
  Bus,
  Home,
  Utensils,
  Compass,
  CheckCircle2,
  Vote,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import { ItineraryItem, GroupPoll, TimelineCategory } from '../../types/trip';
import { formatInr } from '../../lib/upi';
import { useAuth } from '../auth/AuthProvider';
import { toast } from 'sonner';

interface ItineraryTabProps {
  initialItinerary: ItineraryItem[];
  initialPolls: GroupPoll[];
}

export const ItineraryTab: React.FC<ItineraryTabProps> = ({
  initialItinerary,
  initialPolls,
}) => {
  const { user, profile } = useAuth();
  const [itinerary, setItinerary] = useState<ItineraryItem[]>(initialItinerary);
  const [polls, setPolls] = useState<GroupPoll[]>(initialPolls);
  const [selectedDay, setSelectedDay] = useState<number | 'ALL'>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<TimelineCategory>('Food');
  const [newItemCost, setNewItemCost] = useState('1500');

  // Group items by day
  const days = Array.from(new Set(itinerary.map((item) => item.day))).sort();

  const filteredItems =
    selectedDay === 'ALL' ? itinerary : itinerary.filter((item) => item.day === selectedDay);

  const getCategoryIcon = (category: TimelineCategory) => {
    switch (category) {
      case 'Transport':
        return <Bus className="w-3.5 h-3.5 text-[#1685D4]" />;
      case 'Stay':
        return <Home className="w-3.5 h-3.5 text-indigo-600" />;
      case 'Food':
        return <Utensils className="w-3.5 h-3.5 text-amber-600" />;
      case 'Activity':
        return <Compass className="w-3.5 h-3.5 text-[#047857]" />;
      case 'Sightseeing':
        return <Sparkles className="w-3.5 h-3.5 text-purple-600" />;
    }
  };

  const getCategoryBadge = (category: TimelineCategory) => {
    switch (category) {
      case 'Transport':
        return 'bg-blue-50 text-[#1685D4] border-blue-200/60';
      case 'Stay':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200/60';
      case 'Food':
        return 'bg-amber-50 text-amber-700 border-amber-200/60';
      case 'Activity':
        return 'bg-emerald-50 text-[#047857] border-emerald-200/60';
      case 'Sightseeing':
        return 'bg-purple-50 text-purple-700 border-purple-200/60';
    }
  };

  const handleVote = (pollId: string, optionId: string) => {
    toast.success('Vote recorded! 🗳️', {
      description: 'Poll percentages updated in real-time.',
    });
    setPolls((prevPolls) =>
      prevPolls.map((poll) => {
        if (poll.id !== pollId) return poll;
        const currentUserId = user?.id || profile?.id || 'guest-voter';

        const updatedOptions = poll.options.map((opt) => {
          const hasVoted = opt.votes.includes(currentUserId);
          if (opt.id === optionId) {
            return {
              ...opt,
              votes: hasVoted
                ? opt.votes.filter((id) => id !== currentUserId)
                : [...opt.votes, currentUserId],
            };
          } else {
            return {
              ...opt,
              votes: opt.votes.filter((id) => id !== currentUserId),
            };
          }
        });

        return {
          ...poll,
          options: updatedOptions,
        };
      })
    );
  };

  const toggleItemCompletion = (itemId: string) => {
    setItinerary((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, isCompleted: !item.isCompleted } : item
      )
    );
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemTitle) return;
    const newItem: ItineraryItem = {
      id: `itin-${Date.now()}`,
      day: selectedDay === 'ALL' ? 2 : selectedDay,
      time: '07:30 PM',
      title: newItemTitle,
      location: 'Old Manali, Himachal Pradesh',
      category: newItemCategory,
      notes: 'Added from trip workspace',
      mapsUrl: 'https://maps.google.com/?q=Old+Manali',
      estimatedCost: Number(newItemCost) || 0,
      paidBy: profile?.display_name || user?.email?.split('@')[0] || 'You',
      isCompleted: false,
    };
    setItinerary([...itinerary, newItem]);
    setNewItemTitle('');
    setShowAddModal(false);
    toast.success('Itinerary activity added! 📅');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left 2 Columns: Vertical Timeline */}
      <div className="lg:col-span-2 space-y-5">
        {/* Day Selector & Action */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-white border border-[#E5EAF1] shadow-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedDay('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedDay === 'ALL'
                  ? 'bg-[#173B70] text-white shadow-xs'
                  : 'bg-[#F4F7FB] text-[#64748B] hover:text-[#172B4D]'
              }`}
            >
              All Days ({itinerary.length})
            </button>
            {days.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  selectedDay === day
                    ? 'bg-[#173B70] text-white shadow-xs'
                    : 'bg-[#F4F7FB] text-[#64748B] hover:text-[#172B4D]'
                }`}
              >
                Day {day}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1685D4] hover:bg-[#126bb0] text-white text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Activity</span>
          </button>
        </div>

        {/* Day-by-Day Vertical Timeline */}
        <div className="relative pl-6 space-y-4 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E5EAF1]">
          {filteredItems.map((item) => (
            <div key={item.id} className="relative group">
              {/* Timeline Node Dot */}
              <button
                type="button"
                onClick={() => toggleItemCompletion(item.id)}
                className={`absolute -left-6 top-4 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                  item.isCompleted
                    ? 'bg-[#0A9B78] border-[#0A9B78] text-white'
                    : 'bg-white border-[#CBD5E1] group-hover:border-[#1685D4] text-transparent hover:text-[#1685D4]'
                }`}
                title={item.isCompleted ? 'Mark as Incomplete' : 'Mark as Completed'}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
              </button>

              {/* Activity Card */}
              <div
                className={`p-4 sm:p-5 rounded-xl bg-white border transition-all duration-200 ${
                  item.isCompleted
                    ? 'border-[#E5EAF1] opacity-75'
                    : 'border-[#E5EAF1] hover:border-[#CBD5E1] shadow-xs'
                }`}
              >
                {/* Header Row: Category, Day, Time */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border ${getCategoryBadge(
                        item.category
                      )}`}
                    >
                      {getCategoryIcon(item.category)}
                      {item.category}
                    </span>
                    <span className="text-[11px] font-semibold text-[#64748B]">
                      Day {item.day}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-xs text-[#64748B] font-medium">
                    <Clock className="w-3.5 h-3.5 text-[#94A3B8]" />
                    <span>{item.time}</span>
                  </div>
                </div>

                {/* Title & Location */}
                <h4
                  className={`text-sm sm:text-base font-bold text-[#172B4D] ${
                    item.isCompleted ? 'line-through text-[#64748B]' : ''
                  }`}
                >
                  {item.title}
                </h4>

                <div className="flex items-center gap-1.5 text-xs text-[#64748B] mt-1">
                  <MapPin className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                  <span>{item.location}</span>
                </div>

                {item.notes && (
                  <p className="text-xs text-[#64748B] mt-2 bg-[#F4F7FB] p-2.5 rounded-lg border border-[#E5EAF1]">
                    {item.notes}
                  </p>
                )}

                {/* Footer: Expense Badge & Maps Link */}
                <div className="mt-4 pt-3 border-t border-[#E5EAF1] flex flex-wrap items-center justify-between gap-2">
                  {item.estimatedCost !== undefined && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <Receipt className="w-3.5 h-3.5 text-[#0A9B78]" />
                      <span className="text-[#64748B]">Estimated:</span>
                      <span className="font-bold text-[#172B4D] num-inr">
                        {item.estimatedCost === 0 ? 'Free' : formatInr(item.estimatedCost)}
                      </span>
                      {item.paidBy && (
                        <span className="text-[10px] text-[#64748B] bg-slate-100 px-1.5 py-0.5 rounded">
                          by {item.paidBy}
                        </span>
                      )}
                    </div>
                  )}

                  <a
                    href={item.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-[#1685D4] hover:text-[#126bb0] transition-colors ml-auto font-medium"
                  >
                    <span>View on Maps</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Column: Group Decisions & Polls */}
      <div className="space-y-5">
        <div className="p-5 rounded-xl bg-white border border-[#E5EAF1] shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <Vote className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#172B4D] uppercase tracking-wider">
                  Group Decisions
                </h3>
                <p className="text-[11px] text-[#64748B]">Vote on spots & timing</p>
              </div>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-purple-50 text-purple-700 border border-purple-200">
              Live
            </span>
          </div>

          <div className="space-y-4">
            {polls.map((poll) => {
              const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes.length, 0);

              return (
                <div
                  key={poll.id}
                  className="p-3.5 rounded-xl bg-[#F4F7FB] border border-[#E5EAF1] space-y-3"
                >
                  <div>
                    <h4 className="text-xs font-semibold text-[#172B4D] leading-snug">
                      {poll.question}
                    </h4>
                    <p className="text-[10px] text-[#64748B] mt-0.5">
                      By {poll.createdBy} • {totalVotes} votes cast
                    </p>
                  </div>

                  <div className="space-y-2">
                    {poll.options.map((option) => {
                      const voteCount = option.votes.length;
                      const percentage =
                        totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                      const isUserVoted = option.votes.includes(user?.id || profile?.id || 'guest-voter');

                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => handleVote(poll.id, option.id)}
                          className={`w-full relative overflow-hidden text-left p-2.5 rounded-lg border text-xs transition-all ${
                            isUserVoted
                              ? 'border-[#1685D4] bg-white text-[#172B4D] font-medium shadow-xs'
                              : 'border-[#E5EAF1] bg-white text-[#64748B] hover:border-[#CBD5E1]'
                          }`}
                        >
                          <div
                            className={`absolute left-0 top-0 bottom-0 transition-all duration-300 ${
                              isUserVoted ? 'bg-[#1685D4]/10' : 'bg-slate-100/60'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />

                          <div className="relative flex items-center justify-between z-10">
                            <span className="flex items-center gap-1.5">
                              {isUserVoted && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#1685D4] shrink-0" />
                              )}
                              <span>{option.text}</span>
                            </span>
                            <span className="font-semibold num-inr text-[#172B4D]">
                              {percentage}%
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white border border-[#E5EAF1] rounded-xl shadow-xl overflow-hidden">
            <div className="p-4 border-b border-[#E5EAF1] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#172B4D]">Add Itinerary Activity</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-[#64748B] hover:text-[#172B4D]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddItem} className="p-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#172B4D] block mb-1">
                  Activity Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. River Rafting in Solang"
                  value={newItemTitle}
                  onChange={(e) => setNewItemTitle(e.target.value)}
                  className="w-full bg-[#F4F7FB] border border-[#E5EAF1] rounded-lg px-3 py-2 text-xs text-[#172B4D]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#172B4D] block mb-1">
                    Category
                  </label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value as TimelineCategory)}
                    className="w-full bg-[#F4F7FB] border border-[#E5EAF1] rounded-lg px-3 py-2 text-xs text-[#172B4D]"
                  >
                    <option value="Activity">Activity</option>
                    <option value="Food">Food / Cafe</option>
                    <option value="Stay">Stay / Hotel</option>
                    <option value="Transport">Transport</option>
                    <option value="Sightseeing">Sightseeing</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#172B4D] block mb-1">
                    Estimated Cost (₹)
                  </label>
                  <input
                    type="number"
                    value={newItemCost}
                    onChange={(e) => setNewItemCost(e.target.value)}
                    className="w-full bg-[#F4F7FB] border border-[#E5EAF1] rounded-lg px-3 py-2 text-xs text-[#172B4D] font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-xs text-[#64748B] hover:text-[#172B4D]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#1685D4] hover:bg-[#126bb0] text-white text-xs font-semibold"
                >
                  Save Activity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
