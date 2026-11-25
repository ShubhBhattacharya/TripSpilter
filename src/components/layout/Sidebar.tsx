'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Compass,
  QrCode,
  FolderLock,
  Users,
  CheckCircle2,
  Copy,
  Receipt,
  LogOut,
  Settings,
  ShieldCheck,
  Globe,
  Bell,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { user, profile, signOut, setShowOnboarding } = useAuth();
  const [copiedUpi, setCopiedUpi] = useState(false);

  const activeName =
    profile?.display_name ||
    user?.user_metadata?.full_name ||
    (user?.email ? user.email.split('@')[0] : 'Traveler');
  const activeUpi = profile?.upi_id || 'Setup UPI ID';
  const activeAvatar =
    profile?.avatar_url ||
    user?.user_metadata?.avatar_url ||
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80';

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(activeUpi);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const navLinks = [
    {
      name: 'Travel Home',
      href: '/',
      icon: Globe,
    },
    {
      name: 'Expense Dashboard',
      href: '/dashboard',
      icon: Compass,
    },
    {
      name: 'My Trips',
      href: '/trips',
      icon: Users,
    },
    {
      name: 'Explore Places',
      href: '/explore',
      icon: Globe,
    },
    {
      name: '3D Travel HQ',
      href: '/3d-experience',
      icon: Compass,
      badge: '360°',
    },
    {
      name: 'AI Companion',
      href: '/ai-assistant',
      icon: Sparkles,
    },
    {
      name: 'Direct QR Split',
      href: '/qr-split',
      icon: QrCode,
    },
    {
      name: 'Bookings Vault',
      href: '/trips/trip-manali-2026?tab=bookings',
      icon: FolderLock,
    },
    {
      name: 'Balances & Settle',
      href: '/trips/trip-manali-2026?tab=balances',
      icon: Receipt,
    },
    {
      name: 'Notifications',
      href: '/notifications',
      icon: Bell,
    },
    {
      name: 'Profile & Privacy',
      href: '/profile',
      icon: Settings,
    },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-64 border-r border-[#E5EAF1] bg-white shrink-0 sticky top-0 h-screen select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-[#E5EAF1] flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-[#173B70] text-white flex items-center justify-center font-bold text-lg shadow-sm group-hover:bg-[#1685D4] transition-colors">
            <span>₹</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg tracking-tight text-[#172B4D] group-hover:text-[#1685D4] transition-colors">
                TripSplit
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded bg-[#0A9B78]/10 text-[#0A9B78] border border-[#0A9B78]/20">
                UPI
              </span>
            </div>
            <p className="text-[11px] text-[#64748B]">Direct-to-Vendor Split</p>
          </div>
        </Link>
      </div>

      {/* Trust & Guarantee Banner */}
      <div className="mx-4 mt-4 p-3 rounded-xl bg-[#F4F7FB] border border-[#E5EAF1]">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#173B70] mb-1">
          <ShieldCheck className="w-4 h-4 text-[#0A9B78]" />
          <span>Zero Escrow Architecture</span>
        </div>
        <p className="text-[11px] text-[#64748B] leading-relaxed">
          Members pay the vendor directly from their UPI app. No pooling, zero fees.
        </p>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">
          Navigation
        </div>
        {navLinks.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href.split('?')[0]));

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-[#1685D4]/10 text-[#1685D4] font-semibold'
                  : 'text-[#64748B] hover:text-[#172B4D] hover:bg-[#F4F7FB]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 ${isActive ? 'text-[#1685D4]' : 'text-[#64748B]'}`}
                />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-sky-100 text-sky-700 border border-sky-200 uppercase tracking-tight">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        <div className="pt-5 px-3 pb-2 text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">
          Active Outings
        </div>
        <div className="space-y-1">
          <Link
            href="/trips/trip-manali-2026"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-[#172B4D] hover:bg-[#F4F7FB] transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-[#0A9B78]" />
            <span className="truncate font-medium">Delhi to Manali Trip</span>
          </Link>
        </div>
      </nav>

      {/* User Profile & Actions Footer */}
      <div className="p-3 border-t border-[#E5EAF1] bg-[#F4F7FB]/50">
        <div className="p-2.5 rounded-xl bg-white border border-[#E5EAF1] shadow-xs">
          <div className="flex items-center gap-2.5">
            {/* Avatar */}
            <div className="relative">
              <img
                src={activeAvatar}
                alt={activeName}
                className="w-9 h-9 rounded-full object-cover ring-1 ring-[#E5EAF1]"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#0A9B78] rounded-full border-2 border-white" />
            </div>

            {/* Name & UPI ID */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#172B4D] truncate">{activeName}</p>
              <button
                type="button"
                onClick={handleCopyUpi}
                className="flex items-center gap-1 text-[11px] text-[#64748B] hover:text-[#1685D4] transition-colors mt-0.5"
                title="Click to copy UPI ID"
              >
                <span className="truncate font-mono">{activeUpi}</span>
                {copiedUpi ? (
                  <CheckCircle2 className="w-3 h-3 text-[#0A9B78] shrink-0" />
                ) : (
                  <Copy className="w-3 h-3 text-[#64748B] shrink-0" />
                )}
              </button>
            </div>

            {/* Profile Settings & Sign Out */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowOnboarding(true)}
                className="p-1.5 rounded-lg text-[#64748B] hover:text-[#172B4D] hover:bg-[#F4F7FB] transition-colors"
                title="Edit Profile / UPI ID"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => signOut()}
                className="p-1.5 rounded-lg text-[#64748B] hover:text-[#DC3545] hover:bg-rose-50 transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {copiedUpi && (
            <div className="mt-1.5 text-[10px] text-[#0A9B78] text-center font-medium bg-[#0A9B78]/10 py-0.5 rounded">
              UPI ID copied to clipboard!
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
