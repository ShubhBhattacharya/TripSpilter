'use client';

import React from 'react';
import Link from 'next/link';
import {
  MapPin,
  CloudSun,
  Coins,
  Navigation,
  Hotel,
  Plane,
  TrainFront,
  ShieldAlert,
  ExternalLink,
  CalendarDays,
  Compass,
  PhoneCall,
  Wallet,
  BookmarkCheck,
  AlertCircle,
} from 'lucide-react';
import type { StructuredCard } from '../../lib/ai/types';

interface AiRichCardsProps {
  cards: StructuredCard[];
  onQuickPrompt: (prompt: string) => void;
}

export const AiRichCards: React.FC<AiRichCardsProps> = ({ cards, onQuickPrompt }) => {
  if (!cards || cards.length === 0) return null;

  return (
    <div className="mt-2.5 space-y-2.5">
      {cards.map((card, idx) => {
        switch (card.type) {
          case 'itinerary':
            return (
              <div
                key={`itinerary-${idx}-${card.destinationId}`}
                className="rounded-xl border border-indigo-200/80 bg-white overflow-hidden shadow-sm"
              >
                <div className="relative h-24 bg-gradient-to-r from-[#173B70] via-[#1E4E8C] to-[#0E7490] p-3 flex flex-col justify-between text-white">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-white/15 px-2 py-0.5 rounded-full backdrop-blur-xs">
                      <CalendarDays className="w-3 h-3" /> {card.days}-Day Catalog Plan
                    </span>
                    <span className="text-[11px] font-bold num-inr bg-emerald-500/20 border border-emerald-300/30 px-2 py-0.5 rounded-full">
                      Est. ₹{card.budgetEstimateInr.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold leading-tight truncate">{card.destinationName}</h4>
                    <p className="text-[11px] text-cyan-100">
                      {card.travelers} Travelers • {card.state}
                    </p>
                  </div>
                </div>

                <div className="p-2.5 space-y-2 max-h-60 overflow-y-auto">
                  {card.schedule.map((day) => (
                    <div
                      key={day.day}
                      className="rounded-lg bg-slate-50 border border-slate-200/70 p-2 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[#173B70]">
                          Day {day.day}: {day.title}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-600 num-inr shrink-0">
                          ~₹{day.estimatedCostInr.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-700 leading-snug">
                        <strong className="text-slate-800">AM:</strong> {day.morning}
                      </p>
                      <p className="text-[11px] text-slate-700 leading-snug">
                        <strong className="text-slate-800">PM:</strong> {day.afternoon}
                      </p>
                      <p className="text-[11px] text-slate-600 leading-snug">
                        <strong className="text-slate-700">Eve:</strong> {day.evening}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="px-2.5 py-2 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-500 leading-tight max-w-[68%]">
                    {card.disclaimer}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/3d-experience?city=${encodeURIComponent(card.destinationId)}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#173B70] text-white text-[11px] font-semibold hover:bg-[#1685D4] transition-colors"
                    >
                      <Compass className="w-3 h-3" /> 3D Tour
                    </Link>
                    <button
                      type="button"
                      onClick={() =>
                        onQuickPrompt(
                          `Create a ${card.days}-day trip to ${card.destinationName} with ₹${card.budgetEstimateInr} budget`
                        )
                      }
                      className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-semibold hover:bg-indigo-100 transition-colors"
                    >
                      Save Draft Trip
                    </button>
                  </div>
                </div>
              </div>
            );

          case 'destinations':
            return (
              <div
                key={`destinations-${idx}`}
                className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#173B70] flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-cyan-600" /> Curated Destinations ({card.items.length})
                  </span>
                  <Link href="/explore" className="text-[10px] font-semibold text-[#1685D4] hover:underline">
                    View all 60 →
                  </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {card.items.slice(0, 4).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50/70 p-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 truncate">{item.name}</p>
                        <p className="text-[10px] text-slate-500 truncate">{item.region} • {item.spotCount} spots</p>
                        <p className="text-[10px] font-semibold text-emerald-700 num-inr mt-0.5">
                          From ₹{item.startingPrice.toLocaleString('en-IN')}/day
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onQuickPrompt(`Plan a 3-day trip to ${item.name}`)}
                        className="shrink-0 px-2 py-1 rounded-md bg-white border border-slate-200 text-[10px] font-semibold text-[#173B70] hover:bg-indigo-50"
                      >
                        Plan
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );

          case 'weather':
            return (
              <div
                key={`weather-${idx}-${card.city}`}
                className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-3 shadow-sm space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
                      <CloudSun className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">{card.city}</p>
                      <p className="text-[10px] text-slate-500">{card.source}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-extrabold text-[#173B70] num-inr">
                      {card.temperatureC ?? '--'}°C
                    </p>
                    <p className="text-[10px] text-slate-600">Wind {card.windKmh ?? '--'} km/h</p>
                  </div>
                </div>
                {card.forecast3Day && card.forecast3Day.length > 0 && (
                  <div className="grid grid-cols-3 gap-1.5">
                    {card.forecast3Day.map((d) => (
                      <div key={d.date} className="rounded-lg bg-white border border-sky-100 px-2 py-1 text-center">
                        <p className="text-[10px] text-slate-500">{d.date.slice(5)}</p>
                        <p className="text-[11px] font-bold text-slate-800 num-inr">
                          {Math.round(d.minC)}°–{Math.round(d.maxC)}°
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {card.disclaimer && <p className="text-[10px] text-slate-500">{card.disclaimer}</p>}
              </div>
            );

          case 'currency':
            return (
              <div
                key={`fx-${idx}`}
                className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-white p-3 shadow-sm space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-emerald-600" /> FX Conversion ({card.from} → {card.to})
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                    {card.status === 'live_verified' ? 'Exact' : 'Indicative ECB'}
                  </span>
                </div>
                <p className="text-sm font-extrabold text-slate-900 num-inr">
                  {card.amount} {card.from} = {card.convertedAmount?.toLocaleString('en-IN')} {card.to}
                </p>
                <p className="text-[10px] text-slate-600">
                  1 {card.from} = {card.rate} {card.to} • {card.source}
                </p>
                {card.disclaimer && <p className="text-[10px] text-slate-500">{card.disclaimer}</p>}
              </div>
            );

          case 'route':
            return (
              <div
                key={`route-${idx}`}
                className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 shadow-sm space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Navigation className="w-4 h-4 text-amber-600" />
                    {card.origin} → {card.destination}
                  </span>
                  <span className="text-[11px] font-bold text-[#173B70] num-inr">
                    ~{card.distanceKm} km
                  </span>
                </div>
                <p className="text-[11px] text-slate-700">
                  Estimated transit time: ~{Math.round(((card.durationMinutes || 0) / 60) * 10) / 10} hrs ({card.source})
                </p>
                {card.disclaimer && <p className="text-[10px] text-slate-500">{card.disclaimer}</p>}
              </div>
            );

          case 'provider_status': {
            const Icon =
              card.category === 'hotels'
                ? Hotel
                : card.category === 'flights'
                  ? Plane
                  : card.category === 'transit'
                    ? TrainFront
                    : MapPin;
            return (
              <div
                key={`provider-${idx}-${card.category}`}
                className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 shadow-sm space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <Icon className="w-4 h-4 text-amber-700 shrink-0" />
                    {card.title}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white border border-amber-300 text-amber-800 shrink-0">
                    {card.status === 'redirect_only' ? 'External Search' : 'Waiting for Credentials'}
                  </span>
                </div>
                <p className="text-[11px] text-amber-900 leading-snug">{card.message}</p>
                {card.missingCredential && (
                  <p className="text-[10px] font-mono text-amber-800 bg-white/80 rounded px-2 py-1 border border-amber-200/80 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" /> Missing server env: {card.missingCredential}
                  </p>
                )}
                {card.links && card.links.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {card.links.map((l) => (
                      <a
                        key={l.url}
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-[11px] font-semibold text-amber-900 hover:bg-amber-100 transition-colors"
                      >
                        {l.label} <ExternalLink className="w-3 h-3" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          case 'safety':
            return (
              <div
                key={`safety-${idx}`}
                className="rounded-xl border border-rose-200 bg-rose-50/50 p-3 shadow-sm space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-950 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    Travel Safety & Helplines {card.destination ? `(${card.destination})` : ''}
                  </span>
                </div>
                {card.weatherAlert && (
                  <div className="rounded-lg bg-amber-100/80 border border-amber-300 px-2.5 py-1.5 text-[11px] font-medium text-amber-950">
                    Weather Advisory: {card.weatherAlert}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-1.5">
                  {card.helplines.map((h) => (
                    <a
                      key={h.number}
                      href={`tel:${h.number}`}
                      className="rounded-lg bg-white border border-rose-200/80 p-2 hover:bg-rose-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-rose-700 num-inr">{h.number}</span>
                        <PhoneCall className="w-3 h-3 text-rose-500" />
                      </div>
                      <p className="text-[10px] font-semibold text-slate-800 truncate">{h.label}</p>
                    </a>
                  ))}
                </div>
                <ul className="space-y-1 text-[11px] text-slate-700 list-disc pl-4">
                  {card.packingTips.map((tip, tipIdx) => (
                    <li key={tipIdx}>{tip}</li>
                  ))}
                </ul>
              </div>
            );

          case 'trips_summary':
            return (
              <div key={`trips-${idx}`} className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm space-y-2">
                <p className="text-xs font-bold text-[#173B70] flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-[#1685D4]" /> Your Saved Trips ({card.trips.length})
                </p>
                {card.trips.length === 0 ? (
                  <p className="text-[11px] text-slate-500">No trips found yet. Ask me to draft one!</p>
                ) : (
                  <div className="space-y-1.5">
                    {card.trips.slice(0, 4).map((t) => (
                      <Link
                        key={t.id}
                        href={`/trips/${t.id}`}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 hover:bg-indigo-50 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{t.title}</p>
                          <p className="text-[10px] text-slate-500 truncate">{t.destination}</p>
                        </div>
                        <span className="text-xs font-bold text-emerald-700 num-inr shrink-0">
                          ₹{t.budget.toLocaleString('en-IN')}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );

          case 'bookings_summary':
            return (
              <div key={`bookings-${idx}`} className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm space-y-2">
                <p className="text-xs font-bold text-[#173B70] flex items-center gap-1.5">
                  <BookmarkCheck className="w-4 h-4 text-[#0A9B78]" /> Bookings Vault ({card.bookings.length})
                </p>
                {card.bookings.length === 0 ? (
                  <p className="text-[11px] text-slate-500">No saved booking items in your vault.</p>
                ) : (
                  <div className="space-y-1.5">
                    {card.bookings.slice(0, 4).map((b) => (
                      <div
                        key={b.id}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{b.title}</p>
                          <p className="text-[10px] text-slate-500 truncate">
                            {b.category} • {b.status}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-slate-800 num-inr shrink-0">
                          ₹{b.amount.toLocaleString('en-IN')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
        }
      })}
    </div>
  );
};
