'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Users, QrCode, Globe, User } from 'lucide-react';

interface BottomNavProps {
  onOpenQuickSplit?: () => void;
  onScanClick?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ onOpenQuickSplit, onScanClick }) => {
  const pathname = usePathname();

  const isHome = pathname === '/';

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
          href="/trips"
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-colors ${
            pathname.startsWith('/trips')
              ? 'text-[#1685D4] font-semibold'
              : 'text-[#64748B] hover:text-[#172B4D]'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px]">My Trips</span>
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

        {/* Explore */}
        <Link
          href="/explore"
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-colors ${
            pathname.startsWith('/explore')
              ? 'text-[#1685D4] font-semibold'
              : 'text-[#64748B] hover:text-[#172B4D]'
          }`}
        >
          <Globe className="w-5 h-5" />
          <span className="text-[10px]">Explore</span>
        </Link>

        {/* Profile */}
        <Link
          href="/profile"
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-colors ${
            pathname.startsWith('/profile')
              ? 'text-[#1685D4] font-semibold'
              : 'text-[#64748B] hover:text-[#172B4D]'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px]">Profile</span>
        </Link>
      </div>
    </nav>
  );
};
