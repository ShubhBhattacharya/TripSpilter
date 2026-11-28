'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  ExternalLink,
  Heart,
  MapPin,
  ArrowRight,
  Cpu,
  CheckCircle2,
  KeyRound,
} from 'lucide-react';
import {
  TRAVEL_ECOSYSTEM_INTEGRATIONS,
  STAY_STYLE_TABS,
  CURATED_STAY_COLLECTIONS,
  type StayStyleId,
} from '../../data/travelCatalog';

interface StaysAndPartnersSectionProps {
  isWishlisted: (id: string) => boolean;
  onToggleWishlist: (id: string) => void;
}

export const StaysAndPartnersSection: React.FC<StaysAndPartnersSectionProps> = ({
  isWishlisted,
  onToggleWishlist,
}) => {
  const [stayTab, setStayTab] = useState<StayStyleId>('featured');

  const visibleStays =
    stayTab === 'featured'
      ? CURATED_STAY_COLLECTIONS
      : CURATED_STAY_COLLECTIONS.filter((s) => s.style === stayTab);

  return (
    <div className="space-y-6">
      {/* 4. Travel Supplier Integrations & Ecosystem Showcase */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl border border-[#E5EAF1] shadow-xs p-5 sm:p-7 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#1666F2] inline-flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5" /> Connected Ecosystem &amp; Provider Adapters
              </span>
              <h2 className="text-lg sm:text-xl font-extrabold text-[#172B4D] mt-0.5">
                Travel Supplier &amp; Real-Time Data Architecture
              </h2>
            </div>
            <span className="text-[11px] font-medium text-[#64748B]">
              Official API adapters &amp; verified external booking rails (zero unverified brand claims)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {TRAVEL_ECOSYSTEM_INTEGRATIONS.map((item) => {
              const isLive = item.statusLabel === 'Live Public Feed';
              const isRedirect = item.statusLabel === 'Official External Redirect';
              return (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl border border-[#E5EAF1] bg-[#FAFCFF] flex flex-col justify-between gap-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                        {item.category}
                      </span>
                      <h3 className="text-sm font-extrabold text-[#172B4D]">{item.name}</h3>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        isLive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : isRedirect
                            ? 'bg-blue-50 text-[#1666F2] border border-blue-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {isLive ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : isRedirect ? (
                        <ExternalLink className="w-3 h-3" />
                      ) : (
                        <KeyRound className="w-3 h-3" />
                      )}
                      <span>{item.statusLabel}</span>
                    </span>
                  </div>
                  <p className="text-xs text-[#64748B] leading-relaxed">{item.detail}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. Flagship Hotel & Stay Collections */}
      <section id="stays-showcase" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl border border-[#E5EAF1] shadow-sm p-5 sm:p-7 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E5EAF1] pb-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#172B4D] flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#1666F2]" />
                <span>Flagship Stays &amp; Property Collections</span>
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                Explore boutique stays &amp; group villas; live nightly room rates display only when HOTEL_PROVIDER_API_KEY is active.
              </p>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {STAY_STYLE_TABS.map((tab) => {
                const active = stayTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStayTab(tab.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      active
                        ? 'bg-[#1666F2] text-white shadow-xs'
                        : 'bg-[#F4F7FB] text-[#475569] hover:text-[#172B4D]'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {visibleStays.map((stay) => {
              const saved = isWishlisted(stay.destinationId);
              return (
                <article
                  key={stay.id}
                  className="group rounded-2xl border border-[#E5EAF1] bg-[#FAFCFF] overflow-hidden hover:bg-white hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="relative h-44 bg-slate-100 overflow-hidden">
                      <img
                        src={stay.imageUrl}
                        alt={stay.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold uppercase tracking-wider">
                        {stay.style}
                      </span>
                      <button
                        type="button"
                        onClick={() => onToggleWishlist(stay.destinationId)}
                        aria-label={`Save ${stay.destinationLabel} to wishlist`}
                        className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-sm cursor-pointer"
                      >
                        <Heart
                          className={`w-4 h-4 ${
                            saved ? 'text-rose-500 fill-rose-500' : 'text-slate-600'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="p-4 space-y-2.5">
                      <div>
                        <p className="text-[11px] font-semibold text-[#1666F2] flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {stay.destinationLabel}
                        </p>
                        <h3 className="text-sm font-extrabold text-[#172B4D] leading-snug mt-0.5">
                          {stay.title}
                        </h3>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {stay.facilities.map((fac) => (
                          <span
                            key={fac}
                            className="px-2 py-0.5 rounded-md bg-white border border-[#E5EAF1] text-[10px] font-medium text-[#475569]"
                          >
                            {fac}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="px-4 py-3 border-t border-[#E5EAF1] bg-white flex items-center justify-between gap-2">
                    <Link
                      href={`/destinations/${stay.destinationId}`}
                      className="text-xs font-extrabold text-[#173B70] hover:text-[#1666F2] inline-flex items-center gap-1"
                    >
                      <span>View Details</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>

                    <a
                      href={stay.externalSearchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="External link: opens hotel search on partner site"
                      aria-label={`Search hotels for ${stay.title} (external link)`}
                      className="text-[11px] font-bold text-[#64748B] hover:text-[#1666F2] inline-flex items-center gap-1"
                    >
                      <span>Search hotels (external)</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};
