'use client';

import React, { useState, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  Compass,
  Heart,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowRight,
  BookOpen,
  Luggage,
  TrendingUp,
} from 'lucide-react';
import { DESTINATIONS } from '../../data/destinations';
import {
  HANDPICKED_COLLECTIONS,
  HIDDEN_WONDER_IDS,
  resolveCollectionDestinations,
} from '../../data/travelCatalog';

interface DestinationCollectionsProps {
  isWishlisted: (id: string) => boolean;
  onToggleWishlist: (id: string) => void;
}

const REGION_FILTERS = ['All', 'North', 'South', 'West', 'East', 'Central', 'Northeast'] as const;
type RegionTab = (typeof REGION_FILTERS)[number];

export const DestinationCollections: React.FC<DestinationCollectionsProps> = ({
  isWishlisted,
  onToggleWishlist,
}) => {
  const [selectedCollectionId, setSelectedCollectionId] = useState(HANDPICKED_COLLECTIONS[0].id);
  const [hiddenRegion, setHiddenRegion] = useState<RegionTab>('All');
  const railRef = useRef<HTMLDivElement | null>(null);

  const activeCollection =
    HANDPICKED_COLLECTIONS.find((c) => c.id === selectedCollectionId) || HANDPICKED_COLLECTIONS[0];

  const collectionDestinations = useMemo(
    () => resolveCollectionDestinations(activeCollection.destinationIds),
    [activeCollection.destinationIds]
  );

  const hiddenWonders = useMemo(() => {
    const base = DESTINATIONS.filter(
      (d) =>
        HIDDEN_WONDER_IDS.has(d.id) ||
        d.region === 'Northeast' ||
        d.region === 'Central' ||
        d.region === 'East'
    );
    const filtered =
      hiddenRegion === 'All' ? base : DESTINATIONS.filter((d) => d.region === hiddenRegion);
    return (filtered.length > 0 ? filtered : DESTINATIONS).slice(0, 8);
  }, [hiddenRegion]);

  const trendingDestinations = useMemo(() => DESTINATIONS.slice(0, 8), []);
  const packageDestinations = useMemo(
    () => resolveCollectionDestinations(['manali', 'goa', 'udaipur', 'munnar', 'rishikesh', 'jaipur']),
    []
  );

  const scrollRail = (dir: 'left' | 'right') => {
    if (!railRef.current) return;
    railRef.current.scrollBy({
      left: dir === 'left' ? -360 : 360,
      behavior: 'smooth',
    });
  };

  return (
    <div className="space-y-8">
      {/* 6. Handpicked Collections for You */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl border border-[#E5EAF1] shadow-sm p-5 sm:p-7 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#172B4D] flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#1666F2]" />
                <span>Handpicked Collections for You</span>
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">{activeCollection.subtitle}</p>
            </div>

            <div className="flex items-center gap-2 self-end lg:self-auto">
              <button
                type="button"
                onClick={() => scrollRail('left')}
                aria-label="Scroll collections left"
                className="w-9 h-9 rounded-full border border-[#DCE4EF] bg-white hover:bg-[#F4F7FB] flex items-center justify-center text-[#172B4D] cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollRail('right')}
                aria-label="Scroll collections right"
                className="w-9 h-9 rounded-full border border-[#DCE4EF] bg-white hover:bg-[#F4F7FB] flex items-center justify-center text-[#172B4D] cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {HANDPICKED_COLLECTIONS.map((col) => {
              const active = col.id === selectedCollectionId;
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => setSelectedCollectionId(col.id)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    active
                      ? 'bg-[#173B70] text-white shadow-xs'
                      : 'bg-[#F4F7FB] text-[#475569] hover:text-[#172B4D]'
                  }`}
                >
                  {col.label}
                </button>
              );
            })}
          </div>

          {/* Carousel Cards */}
          <div ref={railRef} className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth">
            {collectionDestinations.map((dest) => {
              const saved = isWishlisted(dest.id);
              return (
                <article
                  key={dest.id}
                  className="min-w-[250px] sm:min-w-[270px] max-w-[280px] snap-start group relative rounded-2xl overflow-hidden shadow-sm border border-[#E5EAF1] bg-slate-900 shrink-0 h-80 flex flex-col justify-end"
                >
                  <img
                    src={dest.heroImage}
                    alt={dest.name}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-transparent" />

                  <button
                    type="button"
                    onClick={() => onToggleWishlist(dest.id)}
                    aria-label={`Bookmark ${dest.name}`}
                    className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-sm cursor-pointer"
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        saved ? 'text-rose-500 fill-rose-500' : 'text-slate-700'
                      }`}
                    />
                  </button>

                  <span className="absolute top-3 left-3 z-10 px-2.5 py-0.5 rounded-full bg-black/55 backdrop-blur-xs text-white text-[10px] font-bold">
                    {dest.region} India
                  </span>

                  <div className="relative z-10 p-4 text-white space-y-2">
                    <div>
                      <h3 className="text-base font-extrabold leading-tight">{dest.name}</h3>
                      <p className="text-[11px] text-slate-200 line-clamp-2 mt-1">{dest.tagline}</p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-white/15 gap-2">
                      <span className="text-[11px] font-bold text-sky-200 num-inr leading-tight">
                        Est. ₹{dest.startingPrice.toLocaleString('en-IN')}/day
                        <span className="block text-[9px] font-medium text-sky-100/80">
                          Indicative estimate (reviewed 2026-11-27)
                        </span>
                      </span>
                      <Link
                        href={`/destinations/${dest.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white text-[#173B70] text-[11px] font-extrabold hover:bg-sky-50"
                      >
                        Explore <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* 7. Explore the Hidden Wonders of India */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#172B4D] to-[#11335E] text-white p-5 sm:p-8 shadow-lg space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-cyan-300">
                Offbeat &amp; Lesser-Known India
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                Unlock Lesser-Known Wonders of India
              </h2>
              <p className="text-xs text-slate-300 max-w-2xl">
                Filter across all 6 regions of India and inspect authentic attraction breakdowns, weather telemetry, and 360° city views.
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {REGION_FILTERS.map((region) => {
                const active = hiddenRegion === region;
                return (
                  <button
                    key={region}
                    type="button"
                    data-testid={`hidden-region-${region.toLowerCase()}`}
                    onClick={() => setHiddenRegion(region)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      active
                        ? 'bg-cyan-400 text-slate-950'
                        : 'bg-white/10 text-slate-200 hover:bg-white/20'
                    }`}
                  >
                    {region === 'All' ? 'All India' : `${region} India`}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {hiddenWonders.map((dest) => (
              <Link
                key={dest.id}
                href={`/destinations/${dest.id}`}
                data-testid={`hidden-card-${dest.id}`}
                className="group rounded-2xl overflow-hidden border border-white/15 bg-white/5 hover:bg-white/10 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="h-40 overflow-hidden bg-slate-800 relative">
                    <img
                      src={dest.heroImage}
                      alt={dest.name}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-[10px] font-bold text-cyan-200">
                      {dest.state}
                    </span>
                  </div>
                  <div className="p-4 space-y-1.5">
                    <h3 className="text-sm font-extrabold text-white truncate">{dest.name}</h3>
                    <p className="text-[11px] text-slate-300 line-clamp-2">{dest.tagline}</p>
                  </div>
                </div>
                <div className="px-4 py-2.5 border-t border-white/10 flex items-center justify-between text-[11px] font-bold text-cyan-300">
                  <span>{dest.spots.length} Attractions</span>
                  <span className="inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    Open Guide <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Trending Destinations */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-extrabold text-[#172B4D] flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#1666F2]" />
              <span>Trending Indian Destinations</span>
            </h2>
            <p className="text-xs text-[#64748B]">Most-explored destinations across TripSplit’s 60-city index</p>
          </div>
          <Link href="/explore" className="text-xs font-extrabold text-[#1666F2] hover:underline">
            Explore All 60 Cities →
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {trendingDestinations.map((dest) => (
            <Link
              key={dest.id}
              href={`/destinations/${dest.id}`}
              className="group rounded-2xl bg-white border border-[#E5EAF1] p-3 flex items-center gap-3 hover:shadow-md transition-all"
            >
              <img
                src={dest.heroImage}
                alt={dest.name}
                loading="lazy"
                className="w-14 h-14 rounded-xl object-cover shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-[#172B4D] truncate group-hover:text-[#1666F2]">
                  {dest.name.split(',')[0]}
                </p>
                <p className="text-[10px] text-[#64748B] truncate">{dest.state}</p>
                <p className="text-[10px] font-bold text-emerald-700 num-inr mt-0.5">
                  ₹{dest.startingPrice.toLocaleString('en-IN')}/day
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 9. Curated Holiday Packages & 10. Travel Inspiration Guides */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Holiday Packages (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-3xl border border-[#E5EAF1] shadow-xs p-5 sm:p-7 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-[#172B4D] flex items-center gap-2">
                <Luggage className="w-5 h-5 text-[#1666F2]" />
                <span>3-Day Group Itinerary Baselines</span>
              </h2>
              <p className="text-xs text-[#64748B]">
                Calculated directly from curated destination activity costs (excl. variable transport).
              </p>
            </div>
            <Link href="/ai-assistant" className="text-xs font-extrabold text-[#1666F2] hover:underline">
              Customize with AI →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            {packageDestinations.map((dest) => {
              const spotTotal = dest.spots.reduce((sum, s) => sum + s.cost, 0);
              const threeDayEstimate = dest.startingPrice * 3 + spotTotal;
              return (
                <Link
                  key={dest.id}
                  href={`/destinations/${dest.id}`}
                  className="rounded-2xl border border-[#E5EAF1] bg-[#FAFCFF] hover:bg-white hover:shadow-md transition-all p-3.5 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      3D / 2N Catalog Plan
                    </span>
                    <h3 className="text-sm font-extrabold text-[#172B4D]">
                      {dest.name.split(',')[0]} Explorer
                    </h3>
                    <p className="text-[11px] text-[#64748B] flex items-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      {dest.spots.map((s) => s.name.split(' ')[0]).slice(0, 3).join(', ')}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-[#E5EAF1] flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-[#173B70] num-inr leading-tight">
                      Est. ₹{threeDayEstimate.toLocaleString('en-IN')}/pax
                      <span className="block text-[9px] font-semibold text-[#64748B]">
                        Indicative estimate (reviewed 2026-11-27)
                      </span>
                    </span>
                    <span className="text-[11px] font-bold text-[#1666F2] shrink-0">Inspect →</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Travel Inspiration & Guides (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-3xl border border-[#E5EAF1] shadow-xs p-5 sm:p-7 space-y-4">
          <h2 className="text-lg font-extrabold text-[#172B4D] flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            <span>Travel Inspiration &amp; Guides</span>
          </h2>
          <div className="space-y-2.5 text-xs">
            <Link
              href="/3d-experience"
              className="block p-3 rounded-2xl bg-[#F8FAFC] border border-[#E5EAF1] hover:border-[#1666F2] transition-colors"
            >
              <p className="font-bold text-[#172B4D] flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-[#1666F2]" /> Hindi &amp; English 360° Narrated Guide
              </p>
              <p className="text-[11px] text-[#64748B] mt-0.5">
                Preview landmarks interactively before visiting.
              </p>
            </Link>
            <Link
              href="/qr-split"
              className="block p-3 rounded-2xl bg-[#F8FAFC] border border-[#E5EAF1] hover:border-[#1666F2] transition-colors"
            >
              <p className="font-bold text-[#172B4D]">Direct-to-Vendor Group Split Guide</p>
              <p className="text-[11px] text-[#64748B] mt-0.5">
                Split hotel or dinner bills equally, by %, or exact paise via UPI.
              </p>
            </Link>
            <Link
              href="/ai-assistant"
              className="block p-3 rounded-2xl bg-[#F8FAFC] border border-[#E5EAF1] hover:border-[#1666F2] transition-colors"
            >
              <p className="font-bold text-[#172B4D]">Ask AI Agent (Hindi / Hinglish / EN)</p>
              <p className="text-[11px] text-[#64748B] mt-0.5">
                Build day plans, check live weather &amp; USD→INR FX conversion.
              </p>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
