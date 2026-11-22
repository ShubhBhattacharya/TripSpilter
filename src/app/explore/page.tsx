'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '../../components/layout/Sidebar';
import { TopHeader } from '../../components/layout/TopHeader';
import { BottomNav } from '../../components/layout/BottomNav';
import { CreateTripModal } from '../../components/modals/CreateTripModal';
import { ScanMerchantQrModal } from '../../components/modals/ScanMerchantQrModal';
import {
  MapPin,
  Star,
  Search,
  Sparkles,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';

interface DestinationItem {
  id: string;
  name: string;
  state: string;
  category: 'hill' | 'beach' | 'heritage' | 'adventure';
  tagline: string;
  image: string;
  recommendedDays: string;
  avgBudgetPerHead: number;
  rating: number;
  highlights: string[];
}

const featuredDestinations: DestinationItem[] = [
  {
    id: 'manali',
    name: 'Manali & Solang Valley',
    state: 'Himachal Pradesh',
    category: 'hill',
    tagline: 'Snow-capped peaks, pine forests & river rafting adventures',
    image: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=1200&q=80',
    recommendedDays: '4-5 Days',
    avgBudgetPerHead: 14500,
    rating: 4.9,
    highlights: ['Rohtang Pass', 'Old Manali Cafes', 'Jogini Waterfall', 'Solang Paragliding'],
  },
  {
    id: 'goa',
    name: 'North & South Goa Coast',
    state: 'Goa',
    category: 'beach',
    tagline: 'Pristine shorelines, sunset cruises & vibrant beach shacks',
    image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1200&q=80',
    recommendedDays: '4-6 Days',
    avgBudgetPerHead: 18000,
    rating: 4.8,
    highlights: ['Anjuna Flea Market', 'Palolem Beach', 'Chapora Fort Sunset', 'Scooter Trail'],
  },
  {
    id: 'jaipur',
    name: 'Jaipur Pink City & Forts',
    state: 'Rajasthan',
    category: 'heritage',
    tagline: 'Royal palaces, hilltop fortresses & authentic Rajasthani dining',
    image: 'https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=1200&q=80',
    recommendedDays: '3-4 Days',
    avgBudgetPerHead: 11000,
    rating: 4.7,
    highlights: ['Amer Fort Light Show', 'Hawa Mahal', 'Nahargarh Sunset', 'Chokhi Dhani'],
  },
  {
    id: 'ladakh',
    name: 'Leh Ladakh & Nubra Valley',
    state: 'Ladakh',
    category: 'adventure',
    tagline: 'High mountain passes, turquoise lakes & Buddhist monasteries',
    image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
    recommendedDays: '7-9 Days',
    avgBudgetPerHead: 32000,
    rating: 5.0,
    highlights: ['Pangong Tso Lake', 'Khardung La Pass', 'Diskit Gompa', 'Magnetic Hill'],
  },
  {
    id: 'rishikesh',
    name: 'Rishikesh & Ganga Beach',
    state: 'Uttarakhand',
    category: 'adventure',
    tagline: 'White water river rafting, cliff jumping & riverside bonfire camps',
    image: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80',
    recommendedDays: '2-3 Days',
    avgBudgetPerHead: 8500,
    rating: 4.8,
    highlights: ['Shivpuri Rafting', 'Beatles Ashram', 'Triveni Ghat Aarti', 'Bungee Jumping'],
  },
  {
    id: 'munnar',
    name: 'Munnar & Western Ghats',
    state: 'Kerala',
    category: 'hill',
    tagline: 'Endless rolling tea plantations, mist-covered valleys & waterfalls',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    recommendedDays: '3-4 Days',
    avgBudgetPerHead: 13500,
    rating: 4.9,
    highlights: ['Tea Estate Walks', 'Top Station Viewpoint', 'Eravikulam Park', 'Spice Gardens'],
  },
];

export default function ExplorePage() {
  const router = useRouter();
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'hill' | 'beach' | 'heritage' | 'adventure'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateTripOpen, setIsCreateTripOpen] = useState(false);
  const [isScanMerchantOpen, setIsScanMerchantOpen] = useState(false);

  const filteredDestinations = featuredDestinations.filter((dest) => {
    const matchesCategory = selectedFilter === 'all' || dest.category === selectedFilter;
    const matchesSearch =
      dest.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dest.state.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dest.tagline.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handlePlanDestination = (destination: DestinationItem) => {
    toast.success(`Starting trip planner for ${destination.name}!`);
    setIsCreateTripOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-[#172B4D] flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-12">
        <TopHeader onScanClick={() => setIsScanMerchantOpen(true)} title="Explore Destinations" />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto w-full space-y-6">
          {/* Header Banner */}
          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#173B70] to-[#1685D4] text-white p-6 sm:p-10 shadow-sm">
            <div className="max-w-2xl space-y-3 relative z-10">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Curated Group Travel Inspiration</span>
              </span>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
                Where are we going next?
              </h1>
              <p className="text-xs sm:text-sm text-slate-100 font-normal max-w-xl leading-relaxed">
                Explore handpicked Indian destinations with estimated group budgets and curated itineraries. Plan together, invite your crew, and split expenses directly.
              </p>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-[#E5EAF1] shadow-xs">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search destinations, states, or activities..."
                className="w-full pl-9 pr-3 py-2 bg-[#F4F7FB] border border-[#E5EAF1] rounded-xl text-xs font-medium text-[#172B4D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1685D4]/20 focus:border-[#1685D4]"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: 'all', label: 'All Places' },
                { id: 'hill', label: 'Hill Stations' },
                { id: 'beach', label: 'Beaches' },
                { id: 'heritage', label: 'Heritage & Forts' },
                { id: 'adventure', label: 'Adventure Treks' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedFilter(tab.id as typeof selectedFilter)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedFilter === tab.id
                      ? 'bg-[#173B70] text-white shadow-xs'
                      : 'bg-[#F4F7FB] text-[#64748B] hover:text-[#172B4D] hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Destinations Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDestinations.map((dest) => (
              <div
                key={dest.id}
                className="bg-white rounded-2xl border border-[#E5EAF1] overflow-hidden shadow-xs hover:shadow-md transition-all group flex flex-col"
              >
                {/* Image Cover */}
                <div className="relative h-48 w-full overflow-hidden bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={dest.image}
                    alt={dest.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                  {/* Rating Badge */}
                  <div className="absolute top-3 right-3 px-2 py-0.5 rounded-lg bg-black/50 backdrop-blur-md text-white text-[11px] font-bold flex items-center gap-1 border border-white/20">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    <span>{dest.rating}</span>
                  </div>

                  {/* Destination Location Title */}
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <div className="flex items-center gap-1 text-[11px] text-sky-200 font-medium">
                      <MapPin className="w-3 h-3" />
                      <span>{dest.state}</span>
                    </div>
                    <h3 className="text-base font-bold text-white drop-shadow-xs">{dest.name}</h3>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <p className="text-xs text-[#64748B] leading-relaxed mb-3">{dest.tagline}</p>

                    {/* Highlights tags */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {dest.highlights.slice(0, 3).map((h, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-[#F4F7FB] border border-[#E5EAF1] text-[10px] font-medium text-[#64748B]"
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Bottom Stats & Plan CTA */}
                  <div className="pt-3 border-t border-[#E5EAF1] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-[#64748B] block">Avg. Per Head</span>
                      <strong className="text-xs font-bold text-[#172B4D] num-inr">
                        ₹{dest.avgBudgetPerHead.toLocaleString('en-IN')}
                      </strong>
                    </div>

                    <button
                      type="button"
                      onClick={() => handlePlanDestination(dest)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#173B70] hover:bg-[#1685D4] text-white text-xs font-semibold shadow-xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Plan Outing</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav onScanClick={() => setIsScanMerchantOpen(true)} />

      {/* Modals */}
      <CreateTripModal
        isOpen={isCreateTripOpen}
        onClose={() => setIsCreateTripOpen(false)}
        onCreate={(tripData) => {
          toast.success(`Outing "${tripData.title}" created! 🚀`);
          router.push('/trips');
        }}
      />

      <ScanMerchantQrModal
        isOpen={isScanMerchantOpen}
        onClose={() => setIsScanMerchantOpen(false)}
        onSelectVendor={(v) => {
          router.push(`/qr-split?vendor=${encodeURIComponent(v.name)}&upi=${encodeURIComponent(v.upiId)}&am=${v.amount || ''}`);
        }}
      />
    </div>
  );
}
