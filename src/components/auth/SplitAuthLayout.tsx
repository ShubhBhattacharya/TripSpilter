'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { MapPin, Compass, ShieldCheck } from 'lucide-react';

interface HeroSlide {
  id: string;
  imageUrl: string;
  location: string;
  regionLabel: string;
  caption: string;
}

const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'manali',
    imageUrl: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=1400&q=85',
    location: 'Manali, Himachal Pradesh',
    regionLabel: 'Himalayan Retreats',
    caption: 'Snow-dusted pine valleys and alpine passes mapped in 360°.',
  },
  {
    id: 'udaipur',
    imageUrl: 'https://images.unsplash.com/photo-1589308078059-be1415eab4c3?auto=format&fit=crop&w=1400&q=85',
    location: 'Udaipur, Rajasthan',
    regionLabel: 'Lakes & Heritage',
    caption: 'Calm lakeside sunsets paired with effortless group expense splits.',
  },
  {
    id: 'goa',
    imageUrl: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1400&q=85',
    location: 'Goa Coastline, India',
    regionLabel: 'Coastal Escapes',
    caption: 'Direct-to-vendor UPI bill splitting for every stay, cafe, and cab.',
  },
  {
    id: 'himalayas',
    imageUrl: 'https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?auto=format&fit=crop&w=1400&q=85',
    location: 'Auli & Garhwal Peaks',
    regionLabel: 'Highland Trails',
    caption: 'Plan multi-day itineraries and track every rupee transparently.',
  },
];

interface SplitAuthLayoutProps {
  children: React.ReactNode;
}

export const TripSplitterLogoMark: React.FC<{ darkText?: boolean }> = ({ darkText = true }) => (
  <Link href="/" className="inline-flex items-center gap-2.5 group focus:outline-none">
    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#1666F2] via-[#173B70] to-[#0A9B78] text-white flex items-center justify-center shadow-md ring-1 ring-white/20 group-hover:scale-[1.03] transition-transform">
      <Compass className="w-5 h-5" />
    </div>
    <div className="flex flex-col leading-none">
      <span
        className={`font-extrabold text-lg sm:text-xl tracking-tight ${
          darkText ? 'text-[#172B4D]' : 'text-white'
        }`}
      >
        TripSplitter
      </span>
      <span
        className={`text-[10px] font-semibold tracking-wider uppercase mt-0.5 ${
          darkText ? 'text-[#64748B]' : 'text-sky-200/90'
        }`}
      >
        Travel & Group Finance
      </span>
    </div>
  </Link>
);

export const SplitAuthLayout: React.FC<SplitAuthLayoutProps> = ({ children }) => {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const currentSlide = HERO_SLIDES[activeSlide];

  return (
    <div className="min-h-screen w-full bg-white flex flex-col lg:flex-row overflow-x-hidden">
      {/* LEFT SECTION — TRAVEL HERO PANEL (~43% desktop width, compact header banner on mobile) */}
      <aside className="relative w-full lg:w-[43%] xl:w-[44%] h-60 sm:h-72 lg:h-screen lg:sticky lg:top-0 shrink-0 overflow-hidden bg-[#0F2749]">
        {/* Crossfading Destination Photography */}
        {HERO_SLIDES.map((slide, idx) => (
          <img
            key={slide.id}
            src={slide.imageUrl}
            alt={slide.location}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-out ${
              idx === activeSlide ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
            }`}
          />
        ))}

        {/* Deep Editorial Gradient Overlays for Contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#081529]/95 via-[#0E2444]/45 to-[#081529]/65" />
        <div className="hidden lg:block absolute inset-0 bg-gradient-to-r from-[#081529]/30 to-transparent" />

        {/* Overlay Content */}
        <div className="relative z-10 h-full flex flex-col justify-between p-5 sm:p-7 lg:p-10 text-white">
          {/* Top Brand Bar */}
          <div className="flex items-center justify-between gap-3">
            <TripSplitterLogoMark darkText={false} />
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold bg-white/12 backdrop-blur-md border border-white/20 px-3 py-1.5 rounded-full text-sky-100">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
              Zero-Escrow UPI Security
            </span>
          </div>

          {/* Mobile Compact Headline */}
          <div className="lg:hidden space-y-1 max-w-md pb-3">
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight leading-snug text-white drop-shadow-sm">
              Your Next Journey Starts Here.
            </h2>
            <p className="text-xs text-slate-200/95 line-clamp-2">
              Plan trips, explore 60+ destinations, and split expenses effortlessly.
            </p>
          </div>

          {/* Desktop Editorial Copy + Destination Location Footer */}
          <div className="hidden lg:flex flex-col space-y-6">
            <div className="space-y-3 max-w-md">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-widest uppercase text-sky-200 bg-white/10 backdrop-blur-md border border-white/15 px-3 py-1 rounded-full">
                {currentSlide.regionLabel}
              </span>
              <h2 className="text-3xl xl:text-4xl font-extrabold tracking-tight leading-[1.15] text-white">
                Your Next Journey Starts Here.
              </h2>
              <p className="text-sm xl:text-base text-slate-200 leading-relaxed">
                Plan trips, explore destinations, manage group expenses and travel smarter.
              </p>
            </div>

            {/* Active Destination Card Pill + Carousel Controls */}
            <div className="flex items-center justify-between gap-4 pt-4 border-t border-white/15">
              <div className="min-w-0">
                <p className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                  <MapPin className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                  {currentSlide.location}
                </p>
                <p className="text-[11px] text-slate-300 truncate mt-0.5">{currentSlide.caption}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0" aria-label="Destination slide controls">
                {HERO_SLIDES.map((slide, idx) => (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => setActiveSlide(idx)}
                    aria-label={`Show ${slide.location}`}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      idx === activeSlide ? 'w-6 bg-white' : 'w-2 bg-white/40 hover:bg-white/70'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* RIGHT SECTION — WHITE AUTHENTICATION PANEL (~56-57% desktop width) */}
      <main className="relative flex-1 bg-white rounded-t-3xl lg:rounded-none -mt-4 lg:mt-0 z-20 flex flex-col justify-center items-center px-5 py-8 sm:px-10 sm:py-10 lg:px-14 xl:px-20">
        <div className="w-full max-w-[440px]">{children}</div>
      </main>
    </div>
  );
};
