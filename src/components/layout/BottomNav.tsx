'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Users, QrCode, FolderLock, Receipt } from 'lucide-react';

interface BottomNavProps {
  onOpenQuickSplit?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ onOpenQuickSplit }) => {
  const pathname = usePathname();

  const isHome = pathname === '/';
  const isTrip = pathname.startsWith('/trips');
  const isQrSplit = pathname === '/qr-split';

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0B1120]/95 backdrop-blur-xl border-t border-[#1F2937] px-3 pb-safe pt-2">
      <div className="flex items-center justify-around relative max-w-md mx-auto">
        {/* Dashboard */}
        <Link
          href="/"
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-colors ${
            isHome ? 'text-emerald-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Compass className="w-5 h-5" />
          <span className="text-[10px]">Home</span>
        </Link>

        {/* Trips */}
        <Link
          href="/trips/trip-manali-2026"
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-colors ${
            isTrip && !pathname.includes('tab=balances') && !pathname.includes('tab=bookings')
              ? 'text-emerald-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px]">Trip</span>
        </Link>

        {/* CENTER FLOATING ACTION BUTTON "+ Split" */}
        <div className="relative -top-4">
          <Link
            href="/qr-split"
            onClick={onOpenQuickSplit}
            className="flex flex-col items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 text-slate-950 font-bold shadow-xl shadow-emerald-500/30 hover:scale-105 active:scale-95 transition-all duration-150 ring-4 ring-[#0B1120]"
            aria-label="Direct UPI Split"
          >
            <QrCode className="w-6 h-6 stroke-[2.2]" />
            <span className="text-[9px] tracking-tight font-black uppercase mt-0.5">Split</span>
          </Link>
        </div>

        {/* Vault / Bookings */}
        <Link
          href="/trips/trip-manali-2026?tab=bookings"
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-colors ${
            pathname.includes('tab=bookings')
              ? 'text-emerald-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FolderLock className="w-5 h-5" />
          <span className="text-[10px]">Vault</span>
        </Link>

        {/* Balances / Settle */}
        <Link
          href="/trips/trip-manali-2026?tab=balances"
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-colors ${
            pathname.includes('tab=balances')
              ? 'text-emerald-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Receipt className="w-5 h-5" />
          <span className="text-[10px]">Settle</span>
        </Link>
      </div>
    </nav>
  );
};
