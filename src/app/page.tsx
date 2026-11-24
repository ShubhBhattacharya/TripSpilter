'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sidebar } from '../components/layout/Sidebar';
import { TopHeader } from '../components/layout/TopHeader';
import { BottomNav } from '../components/layout/BottomNav';
import { SummaryCards } from '../components/dashboard/SummaryCards';
import { QuickActionBar } from '../components/dashboard/QuickActionBar';
import { TripCard } from '../components/dashboard/TripCard';
import { RecentActivity } from '../components/dashboard/RecentActivity';
import { CreateTripModal } from '../components/modals/CreateTripModal';
import { JoinTripModal } from '../components/modals/JoinTripModal';
import { ScanMerchantQrModal } from '../components/modals/ScanMerchantQrModal';
import { AiBillScanModal, BillData } from '../components/modals/AiBillScanModal';
import { MultiStepOnboardingModal } from '../components/auth/MultiStepOnboardingModal';
import { WelcomeLandingPage } from '../components/landing/WelcomeLandingPage';
import { TripCardSkeleton } from '../components/ui/Skeleton';
import { defaultMembers, mockTrips } from '../data/mockData';
import { Trip } from '../types/trip';
import {
  Compass,
  Plus,
  MapPin,
  AlertCircle,
  Sparkles,
  Users,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../components/auth/AuthProvider';
import { toast } from 'sonner';

export default function DashboardPage() {
  const router = useRouter();
  const { profile, user, isConfigured } = useAuth();

  // If visitor is unauthenticated, show the Screen 1 Welcome Landing Page
  const [showPreviewDashboard, setShowPreviewDashboard] = useState(false);

  // In production, never silently load mock data. Only load mock data if explicitly in demo mode.
  const isDemoMode = !isConfigured || process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  const [trips, setTrips] = useState<Trip[]>(() => (isDemoMode && !isConfigured ? mockTrips : []));
  const [loadingTrips, setLoadingTrips] = useState<boolean>(isConfigured);
  const [searchTripQuery] = useState('');

  // Modals state
  const [isCreateTripOpen, setIsCreateTripOpen] = useState(false);
  const [isJoinTripOpen, setIsJoinTripOpen] = useState(false);
  const [isScanMerchantOpen, setIsScanMerchantOpen] = useState(false);
  const [isAiBillScanOpen, setIsAiBillScanOpen] = useState(false);

  const displayName = profile?.display_name || user?.user_metadata?.full_name || (user?.email ? user.email.split('@')[0] : 'Traveler');

  // Fetch real user trips if Supabase is active
  useEffect(() => {
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
          } else {
            const localCustom = loadLocalCustomTrips();
            setTrips(localCustom);
          }
        }
      } catch (err) {
        console.error('Failed to load trips from Supabase:', err);
      } finally {
        setLoadingTrips(false);
      }
    }

    loadTrips();
  }, [isConfigured]);

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
        tagline: `Exploring ${tripData.destination}`,
        destination: tripData.destination,
        coverImage:
          'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=1200&q=80',
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
      router.push(
        `/trips/${trips[0].id}?tab=split&vendor=${encodeURIComponent(vendor.name)}&upi=${encodeURIComponent(
          vendor.upiId
        )}&am=${vendor.amount || ''}`
      );
    } else {
      router.push(
        `/qr-split?vendor=${encodeURIComponent(vendor.name)}&upi=${encodeURIComponent(
          vendor.upiId
        )}&am=${vendor.amount || ''}`
      );
    }
  };

  // If visitor is unauthenticated, show Screen 1: Welcome Landing Page
  if (isConfigured && !user && !showPreviewDashboard) {
    return (
      <WelcomeLandingPage
        onGetStarted={() => router.push('/signup')}
        onLogin={() => router.push('/login')}
        onExploreDemo={() => setShowPreviewDashboard(true)}
      />
    );
  }

  // Filter trips based on search
  const displayedTrips = trips.filter(
    (t) =>
      t.title.toLowerCase().includes(searchTripQuery.toLowerCase()) ||
      t.destination.toLowerCase().includes(searchTripQuery.toLowerCase())
  );

  // Compute live financial totals from user's actual trips
  const calculatedTotalSpend = trips.reduce((acc, t) => acc + (t.totalSpend || 0), 0);
  const calculatedBudget = trips.reduce((acc, t) => acc + (t.budget || 0), 0);
  const displaySpend = calculatedTotalSpend > 0 ? calculatedTotalSpend : calculatedBudget;

  const completedTripsCount = trips.filter((t) => t.status === 'COMPLETED').length;
  const activeTripsCount = trips.filter((t) => t.status === 'ACTIVE' || t.status === 'UPCOMING').length;

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-[#172B4D] flex flex-col lg:flex-row font-sans selection:bg-[#1685D4]/20 selection:text-[#173B70]">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-12">
        <TopHeader onScanClick={() => setIsScanMerchantOpen(true)} />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto w-full space-y-6">
          {/* Demo Sandbox Banner */}
          {!isConfigured && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Sandbox Preview Mode:</strong> Explore the travel dashboard or view the{' '}
                  <button
                    type="button"
                    onClick={() => setShowPreviewDashboard(false)}
                    className="underline font-bold text-amber-950 hover:text-amber-700"
                  >
                    Welcome Landing Experience
                  </button>
                  .
                </span>
              </div>
            </div>
          )}

          {/* 1. Personalized Hero Banner: "Where are we going next?" */}
          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#173B70] via-[#173B70] to-[#1685D4] text-white p-6 sm:p-8 shadow-sm">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-xl">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-[11px] font-semibold">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Namaste, {displayName.split(' ')[0]}</span>
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  Where are we going next?
                </h1>
                <p className="text-xs sm:text-sm text-slate-100 font-normal leading-relaxed">
                  Manage your group itineraries, track shared expenses, and split merchant bills directly via UPI with zero float.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsJoinTripOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/25 text-white font-semibold text-xs transition-all flex items-center gap-1.5"
                >
                  <Users className="w-4 h-4" />
                  <span>Join Outing</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreateTripOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-white text-[#173B70] hover:bg-slate-100 font-bold text-xs shadow-md transition-all flex items-center gap-1.5 active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Trip</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2. Financial Overview Cards with live calculations */}
          <SummaryCards totalSpend={displaySpend} youOwe={0} youAreOwed={0} />

          {/* 3. Quick Action Bar */}
          <QuickActionBar
            onCreateTrip={() => setIsCreateTripOpen(true)}
            onScanMerchant={() => setIsScanMerchantOpen(true)}
            onScanBillAi={() => setIsAiBillScanOpen(true)}
          />

          {/* 4. Active Trips Grid & Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {/* Trips Section Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-[#172B4D] flex items-center gap-2">
                    <Compass className="w-4 h-4 text-[#1685D4]" />
                    Your Outings & Journeys
                  </h2>
                  <p className="text-xs text-[#64748B]">
                    Active group travel spaces with live splits & bookings
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href="/trips"
                    className="text-xs font-semibold text-[#1685D4] hover:underline flex items-center gap-0.5"
                  >
                    <span>View all</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {loadingTrips ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TripCardSkeleton />
                  <TripCardSkeleton />
                </div>
              ) : displayedTrips.length === 0 ? (
                <div className="rounded-2xl bg-white border border-[#E5EAF1] p-8 text-center flex flex-col items-center justify-center my-2 shadow-xs">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 text-[#64748B] flex items-center justify-center mb-3">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-[#172B4D] mb-1">No outings yet</h3>
                  <p className="text-xs text-[#64748B] max-w-sm mb-4">
                    Create your first trip or join a buddy&apos;s trip to start splitting bills directly.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsCreateTripOpen(true)}
                    className="px-4 py-2 rounded-xl bg-[#173B70] hover:bg-[#1685D4] text-white text-xs font-semibold transition-all shadow-xs"
                  >
                    Create Your First Outing
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {displayedTrips.map((trip) => (
                    <TripCard key={trip.id} trip={trip} />
                  ))}
                </div>
              )}

              {/* 5. Unique Engagement Feature: "Your Travel Story" (Section 4) */}
              <div className="bg-white rounded-2xl border border-[#E5EAF1] p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <h3 className="text-xs font-bold text-[#172B4D]">Your Travel Story & Milestones</h3>
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Live Record
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div className="p-3 rounded-xl bg-[#F4F7FB] border border-[#E5EAF1] text-center">
                    <span className="text-[10px] font-semibold text-[#64748B] block">Active Journeys</span>
                    <strong className="text-base font-bold text-[#173B70]">{activeTripsCount}</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F4F7FB] border border-[#E5EAF1] text-center">
                    <span className="text-[10px] font-semibold text-[#64748B] block">Completed Trips</span>
                    <strong className="text-base font-bold text-emerald-600">{completedTripsCount}</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F4F7FB] border border-[#E5EAF1] text-center">
                    <span className="text-[10px] font-semibold text-[#64748B] block">Direct UPI Rail</span>
                    <strong className="text-base font-bold text-[#1685D4]">100% Float-Free</strong>
                  </div>
                </div>
              </div>
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

      {/* Onboarding Journey Modal (Screens 3, 4, 5) */}
      <MultiStepOnboardingModal
        onOpenCreateTrip={() => setIsCreateTripOpen(true)}
        onOpenJoinTrip={() => setIsJoinTripOpen(true)}
      />

      {/* Create Trip Modal */}
      <CreateTripModal
        isOpen={isCreateTripOpen}
        onClose={() => setIsCreateTripOpen(false)}
        onCreate={handleCreateTrip}
      />

      {/* Join Trip Modal */}
      <JoinTripModal
        isOpen={isJoinTripOpen}
        onClose={() => setIsJoinTripOpen(false)}
        onJoinSuccess={(code) => {
          router.push(`/trips/trip-manali-2026?joined=${encodeURIComponent(code)}`);
        }}
      />

      {/* Merchant QR Modal */}
      <ScanMerchantQrModal
        isOpen={isScanMerchantOpen}
        onClose={() => setIsScanMerchantOpen(false)}
        onSelectVendor={handleSelectVendor}
      />

      {/* AI OCR Bill Scan Modal */}
      <AiBillScanModal
        isOpen={isAiBillScanOpen}
        onClose={() => setIsAiBillScanOpen(false)}
        tripMembers={trips[0]?.members || defaultMembers}
        onApplySplit={(bill: BillData) => {
          toast.success(`OCR Extracted: ₹${bill.totalAmount} from ${bill.merchantName || 'Merchant'}!`);
          setIsAiBillScanOpen(false);
          if (trips.length > 0) {
            router.push(
              `/trips/${trips[0].id}?tab=split&vendor=${encodeURIComponent(
                bill.merchantName || 'Merchant'
              )}&am=${bill.totalAmount}`
            );
          }
        }}
      />
    </div>
  );
}
