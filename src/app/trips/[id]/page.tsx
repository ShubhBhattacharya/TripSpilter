'use client';

import React, { useState, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
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
import { mockTrips } from '../../../data/mockData';
import { BookingVaultItem } from '../../../types/trip';
import { Loader2 } from 'lucide-react';

function TripWorkspaceContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const tripId = (params?.id as string) || 'trip-manali-2026';
  const trip = mockTrips.find((t) => t.id === tripId) || mockTrips[0];

  const activeTab = searchParams.get('tab') || 'itinerary';

  // Split state overrides (e.g. from booking split or scanner)
  const [splitVendorName, setSplitVendorName] = useState<string>('Cafe 1947 Manali');
  const [splitVendorUpi, setSplitVendorUpi] = useState<string>('cafe1947@okicici');
  const [splitAmount, setSplitAmount] = useState<number>(4000);

  // Modals state
  const [isScanMerchantOpen, setIsScanMerchantOpen] = useState(false);
  const [isAiBillScanOpen, setIsAiBillScanOpen] = useState(false);

  const handleTabChange = (tab: string) => {
    router.replace(`/trips/${trip.id}?tab=${tab}`, { scroll: false });
  };

  // Handler for "Split This Booking"
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

  // Handler for Merchant QR scan
  const handleVendorDetected = (vendor: { name: string; upiId: string; amount?: number }) => {
    setSplitVendorName(vendor.name);
    setSplitVendorUpi(vendor.upiId);
    if (vendor.amount) setSplitAmount(vendor.amount);
    handleTabChange('split');
  };

  // Handler for AI Bill Scan OCR
  const handleAiBillApplied = (billData: {
    merchantName: string;
    totalAmount: number;
    items: { name: string; price: number }[];
  }) => {
    setSplitVendorName(billData.merchantName);
    setSplitAmount(billData.totalAmount);
    handleTabChange('split');
  };

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 flex flex-col lg:flex-row">
      {/* Desktop Left Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-12">
        {/* Sticky Header */}
        <TopHeader
          title={trip.title}
          onScanClick={() => setIsScanMerchantOpen(true)}
        />

        {/* Page Container */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto w-full">
          {/* Trip Hero Header */}
          <TripHeader
            trip={trip}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            onOpenSplit={() => handleTabChange('split')}
          />

          {/* Active Tab Content */}
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

      {/* Mobile Sticky Bottom Nav */}
      <BottomNav onOpenQuickSplit={() => handleTabChange('split')} />

      {/* Modals */}
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
        <div className="min-h-screen bg-[#0B1120] flex items-center justify-center text-slate-400">
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
            <span className="text-sm font-medium">Loading TripSplit Workspace...</span>
          </div>
        </div>
      }
    >
      <TripWorkspaceContent />
    </Suspense>
  );
}
