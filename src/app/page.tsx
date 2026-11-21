'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '../components/layout/Sidebar';
import { BottomNav } from '../components/layout/BottomNav';
import { TopHeader } from '../components/layout/TopHeader';
import { SummaryCards } from '../components/dashboard/SummaryCards';
import { QuickActionBar } from '../components/dashboard/QuickActionBar';
import { TripCard } from '../components/dashboard/TripCard';
import { RecentActivity } from '../components/dashboard/RecentActivity';
import { CreateTripModal } from '../components/modals/CreateTripModal';
import { ScanMerchantQrModal } from '../components/modals/ScanMerchantQrModal';
import { AiBillScanModal } from '../components/modals/AiBillScanModal';
import {
  mockTrips,
  userSummaryStats,
  defaultMembers,
} from '../data/mockData';
import { Trip } from '../types/trip';
import { Compass, ShieldCheck, Zap } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>(mockTrips);
  const [isCreateTripOpen, setIsCreateTripOpen] = useState(false);
  const [isScanMerchantOpen, setIsScanMerchantOpen] = useState(false);
  const [isAiBillScanOpen, setIsAiBillScanOpen] = useState(false);

  // Handle new trip creation
  const handleCreateTrip = (tripData: {
    title: string;
    destination: string;
    startDate: string;
    endDate: string;
    budget: number;
  }) => {
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

    setTrips([newTrip, ...trips]);
    router.push(`/trips/${newTrip.id}`);
  };

  const handleVendorDetected = () => {
    router.push(`/trips/trip-manali-2026?tab=split`);
  };

  const handleAiBillApplied = () => {
    router.push(`/trips/trip-manali-2026?tab=split`);
  };

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-12">
        <TopHeader onScanClick={() => setIsScanMerchantOpen(true)} />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto w-full space-y-6">
          {/* Welcome Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5" />
                  Direct UPI Architecture
                </span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
                  India First
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Namaste, Aarav 👋
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Manage your Manali outing, bookings vault & direct-to-vendor UPI bill splits.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Zero Escrow Risk</span>
              </span>
            </div>
          </div>

          {/* Top Summary Cards */}
          <SummaryCards
            totalSpend={userSummaryStats.totalSpend}
            youOwe={userSummaryStats.youOwe}
            youAreOwed={userSummaryStats.youAreOwed}
          />

          {/* Quick Action Bar */}
          <QuickActionBar
            onCreateTrip={() => setIsCreateTripOpen(true)}
            onScanMerchant={() => setIsScanMerchantOpen(true)}
            onScanBillAi={() => setIsAiBillScanOpen(true)}
          />

          {/* Active Trips & Outings Grid */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Compass className="w-5 h-5 text-emerald-400" />
                  Your Trips & Outings
                </h2>
                <p className="text-xs text-slate-400">
                  Select a trip to access itinerary, bookings vault, and live QR splitting
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsCreateTripOpen(true)}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                + New Outing
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {trips.map((trip) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </div>
          </div>

          {/* Real-time Activity Stream */}
          <div className="pt-2">
            <RecentActivity />
          </div>
        </main>
      </div>

      {/* Mobile Sticky Navigation */}
      <BottomNav onOpenQuickSplit={() => setIsScanMerchantOpen(true)} />

      {/* Modals */}
      <CreateTripModal
        isOpen={isCreateTripOpen}
        onClose={() => setIsCreateTripOpen(false)}
        onCreate={handleCreateTrip}
      />

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
