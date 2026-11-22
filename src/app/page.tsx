'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '../components/layout/Sidebar';
import { TopHeader } from '../components/layout/TopHeader';
import { BottomNav } from '../components/layout/BottomNav';
import { SummaryCards } from '../components/dashboard/SummaryCards';
import { QuickActionBar } from '../components/dashboard/QuickActionBar';
import { TripCard } from '../components/dashboard/TripCard';
import { RecentActivity } from '../components/dashboard/RecentActivity';
import { CreateTripModal } from '../components/modals/CreateTripModal';
import { ScanMerchantQrModal } from '../components/modals/ScanMerchantQrModal';
import { AiBillScanModal, BillData } from '../components/modals/AiBillScanModal';
import { TripCardSkeleton } from '../components/ui/Skeleton';
import { defaultMembers, mockTrips } from '../data/mockData';
import { Trip } from '../types/trip';
import { Compass, Plus, MapPin, AlertCircle } from 'lucide-react';
import { useAuth } from '../components/auth/AuthProvider';
import { toast } from 'sonner';

export default function DashboardPage() {
  const router = useRouter();
  const { profile, user, isConfigured } = useAuth();

  // In production, never silently load mock data. Only load mock data if explicitly in demo mode.
  const isDemoMode = !isConfigured || process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  const [trips, setTrips] = useState<Trip[]>(() => (isDemoMode && !isConfigured ? mockTrips : []));
  const [loadingTrips, setLoadingTrips] = useState<boolean>(isConfigured);
  const [isCreateTripOpen, setIsCreateTripOpen] = useState(false);
  const [isScanMerchantOpen, setIsScanMerchantOpen] = useState(false);
  const [isAiBillScanOpen, setIsAiBillScanOpen] = useState(false);

  const displayName = profile?.display_name || user?.user_metadata?.full_name || (isConfigured ? 'Traveler' : 'Aarav');

  // Fetch real user trips if Supabase is active
  useEffect(() => {
    if (!isConfigured) {
      return;
    }

    async function loadTrips() {
      try {
        setLoadingTrips(true);
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
              members: dt.trip_members?.map((tm: DbMember) => ({
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
            setTrips(mapped);
          } else {
            setTrips([]);
          }
        } else {
          setTrips([]);
        }
      } catch (err) {
        console.warn('Failed to load trips from API:', err);
        setTrips([]);
      } finally {
        setLoadingTrips(false);
      }
    }

    loadTrips();
  }, [isConfigured]);

  // Handle new trip creation
  const handleCreateTrip = async (tripData: {
    title: string;
    destination: string;
    startDate: string;
    endDate: string;
    budget: number;
  }) => {
    try {
      const newTrip: Trip = {
        id: `trip-${Date.now()}`,
        title: tripData.title,
        tagline: 'Planned with TripSplit zero-float UPI splitting',
        destination: tripData.destination,
        coverImage:
          'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
        startDate: tripData.startDate,
        endDate: tripData.endDate,
        budget: tripData.budget,
        totalSpend: 0,
        status: 'UPCOMING',
        members: defaultMembers,
        itinerary: [],
        polls: [],
        bookings: [],
        vendorSplits: [],
        debts: [],
      };

      if (!isConfigured) {
        setTrips((prev) => [newTrip, ...prev]);
        try {
          const stored = JSON.parse(localStorage.getItem('tripsplit_custom_trips') || '[]');
          localStorage.setItem('tripsplit_custom_trips', JSON.stringify([newTrip, ...stored]));
        } catch {
          // ignore storage error
        }
        toast.success(`Trip "${tripData.title}" created! 🚀`);
        return;
      }

      // Live Supabase API call
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: tripData.title,
          destination: tripData.destination,
          startDate: tripData.startDate,
          endDate: tripData.endDate,
          budget: tripData.budget,
          coverImage: newTrip.coverImage,
        }),
      });

      if (res.ok) {
        const created = await res.json();
        const savedTrip: Trip = {
          ...newTrip,
          id: created.trip?.id || newTrip.id,
        };
        setTrips((prev) => [savedTrip, ...prev]);
        toast.success(`Trip "${tripData.title}" saved to Supabase! 🚀`);
      } else {
        const errData = await res.json();
        toast.error(errData.error || 'Failed to save trip to database.');
      }
    } catch {
      toast.error('An error occurred creating the trip.');
    }
  };

  const handleSelectVendor = (vendor: { name: string; upiId: string; amount?: number }) => {
    sessionStorage.setItem('scanned_vendor', JSON.stringify(vendor));
    if (trips.length > 0) {
      router.push(`/trips/${trips[0].id}?tab=split&vendor=${encodeURIComponent(vendor.name)}&upi=${encodeURIComponent(vendor.upiId)}&am=${vendor.amount || ''}`);
    } else {
      router.push(`/qr-split?vendor=${encodeURIComponent(vendor.name)}&upi=${encodeURIComponent(vendor.upiId)}&am=${vendor.amount || ''}`);
    }
  };

  // Compute live financial totals from user's actual trips
  const calculatedTotalSpend = trips.reduce((acc, t) => acc + (t.totalSpend || 0), 0);
  const calculatedBudget = trips.reduce((acc, t) => acc + (t.budget || 0), 0);
  const displaySpend = calculatedTotalSpend > 0 ? calculatedTotalSpend : calculatedBudget;

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-[#172B4D] flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-12">
        <TopHeader onScanClick={() => setIsScanMerchantOpen(true)} />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto w-full space-y-6">
          {/* Unconfigured Demo Mode Notice Banner */}
          {!isConfigured && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Local Sandbox Preview Mode:</strong> Connect Supabase credentials in <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-amber-950">.env.local</code> to save real outings and sync live UPI splits.
                </span>
              </div>
            </div>
          )}

          {/* Welcome Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-[#E5EAF1] shadow-xs">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#172B4D] tracking-tight">
                Welcome back, {displayName.split(' ')[0]}
              </h1>
              <p className="text-xs sm:text-sm text-[#64748B] mt-1">
                Manage your group itineraries, track shared expenses & settle directly via UPI.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsCreateTripOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#173B70] hover:bg-[#1685D4] text-white font-medium text-xs shadow-xs active:scale-95 transition-all self-start sm:self-auto shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Trip</span>
            </button>
          </div>

          {/* Financial Overview Cards with live calculations */}
          <SummaryCards
            totalSpend={displaySpend}
            youOwe={0}
            youAreOwed={0}
          />

          {/* Quick Actions Grid */}
          <QuickActionBar
            onCreateTrip={() => setIsCreateTripOpen(true)}
            onScanMerchant={() => setIsScanMerchantOpen(true)}
            onScanBillAi={() => setIsAiBillScanOpen(true)}
          />

          {/* Active Trips Grid & Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-[#172B4D] flex items-center gap-2">
                    <Compass className="w-4 h-4 text-[#1685D4]" />
                    Your Trips & Outings
                  </h2>
                  <p className="text-xs text-[#64748B]">
                    Active group travel spaces with live splits & bookings
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCreateTripOpen(true)}
                  className="flex items-center gap-1 text-xs font-semibold text-[#1685D4] hover:text-[#126bb0] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Outing</span>
                </button>
              </div>

              {loadingTrips ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TripCardSkeleton />
                  <TripCardSkeleton />
                </div>
              ) : trips.length === 0 ? (
                <div className="rounded-xl bg-white border border-[#E5EAF1] p-8 text-center flex flex-col items-center justify-center my-4 shadow-xs">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 text-[#64748B] flex items-center justify-center mb-3">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-[#172B4D] mb-1">No outings yet</h3>
                  <p className="text-xs text-[#64748B] max-w-sm mb-4">
                    Create your first trip to start splitting bills directly to merchants.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsCreateTripOpen(true)}
                    className="px-4 py-2 rounded-lg bg-[#173B70] hover:bg-[#1685D4] text-white text-xs font-medium transition-colors"
                  >
                    Create Your First Outing
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {trips.map((trip) => (
                    <TripCard key={trip.id} trip={trip} />
                  ))}
                </div>
              )}
            </div>

            {/* Sidebar: Activity Stream */}
            <div className="lg:col-span-1 space-y-4">
              <RecentActivity />
            </div>
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav onScanClick={() => setIsScanMerchantOpen(true)} />

      {/* Modals */}
      <CreateTripModal
        isOpen={isCreateTripOpen}
        onClose={() => setIsCreateTripOpen(false)}
        onCreate={handleCreateTrip}
      />

      <ScanMerchantQrModal
        isOpen={isScanMerchantOpen}
        onClose={() => setIsScanMerchantOpen(false)}
        onSelectVendor={handleSelectVendor}
      />

      <AiBillScanModal
        isOpen={isAiBillScanOpen}
        onClose={() => setIsAiBillScanOpen(false)}
        tripMembers={trips[0]?.members || defaultMembers}
        onApplySplit={(bill: BillData) => {
          toast.success(`OCR Extracted: ₹${bill.totalAmount} from ${bill.merchantName || 'Merchant'}!`);
          setIsAiBillScanOpen(false);
          if (trips.length > 0) {
            router.push(`/trips/${trips[0].id}?tab=split&vendor=${encodeURIComponent(bill.merchantName || 'Merchant')}&am=${bill.totalAmount}`);
          }
        }}
      />
    </div>
  );
}