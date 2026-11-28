'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Compass,
  Plane,
  Hotel,
  Home,
  Luggage,
  TrainFront,
  Bus,
  CarTaxiFront,
  MapPinned,
  ShieldCheck,
  ChevronDown,
  Heart,
  Bell,
  Briefcase,
  User,
  Menu,
  X,
  QrCode,
  Sparkles,
  LogOut,
  Wallet,
  Trash2,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import {
  PORTAL_NAV_CATEGORIES,
  type BookingCategoryId,
} from '../../data/travelCatalog';
import type { Destination } from '../../data/destinations';

interface TravelTopNavProps {
  activeCategory: BookingCategoryId;
  onSelectCategory: (cat: BookingCategoryId) => void;
  wishlistCount: number;
  wishlistDestinations: Destination[];
  onRemoveWishlist: (id: string) => void;
}

const CATEGORY_ICONS: Record<BookingCategoryId, React.ComponentType<{ className?: string }>> = {
  flights: Plane,
  hotels: Hotel,
  homestays: Home,
  packages: Luggage,
  trains: TrainFront,
  buses: Bus,
  cabs: CarTaxiFront,
  activities: MapPinned,
  insurance: ShieldCheck,
};

export const TravelTopNav: React.FC<TravelTopNavProps> = ({
  activeCategory,
  onSelectCategory,
  wishlistCount,
  wishlistDestinations,
  onRemoveWishlist,
}) => {
  const { user, profile, signOut } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAuthenticated = Boolean(user || (profile && profile.display_name));
  const displayName =
    profile?.display_name ||
    user?.user_metadata?.full_name ||
    (user?.email ? user.email.split('@')[0] : 'Traveler');

  const handleCategoryPick = (id: BookingCategoryId) => {
    onSelectCategory(id);
    setMobileMenuOpen(false);
    const panel = document.getElementById('booking-search-panel');
    if (panel) {
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  return (
    <>
      <header
        data-testid="travel-top-nav"
        className="sticky top-0 z-50 bg-[#0B1C36]/95 backdrop-blur-md text-white border-b border-white/10 shadow-md"
      >
        {/* Upper Brand + Global Actions Row */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          {/* Brand Mark */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#1666F2] via-[#1685D4] to-[#0A9B78] text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <Compass className="w-5 h-5" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-extrabold text-lg tracking-tight text-white">TripSplit</span>
              <span className="text-[10px] font-semibold tracking-wider uppercase text-sky-300/90 mt-0.5">
                Travel • Book • Split
              </span>
            </div>
          </Link>

          {/* Compact Desktop Quick Nav Links */}
          <div className="hidden lg:flex items-center gap-2 xl:gap-3 text-xs font-semibold">
            <Link
              href="/trips"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-white/10 transition-colors text-slate-100"
            >
              <Briefcase className="w-4 h-4 text-amber-300" />
              <div className="leading-tight">
                <span className="block font-bold">My Trips</span>
                <span className="block text-[10px] text-slate-300 font-normal">Manage outings</span>
              </div>
            </Link>

            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-white/10 transition-colors text-slate-100"
            >
              <Wallet className="w-4 h-4 text-emerald-300" />
              <div className="leading-tight">
                <span className="block font-bold">Expense HQ</span>
                <span className="block text-[10px] text-slate-300 font-normal">UPI splits &amp; settles</span>
              </div>
            </Link>

            <button
              type="button"
              onClick={() => setWishlistOpen(true)}
              data-testid="nav-wishlist-btn"
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-white/10 transition-colors text-slate-100 cursor-pointer"
            >
              <Heart className={`w-4 h-4 ${wishlistCount > 0 ? 'text-rose-400 fill-rose-400' : 'text-rose-300'}`} />
              <span>Wishlist</span>
              {wishlistCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold num-inr">
                  {wishlistCount}
                </span>
              )}
            </button>

            <Link
              href="/notifications"
              className="p-2 rounded-xl hover:bg-white/10 transition-colors text-slate-200"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
            </Link>

            {/* More Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreOpen((m) => !m)}
                onBlur={() => setTimeout(() => setMoreOpen(false), 180)}
                data-testid="nav-more-btn"
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl hover:bg-white/10 transition-colors text-slate-100 cursor-pointer"
              >
                <span>More</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {moreOpen && (
                <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-white text-[#172B4D] shadow-2xl border border-[#E5EAF1] py-2 z-50">
                  <Link href="/3d-experience" className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold hover:bg-[#F4F7FB]">
                    <Compass className="w-4 h-4 text-[#1666F2]" /> 3D Travel HQ (360°)
                  </Link>
                  <Link href="/ai-assistant" className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold hover:bg-[#F4F7FB]">
                    <Sparkles className="w-4 h-4 text-indigo-600" /> AI Travel Agent
                  </Link>
                  <Link href="/explore" className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold hover:bg-[#F4F7FB]">
                    <MapPinned className="w-4 h-4 text-emerald-600" /> Explore All Destinations
                  </Link>
                  <Link href="/qr-split" className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold hover:bg-[#F4F7FB]">
                    <QrCode className="w-4 h-4 text-[#173B70]" /> Direct Merchant QR Split
                  </Link>
                </div>
              )}
            </div>

            {/* Auth / Profile Control */}
            {!isAuthenticated ? (
              <Link
                href="/login"
                data-testid="nav-login-btn"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#1666F2] to-[#0EA5E9] hover:opacity-95 text-white font-bold shadow-sm transition-all"
              >
                <User className="w-3.5 h-3.5" />
                <span>Login / Create Account</span>
              </Link>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAccountOpen((a) => !a)}
                  onBlur={() => setTimeout(() => setAccountOpen(false), 180)}
                  className="inline-flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-white/12 hover:bg-white/20 border border-white/15 transition-colors cursor-pointer"
                >
                  <span className="w-7 h-7 rounded-full bg-[#1666F2] text-white text-xs font-extrabold flex items-center justify-center">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                  <span className="max-w-[100px] truncate text-xs font-bold">
                    Hi, {displayName.split(' ')[0]}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {accountOpen && (
                  <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-white text-[#172B4D] shadow-2xl border border-[#E5EAF1] py-2 z-50">
                    <Link href="/profile" className="flex items-center gap-2 px-4 py-2 text-xs font-semibold hover:bg-[#F4F7FB]">
                      <User className="w-4 h-4 text-[#1666F2]" /> Profile &amp; UPI Settings
                    </Link>
                    <Link href="/dashboard" className="flex items-center gap-2 px-4 py-2 text-xs font-semibold hover:bg-[#F4F7FB]">
                      <Wallet className="w-4 h-4 text-emerald-600" /> Expense Dashboard
                    </Link>
                    <Link href="/trips" className="flex items-center gap-2 px-4 py-2 text-xs font-semibold hover:bg-[#F4F7FB]">
                      <Briefcase className="w-4 h-4 text-[#173B70]" /> My Trips
                    </Link>
                    <div className="my-1 border-t border-[#E5EAF1]" />
                    <button
                      type="button"
                      onClick={() => signOut()}
                      className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile Actions & Menu Trigger */}
          <div className="flex lg:hidden items-center gap-2">
            <button
              type="button"
              onClick={() => setWishlistOpen(true)}
              aria-label="Wishlist"
              className="relative p-2 rounded-xl bg-white/10 text-white"
            >
              <Heart className={`w-4 h-4 ${wishlistCount > 0 ? 'fill-rose-400 text-rose-400' : ''}`} />
              {wishlistCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-[9px] font-bold flex items-center justify-center">
                  {wishlistCount}
                </span>
              )}
            </button>

            <Link
              href={isAuthenticated ? '/profile' : '/login'}
              className="px-3 py-1.5 rounded-xl bg-[#1666F2] text-white text-xs font-bold"
            >
              {isAuthenticated ? displayName.split(' ')[0] : 'Login'}
            </Link>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle Menu"
              className="p-2 rounded-xl bg-white/10 text-white"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Sticky Horizontal Booking Category Strip */}
        <nav
          aria-label="Travel Categories"
          className="bg-[#0F2342]/95 border-t border-white/10"
        >
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 flex items-center gap-1 overflow-x-auto no-scrollbar">
            {PORTAL_NAV_CATEGORIES.filter((cat) => cat.searchSupported).map((cat) => {
              const Icon = CATEGORY_ICONS[cat.id];
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  data-testid={`top-cat-${cat.id}`}
                  onClick={() => handleCategoryPick(cat.id)}
                  className={`relative shrink-0 flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'text-sky-300'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{cat.label}</span>
                  {cat.badge && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[9px] font-extrabold uppercase ${
                        cat.badge === 'Soon'
                          ? 'bg-amber-400/20 text-amber-200'
                          : 'bg-sky-400/20 text-sky-200'
                      }`}
                    >
                      {cat.badge}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-sky-400" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Mobile Expandable Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#0B1C36] border-t border-white/10 px-4 py-4 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
              <Link href="/trips" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2.5 rounded-xl bg-white/10 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-amber-300" /> My Trips
              </Link>
              <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2.5 rounded-xl bg-white/10 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-300" /> Expense HQ
              </Link>
              <Link href="/3d-experience" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2.5 rounded-xl bg-white/10 flex items-center gap-2">
                <Compass className="w-4 h-4 text-sky-300" /> 3D Travel HQ
              </Link>
              <Link href="/explore" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2.5 rounded-xl bg-white/10 flex items-center gap-2">
                <MapPinned className="w-4 h-4 text-indigo-300" /> 60 Destinations
              </Link>
              <Link href="/ai-assistant" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2.5 rounded-xl bg-white/10 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-300" /> AI Agent
              </Link>
              <Link href="/notifications" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2.5 rounded-xl bg-white/10 flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-200" /> Notifications
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Wishlist Slide-Over Drawer */}
      {wishlistOpen && (
        <div className="fixed inset-0 z-[90] bg-slate-950/50 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col text-[#172B4D]">
            <div className="px-5 py-4 border-b border-[#E5EAF1] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
                <h2 className="text-base font-extrabold">Saved Wishlist ({wishlistCount})</h2>
              </div>
              <button
                type="button"
                onClick={() => setWishlistOpen(false)}
                aria-label="Close Wishlist"
                className="p-1.5 rounded-lg hover:bg-slate-100 text-[#64748B] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {wishlistDestinations.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <Heart className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-sm font-bold text-[#172B4D]">Your travel wishlist is empty</p>
                  <p className="text-xs text-[#64748B]">
                    Tap the heart button on any destination card to bookmark places you want to visit next.
                  </p>
                </div>
              ) : (
                wishlistDestinations.map((dest) => (
                  <div
                    key={dest.id}
                    className="flex items-center gap-3 p-3 rounded-2xl border border-[#E5EAF1] bg-[#F8FAFC]"
                  >
                    <img
                      src={dest.heroImage}
                      alt={dest.name}
                      className="w-16 h-16 rounded-xl object-cover shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[#172B4D] truncate">{dest.name}</p>
                      <p className="text-[11px] text-[#64748B] truncate">
                        {dest.region} India • From ₹{dest.startingPrice.toLocaleString('en-IN')}/day
                      </p>
                      <Link
                        href={`/destinations/${dest.id}`}
                        onClick={() => setWishlistOpen(false)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1666F2] hover:underline mt-1"
                      >
                        View Destination <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveWishlist(dest.id)}
                      aria-label={`Remove ${dest.name} from wishlist`}
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
