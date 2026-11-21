'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '../../../components/layout/Sidebar';
import { BottomNav } from '../../../components/layout/BottomNav';
import { TopHeader } from '../../../components/layout/TopHeader';
import { TripHeader } from '../../../components/trips/TripHeader';
import { ItineraryTab } from '../../../components/trips/ItineraryTab';
import { BookingsVaultTab } from '../../../components/trips/BookingsVaultTab';
import { VendorSplitTab } from '../../../components/trips/VendorSplitTab';
import { BalancesTab } from '../../../components/trips/BalancesTab';
import { ScanMerchantQrModal } from '../../../components/modals/ScanMerchantQrModal';
import { AiBillScanModal } from '../../../components/modals/AiBillScanModal';
import { mockTrips, defaultMembers } from '../../../data/mockData';
import { BookingVaultItem, Trip } from '../../../types/trip';
import { Loader2, MapPinOff, ArrowLeft, PlusCircle } from 'lucide-react';
import { createClient, isSupabaseConfigured } from '../../../lib/supabase/client';

function TripWorkspaceContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const tripId = (params?.id as string) || '';
  const [trip, setTrip] = useState<Trip | null | undefined>(undefined); // undefined = loading, null = not found
  const [isDbLoading, setIsDbLoading] = useState(true);

  // Tab state
  const activeTab = searchParams.get('tab') || 'itinerary';

  // Split state overrides (e.g. from booking split or scanner)
  const [splitVendorName, setSplitVendorName] = useState<string>('Cafe 1947 Manali');
  const [splitVendorUpi, setSplitVendorUpi] = useState<string>('cafe1947@okicici');
  const [splitAmount, setSplitAmount] = useState<number>(4000);

  // Modals state
  const [isScanMerchantOpen, setIsScanMerchantOpen] = useState(false);
  const [isAiBillScanOpen, setIsAiBillScanOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadTrip() {
      if (!tripId) {
        if (isMounted) {
          setTrip(null);
          setIsDbLoading(false);
        }
        return;
      }

      // 1. Check local mock trips and user-created custom trips first
      const foundMock = mockTrips.find((t) => t.id === tripId);
      if (foundMock) {
        if (isMounted) {
          setTrip(foundMock);
          setIsDbLoading(false);
        }
        return;
      }

      try {
        const storedCustom: Trip[] = JSON.parse(localStorage.getItem('tripsplit_custom_trips') || '[]');
        const foundCustom = storedCustom.find((t) => t.id === tripId);
        if (foundCustom) {
          if (isMounted) {
            setTrip(foundCustom);
            setIsDbLoading(false);
          }
          return;
        }
      } catch {
        // storage fallback
      }

      // 2. Query Supabase database if configured
      if (isSupabaseConfigured) {
        try {
          const supabase = createClient();
          const { data: dbTrip, error } = await supabase
            .from('trips')
            .select(`
              *,
              trip_members (
                role,
                profiles (*)
              ),
              itinerary_items (*),
              bookings (*)
            `)
            .eq('id', tripId)
            .single();

          if (dbTrip && !error) {
            const mappedMembers = (dbTrip.trip_members || []).map((m: any) => ({
              id: m.profiles?.id || 'usr_unknown',
              name: m.profiles?.display_name || m.profiles?.full_name || 'Member',
              upiId: m.profiles?.upi_id || 'member@upi',
              avatar:
                m.profiles?.avatar_url ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
            }));

            const mappedTrip: Trip = {
              id: dbTrip.id,
              title: dbTrip.title,
              tagline: `Exploring ${dbTrip.destination}`,
              destination: dbTrip.destination,
              coverImage:
                dbTrip.cover_image ||
                'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=1200&q=80',
              startDate: dbTrip.start_date,
              endDate: dbTrip.end_date,
              budget: Number(dbTrip.budget) || 0,
              totalSpend: 0,
              status: dbTrip.status || 'ACTIVE',
              members: mappedMembers.length > 0 ? mappedMembers : defaultMembers,
              itinerary: (dbTrip.itinerary_items || []).map((it: any) => ({
                id: it.id,
                day: it.day_number,
                time: it.time,
                title: it.title,
                location: dbTrip.destination,
                category: it.type || 'Activity',
                mapsUrl: it.location_url || 'https://maps.google.com',
                estimatedCost: Number(it.estimated_cost) || 0,
                isCompleted: it.is_completed,
              })),
              polls: [],
              bookings: (dbTrip.bookings || []).map((b: any) => ({
                id: b.id,
                title: b.title,
                category: b.category || 'Hotel',
                vendorName: b.vendor_name || 'Vendor',
                bookingRef: b.booking_ref,
                date: dbTrip.start_date,
                totalAmount: Number(b.amount) || 0,
                bookedBy: 'Admin',
                status: b.status || 'Confirmed',
                documentType: 'PDF',
              })),
              vendorSplits: [],
              debts: [],
            };

            if (isMounted) {
              setTrip(mappedTrip);
              setIsDbLoading(false);
            }
            return;
          }
        } catch {
          // fallback to not found
        }
      }

      // Not found anywhere
      if (isMounted) {
        setTrip(null);
        setIsDbLoading(false);
      }
    }

    loadTrip();

    return () => {
      isMounted = false;
    };
  }, [tripId]);

  const handleTabChange = (tab: string) => {
    if (trip) {
      router.replace(`/trips/${trip.id}?tab=${tab}`, { scroll: false });
    }
  };

  const handleSplitBooking = (booking: BookingVaultItem) => {
    setSplitVendorName(booking.vendorName);
    setSplitVendorUpi(
      booking.category === 'Hotel'
        ? 'zostel.manali@hdfcbank'
        : booking.category === 'Bus'
        ? 'zingbus.manali@icici'
        : 'cafe1947@okicici'
    );
    setSplitAmount(booking.totalAmount);
    handleTabChange('split');
  };

  const handleVendorDetected = (vendor: { name: string; upiId: string; amount?: number }) => {
    setSplitVendorName(vendor.name);
    setSplitVendorUpi(vendor.upiId);
    if (vendor.amount) setSplitAmount(vendor.amount);
    handleTabChange('split');
  };

  const handleAiBillApplied = (billData: {
    merchantName: string;
    totalAmount: number;
    items: { name: string; price: number }[];
  }) => {
    setSplitVendorName(billData.merchantName);
    setSplitAmount(billData.totalAmount);
    handleTabChange('split');
  };

  if (isDbLoading) {
    return (
      <div className="min-h-screen bg-[#F4F7FB] text-[#172B4D] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#1685D4] animate-spin mb-3" />
        <p className="text-sm font-semibold text-[#64748B]">Loading Trip Details...</p>
      </div>
    );
  }

  // Explicit 404 State when Trip Not Found (No Silent Fallback to mockTrips[0])
  if (!trip) {
    return (
      <div className="min-h-screen bg-[#F4F7FB] text-[#172B4D] flex flex-col lg:flex-row">
        <Sidebar />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-xl bg-white border border-[#E5EAF1] text-[#DC3545] flex items-center justify-center mb-4 shadow-xs">
            <MapPinOff className="w-8 h-8" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#172B4D] mb-2">Trip Not Found</h2>
          <p className="text-xs sm:text-sm text-[#64748B] max-w-md mb-6 leading-relaxed">
            We couldn&apos;t find a trip matching ID <code className="text-[#173B70] font-mono bg-white px-1.5 py-0.5 rounded border border-[#E5EAF1]">&ldquo;{tripId}&rdquo;</code>. It may have been removed, or you might need to be invited by the trip organizer.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#173B70] hover:bg-[#1685D4] text-white font-medium text-xs shadow-xs transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </Link>
            <Link
              href="/trips/trip-manali-2026"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white hover:bg-slate-50 text-[#172B4D] border border-[#E5EAF1] font-medium text-xs transition-colors shadow-xs"
            >
              <span>Explore Manali Demo Trip</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-[#172B4D] flex flex-col lg:flex-row">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-12">
        <TopHeader
          title={trip.title}
          onScanClick={() => setIsScanMerchantOpen(true)}
        />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto w-full">
          <TripHeader
            trip={trip}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            onOpenSplit={() => handleTabChange('split')}
          />

          <div className="transition-all duration-200">
            {activeTab === 'itinerary' && (
              <ItineraryTab
                initialItinerary={trip.itinerary}
                initialPolls={trip.polls}
              />
            )}

            {activeTab === 'bookings' && (
              <BookingsVaultTab
                bookings={trip.bookings}
                onSplitBooking={handleSplitBooking}
              />
            )}

            {activeTab === 'split' && (
              <VendorSplitTab
                key={`${splitVendorUpi}-${splitAmount}`}
                members={trip.members}
                initialVendorName={splitVendorName}
                initialVendorUpiId={splitVendorUpi}
                initialAmount={splitAmount}
                onOpenAiScanner={() => setIsAiBillScanOpen(true)}
              />
            )}

            {activeTab === 'balances' && (
              <BalancesTab
                debts={trip.debts}
                members={trip.members}
              />
            )}
          </div>
        </main>
      </div>

      <BottomNav onOpenQuickSplit={() => handleTabChange('split')} />

      <ScanMerchantQrModal
        isOpen={isScanMerchantOpen}
        onClose={() => setIsScanMerchantOpen(false)}
        onSelectVendor={handleVendorDetected}
      />

      <AiBillScanModal
        isOpen={isAiBillScanOpen}
        onClose={() => setIsAiBillScanOpen(false)}
        onApplyBill={handleAiBillApplied}
      />
    </div>
  );
}

export default function TripWorkspacePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F4F7FB] flex items-center justify-center text-[#64748B]">
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#1685D4]" />
            <span className="text-sm font-medium">Loading TripSplit Workspace...</span>
          </div>
        </div>
      }
    >
      <TripWorkspaceContent />
    </Suspense>
  );
}
