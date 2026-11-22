'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Users, QrCode, FolderLock, Receipt } from 'lucide-react';

interface BottomNavProps {
  onOpenQuickSplit?: () => void;
  onScanClick?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ onOpenQuickSplit, onScanClick }) => {
  const pathname = usePathname();

  const isHome = pathname === '/';
  const isTrip = pathname.startsWith('/trips');

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-[#E5EAF1] px-3 pb-3 pt-2 shadow-md">
      <div className="flex items-center justify-around relative max-w-md mx-auto">
        {/* Dashboard */}
        <Link
          href="/"
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-colors ${
            isHome ? 'text-[#1685D4] font-semibold' : 'text-[#64748B] hover:text-[#172B4D]'
          }`}
        >
          <Compass className="w-5 h-5" />
          <span className="text-[10px]">Dashboard</span>
        </Link>

        {/* Trips */}
        <Link
          href="/trips/trip-manali-2026"
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-colors ${
            isTrip && !pathname.includes('tab=balances') && !pathname.includes('tab=bookings')
              ? 'text-[#1685D4] font-semibold'
              : 'text-[#64748B] hover:text-[#172B4D]'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px]">My Trip</span>
        </Link>

        {/* CENTER FLOATING ACTION BUTTON "+ Split" */}
        <div className="relative -top-4">
          <button
            type="button"
            onClick={onScanClick || onOpenQuickSplit}
            className="flex flex-col items-center justify-center w-13 h-13 rounded-full bg-[#173B70] text-white font-bold shadow-md hover:bg-[#1685D4] active:scale-95 transition-all ring-4 ring-white"
            aria-label="Direct UPI Split"
          >
            <QrCode className="w-6 h-6" />
          </button>
        </div>

        {/* Vault / Bookings */}
        <Link
          href="/trips/trip-manali-2026?tab=bookings"
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-colors ${
            pathname.includes('tab=bookings')
              ? 'text-[#1685D4] font-semibold'
              : 'text-[#64748B] hover:text-[#172B4D]'
          }`}
        >
          <FolderLock className="w-5 h-5" />
          <span className="text-[10px]">Vault</span>
        </Link>

        {/* Balances / Settle */}
        <Link
          href="/trips/trip-manali-2026?tab=balances"
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-colors ${
            pathname.includes('tab=balances')
              ? 'text-[#1685D4] font-semibold'
              : 'text-[#64748B] hover:text-[#172B4D]'
          }`}
        >
          <Receipt className="w-5 h-5" />
          <span className="text-[10px]">Settle</span>
        </Link>
      </div>
    </nav>
  );
};
