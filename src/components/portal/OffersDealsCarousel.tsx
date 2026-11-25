'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Tag,
  CheckCircle2,
  X,
  ArrowRight,
} from 'lucide-react';
import {
  PLATFORM_OFFERS,
  type OfferCategoryFilter,
  type PlatformOfferItem,
} from '../../data/travelCatalog';

const OFFER_TABS: Array<{ id: OfferCategoryFilter; label: string }> = [
  { id: 'all', label: 'All Offers' },
  { id: 'flights', label: 'Flights' },
  { id: 'hotels', label: 'Hotels' },
  { id: 'holidays', label: 'Holidays' },
  { id: 'trains', label: 'Trains' },
  { id: 'buses', label: 'Buses' },
  { id: 'packages', label: 'Packages' },
  { id: 'partners', label: 'Bank & Partner Info' },
];

export const OffersDealsCarousel: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<OfferCategoryFilter>('all');
  const [selectedOfferModal, setSelectedOfferModal] = useState<PlatformOfferItem | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);

  const visibleOffers =
    selectedTab === 'all'
      ? PLATFORM_OFFERS
      : PLATFORM_OFFERS.filter((o) => o.category === selectedTab);

  const scrollRail = (dir: 'left' | 'right') => {
    if (!railRef.current) return;
    railRef.current.scrollBy({
      left: dir === 'left' ? -380 : 380,
      behavior: 'smooth',
    });
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="bg-white rounded-3xl border border-[#E5EAF1] shadow-sm p-5 sm:p-7 space-y-5">
        {/* Section Header + Category Tabs + Arrows */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E5EAF1] pb-4">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#172B4D] flex items-center gap-2 shrink-0">
              <Tag className="w-5 h-5 text-[#1666F2]" />
              <span>Offers &amp; Programs</span>
            </h2>

            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {OFFER_TABS.map((tab) => {
                const active = selectedTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    data-testid={`offer-tab-${tab.id}`}
                    onClick={() => setSelectedTab(tab.id)}
                    className={`relative shrink-0 px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      active ? 'text-[#1666F2]' : 'text-[#64748B] hover:text-[#172B4D]'
                    }`}
                  >
                    {tab.label}
                    {active && (
                      <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-[#1666F2]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 self-end lg:self-auto shrink-0">
            <button
              type="button"
              onClick={() => scrollRail('left')}
              aria-label="Previous offers"
              className="w-9 h-9 rounded-full border border-[#DCE4EF] bg-white hover:bg-[#F4F7FB] flex items-center justify-center text-[#172B4D] transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollRail('right')}
              aria-label="Next offers"
              className="w-9 h-9 rounded-full border border-[#DCE4EF] bg-white hover:bg-[#F4F7FB] flex items-center justify-center text-[#172B4D] transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Horizontal Cards Carousel */}
        <div
          ref={railRef}
          className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth"
        >
          {visibleOffers.map((offer) => (
            <article
              key={offer.id}
              className="min-w-[300px] sm:min-w-[420px] max-w-[430px] snap-start rounded-2xl border border-[#E5EAF1] bg-[#FAFCFF] hover:bg-white hover:shadow-md transition-all p-3.5 flex gap-4 shrink-0"
            >
              <div className="w-28 sm:w-32 h-32 rounded-xl overflow-hidden bg-slate-100 shrink-0 relative">
                <img
                  src={offer.imageUrl}
                  alt={offer.title}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-1.5 left-1.5 right-1.5 px-2 py-0.5 rounded bg-black/65 backdrop-blur-xs text-[9px] font-bold text-white text-center truncate">
                  {offer.validityText}
                </span>
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#1666F2]">
                    {offer.categoryLabel}
                  </span>
                  <h3 className="text-sm font-extrabold text-[#172B4D] leading-snug line-clamp-2">
                    {offer.title}
                  </h3>
                  <p className="text-xs text-[#64748B] line-clamp-2 leading-relaxed">
                    {offer.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-[#E5EAF1] flex items-center justify-between gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedOfferModal(offer)}
                    className="text-[11px] font-semibold text-[#64748B] hover:text-[#172B4D] cursor-pointer"
                  >
                    T&amp;Cs apply
                  </button>
                  <Link
                    href={offer.actionHref}
                    className="text-xs font-extrabold text-[#1666F2] hover:underline inline-flex items-center gap-1"
                  >
                    <span>{offer.actionLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Offer Terms & Details Modal */}
      {selectedOfferModal && (
        <div
          className="fixed inset-0 z-[90] bg-slate-950/55 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-label="Program details"
        >
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#E5EAF1] p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#1666F2]">
                  {selectedOfferModal.categoryLabel}
                </span>
                <h3 className="text-lg font-extrabold text-[#172B4D] mt-0.5">
                  {selectedOfferModal.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOfferModal(null)}
                aria-label="Close offer modal"
                className="p-1.5 rounded-lg hover:bg-slate-100 text-[#64748B] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-[#334155] leading-relaxed">
              {selectedOfferModal.description}
            </p>

            <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5 text-xs">
              <p className="font-bold text-[#172B4D] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Validity: {selectedOfferModal.validityText}
              </p>
              <p className="text-[#64748B] leading-relaxed">{selectedOfferModal.termsSummary}</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSelectedOfferModal(null)}
                className="px-4 py-2 rounded-xl border border-[#DCE4EF] text-xs font-bold text-[#475569] cursor-pointer"
              >
                Close
              </button>
              <Link
                href={selectedOfferModal.actionHref}
                onClick={() => setSelectedOfferModal(null)}
                className="px-5 py-2 rounded-xl bg-[#1666F2] text-white text-xs font-bold hover:bg-[#173B70]"
              >
                {selectedOfferModal.actionLabel}
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
