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
  Sparkles,
} from 'lucide-react';
import { currentUser } from '../../data/mockData';

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const [copiedUpi, setCopiedUpi] = useState(false);

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(currentUser.upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const navLinks = [
    {
      name: 'Dashboard',
      href: '/',
      icon: Compass,
      badge: null,
    },
    {
      name: 'Manali Trip',
      href: '/trips/trip-manali-2026',
      icon: Users,
      badge: 'Active',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    },
    {
      name: 'Direct QR Split',
      href: '/qr-split',
      icon: QrCode,
      badge: 'USP',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold',
    },
    {
      name: 'Bookings Vault',
      href: '/trips/trip-manali-2026?tab=bookings',
      icon: FolderLock,
      badge: '4 Vouchers',
      badgeColor: 'bg-slate-800 text-slate-400',
    },
    {
      name: 'Balances & Settle',
      href: '/trips/trip-manali-2026?tab=balances',
      icon: Receipt,
      badge: '₹1.2k Due',
      badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
    },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-64 border-r border-[#1F2937] bg-[#0B1120] shrink-0 sticky top-0 h-screen select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-[#1F2937]/80 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform duration-200">
            <span className="text-xl font-black text-slate-950">₹</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-lg tracking-tight text-white group-hover:text-emerald-400 transition-colors">
                TripSplit
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                UPI
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Split Direct to Vendor</p>
          </div>
        </Link>
      </div>

      {/* UPI Quick Action Banner */}
      <div className="mx-4 mt-4 p-3 rounded-xl bg-gradient-to-br from-[#111827] to-[#0d1527] border border-[#1F2937] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="flex items-center gap-1 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            Zero Float UPI
          </span>
          <span className="text-[10px] text-emerald-400 font-semibold">Instant ₹0 Fees</span>
        </div>
        <p className="text-xs text-slate-300 font-normal leading-relaxed">
          Pay vendors directly from your GPay / PhonePe / Paytm without pool accounts.
        </p>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold text-slate-300 uppercase tracking-wider">
          Menu
        </div>
        {navLinks.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href.includes('?') && pathname.startsWith(item.href.split('?')[0]));

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-[#111827] border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`}
                />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        <div className="pt-5 px-3 pb-2 text-[10px] font-semibold text-slate-300 uppercase tracking-wider">
          Quick Outings
        </div>
        <div className="space-y-1">
          <Link
            href="/trips/trip-manali-2026"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-[#111827] transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="truncate">Delhi to Manali Trip</span>
          </Link>
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-300 cursor-not-allowed">
            <span className="w-2 h-2 rounded-full bg-slate-600" />
            <span className="truncate">Goa Sun & Waves</span>
            <span className="ml-auto text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">Dec</span>
          </div>
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-300 cursor-not-allowed">
            <span className="w-2 h-2 rounded-full bg-slate-600" />
            <span className="truncate">Jaipur Weekend</span>
            <span className="ml-auto text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">Done</span>
          </div>
        </div>
      </nav>

      {/* User Profile & Saved UPI ID */}
      <div className="p-3 border-t border-[#1F2937] bg-[#0E1526]/70">
        <div className="p-2.5 rounded-xl bg-[#111827] border border-[#1F2937] hover:border-slate-700 transition-colors">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="relative">
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-9 h-9 rounded-full object-cover ring-2 ring-emerald-500/40"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#111827]" />
            </div>

            {/* Name & UPI ID */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{currentUser.name}</p>
              <button
                type="button"
                onClick={handleCopyUpi}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-emerald-400 transition-colors mt-0.5"
                title="Click to copy UPI ID"
              >
                <span className="truncate font-mono">{currentUser.upiId}</span>
                {copiedUpi ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                ) : (
                  <Copy className="w-3 h-3 text-slate-500 hover:text-slate-300 shrink-0" />
                )}
              </button>
            </div>
          </div>
          {copiedUpi && (
            <div className="mt-1 text-[10px] text-emerald-400 text-center font-medium bg-emerald-500/10 py-0.5 rounded">
              UPI ID copied!
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
