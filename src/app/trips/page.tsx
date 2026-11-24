'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '../../components/layout/Sidebar';
import { TopHeader } from '../../components/layout/TopHeader';
import { BottomNav } from '../../components/layout/BottomNav';
import { CreateTripModal } from '../../components/modals/CreateTripModal';
import { JoinTripModal } from '../../components/modals/JoinTripModal';
import { ScanMerchantQrModal } from '../../components/modals/ScanMerchantQrModal';
import { TripCard } from '../../components/dashboard/TripCard';
import { TripCardSkeleton } from '../../components/ui/Skeleton';
import { Trip } from '../../types/trip';
import { mockTrips, defaultMembers } from '../../data/mockData';
import { useAuth } from '../../components/auth/AuthProvider';
import {
  Compass,
  Plus,
  Users,
  Search,
  MapPin,
} from 'lucide-react';
import { toast } from 'sonner';

export default function MyTripsPage() {
  const router = useRouter();
  const { isConfigured } = useAuth();

  const isDemoMode = !isConfigured || process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  const [trips, setTrips] = useState<Trip[]>(() => (isDemoMode && !isConfigured ? mockTrips : []));
  const [loading, setLoading] = useState<boolean>(isConfigured);
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'ACTIVE' | 'UPCOMING' | 'COMPLETED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateTripOpen, setIsCreateTripOpen] = useState(false);
  const [isJoinTripOpen, setIsJoinTripOpen] = useState(false);
  const [isScanMerchantOpen, setIsScanMerchantOpen] = useState(false);

  useEffect(() => {
    // Load any custom 3D trips saved locally
    const loadLocalCustomTrips = (): Trip[] => {
      try {
        const rawCustom = typeof window !== 'undefined' ? localStorage.getItem('tripsplit_custom_trips') : null;
        if (rawCustom) {
          const parsed = JSON.parse(rawCustom);
          if (Array.isArray(parsed)) {
            return parsed.map((c: any, i: number) => ({
              id: `local-3d-${i}`,
              title: c.name || `${c.destination} 3D Outing`,
              tagline: `Interactive 3D itinerary for ${c.destination}`,
              destination: c.destination,
              coverImage:
                'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=1200&q=80',
              startDate: c.startDate || new Date().toISOString().split('T')[0],
              endDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
              budget: Number(c.totalBudget) || 0,
              totalSpend: 0,
              status: 'ACTIVE',
              members: defaultMembers,
              itinerary: (c.spots || []).map((s: any, sIdx: number) => ({
                id: `itin-${sIdx}`,
                day: 1,
                time: '10:00 AM',
                title: s.name,
                category: 'Activity',
                cost: Number(s.cost) || 0,
                location: c.destination,
                notes: 'Saved from 3D Virtual Tour',
              })),
              polls: [],
              bookings: [],
              vendorSplits: [],
              debts: [],
            }));
          }
        }
      } catch {
        // ignore
      }
      return [];
    };

    if (!isConfigured) {
      const localTrips = loadLocalCustomTrips();
      if (localTrips.length > 0) {
        setTrips((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const uniqueNew = localTrips.filter((lt) => !existingIds.has(lt.id));
          return [...uniqueNew, ...prev];
        });
      }
      return;
    }

    async function fetchTrips() {
      try {
        setLoading(true);
        const res = await fetch('/api/trips');
        if (res.ok) {
          const data = await res.json();
          interface DbMember {
            user_id: string;
            role?: string;
            profiles?: {
              id: string;
              display_name?: string | null;
              upi_id?: string | null;
              avatar_url?: string | null;
            } | null;
          }
          interface DbTrip {
            id: string;
            title: string;
            destination: string;
            start_date: string;
            end_date: string;
            budget: number;
            cover_image?: string | null;
            status: 'ACTIVE' | 'UPCOMING' | 'COMPLETED';
            trip_members?: DbMember[];
          }

          if (Array.isArray(data.trips)) {
            const mapped: Trip[] = data.trips.map((dt: DbTrip) => ({
              id: dt.id,
              title: dt.title,
              tagline: `Exploring ${dt.destination} with zero-float UPI splits`,
              destination: dt.destination,
              coverImage:
                dt.cover_image ||
                'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=1200&q=80',
              startDate: dt.start_date,
              endDate: dt.end_date,
              budget: Number(dt.budget) || 0,
              totalSpend: 0,
              status: dt.status || 'ACTIVE',
              members:
                dt.trip_members?.map((tm: DbMember) => ({
                  id: tm.user_id,
                  name: tm.profiles?.display_name || 'Trip Member',
                  upiId: tm.profiles?.upi_id || 'member@upi',
                  avatar:
                    tm.profiles?.avatar_url ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
                })) || defaultMembers,
              itinerary: [],
              polls: [],
              bookings: [],
              vendorSplits: [],
              debts: [],
            }));
            const localCustom = loadLocalCustomTrips();
            setTrips([...localCustom, ...mapped]);
          }
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }

    fetchTrips();
  }, [isConfigured]);

  const filteredTrips = trips.filter((t) => {
    const matchesStatus = selectedStatus === 'ALL' || t.status === selectedStatus;
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.destination.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-[#172B4D] flex flex-col lg:flex-row">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-12">
        <TopHeader onScanClick={() => setIsScanMerchantOpen(true)} title="My Outings" />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto w-full space-y-6">
          {/* Welcome Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#E5EAF1] shadow-xs">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Compass className="w-5 h-5 text-[#1685D4]" />
                <h1 className="text-xl sm:text-2xl font-bold text-[#172B4D] tracking-tight">
                  My Trips & Group Outings
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-[#64748B]">
                Manage ongoing itineraries, shared bookings & live direct UPI bill settlements.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsJoinTripOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-[#E5EAF1] bg-[#F4F7FB] hover:bg-slate-200 text-[#172B4D] font-semibold text-xs transition-colors"
              >
                <Users className="w-3.5 h-3.5 text-[#173B70]" />
                <span>Join with Code</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCreateTripOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#173B70] hover:bg-[#1685D4] text-white font-semibold text-xs shadow-xs active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Trip</span>
              </button>
            </div>
          </div>

          {/* Search & Status Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-[#E5EAF1] shadow-xs">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by trip name or destination..."
                className="w-full pl-9 pr-3 py-2 bg-[#F4F7FB] border border-[#E5EAF1] rounded-xl text-xs font-medium text-[#172B4D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1685D4]/20 focus:border-[#1685D4]"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: 'ALL', label: 'All Trips' },
                { id: 'ACTIVE', label: 'Active Outings' },
                { id: 'UPCOMING', label: 'Upcoming' },
                { id: 'COMPLETED', label: 'Completed' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedStatus(tab.id as typeof selectedStatus)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedStatus === tab.id
                      ? 'bg-[#173B70] text-white shadow-xs'
                      : 'bg-[#F4F7FB] text-[#64748B] hover:text-[#172B4D] hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Trips Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <TripCardSkeleton />
              <TripCardSkeleton />
              <TripCardSkeleton />
            </div>
          ) : filteredTrips.length === 0 ? (
            <div className="rounded-2xl bg-white border border-[#E5EAF1] p-12 text-center flex flex-col items-center justify-center my-6 shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-[#EBF5FB] text-[#1685D4] flex items-center justify-center mb-4">
                <MapPin className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-[#172B4D] mb-1">No trips found</h3>
              <p className="text-xs text-[#64748B] max-w-sm mb-6">
                {searchQuery
                  ? `No outings matched "${searchQuery}". Try a different keyword.`
                  : 'Start your first outing to split expenses directly with buddies.'}
              </p>
              <button
                type="button"
                onClick={() => setIsCreateTripOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#173B70] hover:bg-[#1685D4] text-white font-semibold text-xs shadow-xs active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Outing</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTrips.map((trip) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </div>
          )}
        </main>
      </div>

      <BottomNav onScanClick={() => setIsScanMerchantOpen(true)} />

      <CreateTripModal
        isOpen={isCreateTripOpen}
        onClose={() => setIsCreateTripOpen(false)}
        onCreate={(tripData) => {
          const newTrip: Trip = {
            id: `trip-${Date.now()}`,
            title: tripData.title,
            tagline: `Exploring ${tripData.destination}`,
            destination: tripData.destination,
            coverImage: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=1200&q=80',
            startDate: tripData.startDate,
            endDate: tripData.endDate,
            budget: tripData.budget,
            totalSpend: 0,
            status: 'ACTIVE',
            members: defaultMembers,
            itinerary: [],
            polls: [],
            bookings: [],
            vendorSplits: [],
            debts: [],
          };
          setTrips((prev) => [newTrip, ...prev]);
          toast.success(`Trip "${tripData.title}" created! 🚀`);
        }}
      />

      <JoinTripModal
        isOpen={isJoinTripOpen}
        onClose={() => setIsJoinTripOpen(false)}
        onJoinSuccess={(code) => {
          router.push(`/trips/trip-manali-2026?joined=${encodeURIComponent(code)}`);
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
