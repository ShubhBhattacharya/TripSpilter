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
} from 'lucide-react';
import { ItineraryItem, GroupPoll, TimelineCategory } from '../../types/trip';
import { formatInr } from '../../lib/upi';
import { currentUser } from '../../data/mockData';
import { toast } from 'sonner';

interface ItineraryTabProps {
  initialItinerary: ItineraryItem[];
  initialPolls: GroupPoll[];
}

export const ItineraryTab: React.FC<ItineraryTabProps> = ({
  initialItinerary,
  initialPolls,
}) => {
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
        return <Bus className="w-4 h-4 text-sky-400" />;
      case 'Stay':
        return <Home className="w-4 h-4 text-indigo-400" />;
      case 'Food':
        return <Utensils className="w-4 h-4 text-amber-400" />;
      case 'Activity':
        return <Compass className="w-4 h-4 text-emerald-400" />;
      case 'Sightseeing':
        return <Sparkles className="w-4 h-4 text-purple-400" />;
    }
  };

  const getCategoryBadge = (category: TimelineCategory) => {
    switch (category) {
      case 'Transport':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
      case 'Stay':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'Food':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Activity':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Sightseeing':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    }
  };

  const handleVote = (pollId: string, optionId: string) => {
    toast.success('Vote recorded! 🗳️', {
      description: 'Poll percentages updated in real-time.',
    });
    setPolls((prevPolls) =>
      prevPolls.map((poll) => {
        if (poll.id !== pollId) return poll;
        const currentUserId = currentUser.id;

        const updatedOptions = poll.options.map((opt) => {
          const hasVoted = opt.votes.includes(currentUserId);
          if (opt.id === optionId) {
            // Toggle vote
            return {
              ...opt,
              votes: hasVoted
                ? opt.votes.filter((id) => id !== currentUserId)
                : [...opt.votes, currentUserId],
            };
          } else {
            // Remove from other options for single-choice poll
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
      paidBy: 'Aarav (You)',
      isCompleted: false,
    };
    setItinerary([...itinerary, newItem]);
    setNewItemTitle('');
    setShowAddModal(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left 2 Columns: Vertical Timeline */}
      <div className="lg:col-span-2 space-y-6">
        {/* Day Selector & Action */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#111827] border border-[#1F2937]">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedDay('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                selectedDay === 'ALL'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              All Days ({itinerary.length})
            </button>
            {days.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  selectedDay === day
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Day {day}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Event</span>
          </button>
        </div>

        {/* Day-by-Day Vertical Timeline */}
        <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-emerald-500 before:via-slate-700 before:to-slate-800">
          {filteredItems.map((item) => (
            <div key={item.id} className="relative group">
              {/* Timeline Node Dot */}
              <button
                type="button"
                onClick={() => toggleItemCompletion(item.id)}
                className={`absolute -left-6 top-4 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                  item.isCompleted
                    ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                    : 'bg-[#111827] border-slate-700 group-hover:border-emerald-400 text-transparent hover:text-emerald-400'
                }`}
                title={item.isCompleted ? 'Mark as Incomplete' : 'Mark as Completed'}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
              </button>

              {/* Card */}
              <div
                className={`p-4 sm:p-5 rounded-2xl bg-[#111827] border transition-all duration-200 ${
                  item.isCompleted
                    ? 'border-[#1F2937]/60 opacity-80'
                    : 'border-[#1F2937] hover:border-slate-700 shadow-xl'
                }`}
              >
                {/* Header Row: Category, Day, Time */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-md border ${getCategoryBadge(
                        item.category
                      )}`}
                    >
                      {getCategoryIcon(item.category)}
                      {item.category}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-300">
                      Day {item.day}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-xs text-slate-400 font-medium">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>{item.time}</span>
                  </div>
                </div>

                {/* Title & Location */}
                <h4
                  className={`text-base font-bold text-white ${
                    item.isCompleted ? 'line-through text-slate-400' : ''
                  }`}
                >
                  {item.title}
                </h4>

                <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>{item.location}</span>
                </div>

                {item.notes && (
                  <p className="text-xs text-slate-300 mt-2 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/70">
                    {item.notes}
                  </p>
                )}

                {/* Footer: Expense Badge & Maps Link */}
                <div className="mt-4 pt-3 border-t border-[#1F2937] flex flex-wrap items-center justify-between gap-2">
                  {/* Expense Badge */}
                  {item.estimatedCost !== undefined && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <Receipt className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-slate-400">Expense:</span>
                      <span className="font-bold text-emerald-400 num-inr">
                        {item.estimatedCost === 0 ? 'Free' : formatInr(item.estimatedCost)}
                      </span>
                      {item.paidBy && (
                        <span className="text-[10px] text-slate-300 bg-slate-800/80 px-1.5 py-0.5 rounded">
                          by {item.paidBy}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Maps Button */}
                  <a
                    href={item.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-emerald-400 transition-colors ml-auto"
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

      {/* Right Column: Group Polls Widget */}
      <div className="space-y-6">
        <div className="p-5 rounded-2xl bg-[#111827] border border-[#1F2937] shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                <Vote className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Group Decisions & Polls</h3>
                <p className="text-[11px] text-slate-400">Vote on spots & timing</p>
              </div>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30">
              Live
            </span>
          </div>

          {/* List of Polls */}
          <div className="space-y-6">
            {polls.map((poll) => {
              const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes.length, 0);

              return (
                <div
                  key={poll.id}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-3"
                >
                  <div>
                    <h4 className="text-xs font-semibold text-white leading-relaxed">
                      {poll.question}
                    </h4>
                    <p className="text-[10px] text-slate-300 mt-0.5">
                      By {poll.createdBy} • {poll.createdAt} • {totalVotes} votes cast
                    </p>
                  </div>

                  {/* Options */}
                  <div className="space-y-2">
                    {poll.options.map((option) => {
                      const voteCount = option.votes.length;
                      const percentage =
                        totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                      const isUserVoted = option.votes.includes(currentUser.id);

                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => handleVote(poll.id, option.id)}
                          className={`w-full relative overflow-hidden text-left p-3 rounded-xl border text-xs transition-all ${
                            isUserVoted
                              ? 'border-emerald-500/50 bg-emerald-950/20 text-white'
                              : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          {/* Live percentage fill bar */}
                          <div
                            className={`absolute left-0 top-0 bottom-0 transition-all duration-300 ${
                              isUserVoted ? 'bg-emerald-500/15' : 'bg-slate-800/40'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />

                          <div className="relative flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                                  isUserVoted
                                    ? 'border-emerald-400 bg-emerald-500'
                                    : 'border-slate-600'
                                }`}
                              >
                                {isUserVoted && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />
                                )}
                              </span>
                              <span className="font-medium truncate">{option.text}</span>
                            </div>
                            <span className="text-[11px] font-bold num-inr text-slate-300 shrink-0">
                              {percentage}% ({voteCount})
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

        {/* Packing & Weather Tip */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-[#111827] to-[#0f172a] border border-[#1F2937] text-xs text-slate-300 space-y-2">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <Sparkles className="w-4 h-4" />
            <span>Manali Weather & Packing</span>
          </div>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            Current Temp: <strong>6°C to -1°C</strong> in Solang Valley. Pack thermal innerwear, windcheaters, gloves, and comfortable grip hiking boots.
          </p>
        </div>
      </div>

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-[#111827] border border-[#1F2937] rounded-2xl p-5 space-y-4">
            <h4 className="text-base font-bold text-white">Add Itinerary Stop</h4>
            <form onSubmit={handleAddItem} className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 block mb-1">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Riverside Maggi & Chai at Nehru Kund"
                  value={newItemTitle}
                  onChange={(e) => setNewItemTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Category</label>
                <select
                  value={newItemCategory}
                  onChange={(e) => setNewItemCategory(e.target.value as TimelineCategory)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="Food">Food & Dining</option>
                  <option value="Activity">Adventure / Activity</option>
                  <option value="Sightseeing">Sightseeing</option>
                  <option value="Transport">Transport</option>
                  <option value="Stay">Hotel / Stay</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Estimated Expense (₹)</label>
                <input
                  type="number"
                  value={newItemCost}
                  onChange={(e) => setNewItemCost(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white num-inr"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs hover:bg-emerald-400"
                >
                  Add to Timeline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
