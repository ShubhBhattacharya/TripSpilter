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
import { defaultMembers, mockTrips } from '../../../data/mockData';
import { BookingVaultItem, Trip } from '../../../types/trip';
import { Loader2, MapPinOff, ArrowLeft } from 'lucide-react';
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

      // In production with Supabase configured, query the database first
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
            .maybeSingle();

          if (dbTrip && !error) {
            interface DbTripMember {
              profiles?: {
                id?: string;
                display_name?: string;
                full_name?: string;
                upi_id?: string;
                avatar_url?: string;
              };
            }

            interface DbItineraryItem {
              id: string;
              day_number: number;
              time: string;
              title: string;
              type?: string;
              location_url?: string;
              estimated_cost?: number;
              is_completed?: boolean;
            }

            interface DbBooking {
              id: string;
              title: string;
              category?: string;
              vendor_name?: string;
              booking_ref: string;
              amount?: number;
              status?: string;
            }

            const rawMembers = (dbTrip.trip_members || []) as unknown as DbTripMember[];
            const mappedMembers = rawMembers.map((m) => ({
              id: m.profiles?.id || 'usr_unknown',
              name: m.profiles?.display_name || m.profiles?.full_name || 'Member',
              upiId: m.profiles?.upi_id || 'member@upi',
              avatar:
                m.profiles?.avatar_url ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
            }));

            const rawItinerary = (dbTrip.itinerary_items || []) as unknown as DbItineraryItem[];
            const rawBookings = (dbTrip.bookings || []) as unknown as DbBooking[];

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
              itinerary: rawItinerary.map((it) => ({
                id: it.id,
                day: it.day_number,
                time: it.time,
                title: it.title,
                location: dbTrip.destination,
                category: (it.type as 'Transport' | 'Stay' | 'Food' | 'Activity' | 'Sightseeing') || 'Activity',
                mapsUrl: it.location_url || 'https://maps.google.com',
                estimatedCost: Number(it.estimated_cost) || 0,
                isCompleted: it.is_completed || false,
              })),
              polls: [],
              bookings: rawBookings.map((b) => ({
                id: b.id,
                title: b.title,
                category: (b.category as BookingVaultItem['category']) || 'Hotel',
                vendorName: b.vendor_name || 'Vendor',
                bookingRef: b.booking_ref,
                date: dbTrip.start_date,
                totalAmount: Number(b.amount) || 0,
                bookedBy: 'Admin',
                status: (b.status as BookingVaultItem['status']) || 'Confirmed',
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
          // fallback to localStorage or mock
        }
      }

      // Check localStorage for user-created custom trips (e.g. from 3D experience)
      interface LocalCustomSpot {
        name?: string;
        cost?: number;
      }
      interface LocalCustomTrip {
        id?: string;
        name?: string;
        destination?: string;
        coverImage?: string;
        startDate?: string;
        endDate?: string;
        totalBudget?: number;
        members?: typeof defaultMembers;
        spots?: LocalCustomSpot[];
      }
      try {
        const rawLocalTrips = typeof window !== 'undefined' ? localStorage.getItem('tripsplit_custom_trips') : null;
        if (rawLocalTrips) {
          const parsed = JSON.parse(rawLocalTrips) as LocalCustomTrip[];
          if (Array.isArray(parsed)) {
            const foundIdx = parsed.findIndex(
              (ct, idx) => ct.id === tripId || `local-3d-${idx}` === tripId
            );
            if (foundIdx !== -1) {
              const ct = parsed[foundIdx];
              const localMembers = Array.isArray(ct.members) && ct.members.length > 0 ? ct.members : defaultMembers;
              const mappedTrip: Trip = {
                id: tripId,
                title: ct.name || `${ct.destination || 'Trip'} 3D Outing`,
                tagline: `Interactive 3D itinerary for ${ct.destination || 'India'}`,
                destination: ct.destination || 'India',
                coverImage:
                  ct.coverImage ||
                  'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=1200&q=80',
                startDate: ct.startDate || new Date().toISOString().split('T')[0],
                endDate: ct.endDate || new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
                budget: Number(ct.totalBudget) || 0,
                totalSpend: 0,
                status: 'ACTIVE',
                members: localMembers,
                itinerary: (ct.spots || []).map((s, sIdx) => ({
                  id: `itin-${sIdx}`,
                  day: 1,
                  time: '10:00 AM',
                  title: s.name || 'Tour Spot',
                  category: 'Activity',
                  estimatedCost: Number(s.cost) || 0,
                  location: ct.destination || 'India',
                  mapsUrl: `https://maps.google.com/?q=${encodeURIComponent(ct.destination || 'India')}`,
                  notes: 'Saved from 3D Virtual Tour',
                })),
                polls: [],
                bookings: [],
                vendorSplits: [],
                debts: [],
              };
              if (isMounted) {
                setTrip(mappedTrip);
                setIsDbLoading(false);
              }
              return;
            }
          }
        }
      } catch {
        // ignore
      }

      // Check if it's a known demo trip (e.g. trip-manali-2026 or trip-1)
      const foundMock = mockTrips.find((m) => m.id === tripId);
      if (foundMock && isMounted) {
        setTrip(foundMock);
        setIsDbLoading(false);
        return;
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
