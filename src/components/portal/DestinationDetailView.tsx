'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  MapPin,
  Compass,
  CloudSun,
  Heart,
  Clock,
  Star,
  ArrowLeft,
  ExternalLink,
  Hotel,
  TrainFront,
  Bus,
  PlusCircle,
  Loader2,
  Check,
} from 'lucide-react';
import { TravelTopNav } from './TravelTopNav';
import { PlatformTrustFooter } from './PlatformTrustFooter';
import { usePortalWishlist } from './usePortalWishlist';
import { CreateTripModal } from '../modals/CreateTripModal';
import { useAuth } from '../auth/AuthProvider';
import { toast } from 'sonner';
import type { Destination } from '../../data/destinations';
import type { BookingCategoryId } from '../../data/travelCatalog';
import { useRouter } from 'next/navigation';

interface DestinationDetailViewProps {
  destination: Destination;
}

interface WeatherSummary {
  temperatureC: number;
  windKmh: number;
  source: string;
  lastUpdated?: string;
  forecast3Day?: Array<{ date: string; minC: number; maxC: number }>;
}

export const DestinationDetailView: React.FC<DestinationDetailViewProps> = ({
  destination,
}) => {
  const router = useRouter();
  const { isConfigured } = useAuth();
  const { savedIds, savedDestinations, toggleWishlist, isWishlisted } = usePortalWishlist();
  const [navCategory, setNavCategory] = useState<BookingCategoryId>('packages');
  const [weather, setWeather] = useState<WeatherSummary | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [hotelStatus, setHotelStatus] = useState<string | null>(null);
  const [hotelChecking, setHotelChecking] = useState(false);
  const [createTripOpen, setCreateTripOpen] = useState(false);

  const cityShort = destination.name.split(',')[0].trim();
  const saved = isWishlisted(destination.id);

  useEffect(() => {
    let cancelled = false;
    async function loadWeather() {
      setWeatherLoading(true);
      try {
        const res = await fetch(`/api/travel?type=weather&city=${encodeURIComponent(cityShort)}`);
        if (res.ok && !cancelled) {
          const json = await res.json();
          if (json?.data) {
            setWeather({
              temperatureC: Number(json.data.temperatureC ?? 0),
              windKmh: Number(json.data.windKmh ?? 0),
              source: String(json.source || 'Open-Meteo Public Feed'),
              lastUpdated: json.lastUpdated ? String(json.lastUpdated) : undefined,
              forecast3Day: json.data.forecast3Day,
            });
          }
        }
      } catch {
        // Non-fatal
      } finally {
        if (!cancelled) setWeatherLoading(false);
      }
    }
    void loadWeather();
    return () => {
      cancelled = true;
    };
  }, [cityShort]);

  const handleCheckHotels = async () => {
    setHotelChecking(true);
    try {
      const res = await fetch(`/api/travel?type=hotels&city=${encodeURIComponent(cityShort)}`);
      const json = await res.json();
      setHotelStatus(
        json?.disclaimer ||
          `Status: ${json?.status || 'waiting_for_credentials'} — Configure HOTEL_PROVIDER_API_KEY for live room inventory.`
      );
    } catch {
      setHotelStatus('Unable to query hotel adapter right now.');
    } finally {
      setHotelChecking(false);
    }
  };

  const handleCreateDestinationTrip = async (tripData: {
    title: string;
    destination: string;
    startDate: string;
    endDate: string;
    budget: number;
  }) => {
    if (!isConfigured) {
      try {
        const existing = JSON.parse(localStorage.getItem('tripsplit_custom_trips') || '[]');
        localStorage.setItem(
          'tripsplit_custom_trips',
          JSON.stringify([
            {
              name: tripData.title,
              destination: tripData.destination,
              startDate: tripData.startDate,
              totalBudget: tripData.budget,
              spots: destination.spots.map((s) => ({ name: s.name, cost: s.cost })),
            },
            ...existing,
          ])
        );
      } catch {
        // ignore storage failure
      }
      toast.success(`Trip "${tripData.title}" saved to your Expense Dashboard!`);
      router.push('/dashboard');
      return;
    }

    const res = await fetch('/api/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: tripData.title,
        destination: tripData.destination,
        startDate: tripData.startDate,
        endDate: tripData.endDate,
        budget: tripData.budget,
        coverImage: destination.heroImage,
      }),
    });
    if (res.ok) {
      const json = await res.json();
      toast.success(`Trip "${tripData.title}" created!`);
      router.push(json?.trip?.id ? `/trips/${json.trip.id}` : '/dashboard');
    } else {
      const err = await res.json();
      toast.error(err.error || 'Please sign in to save trips to database.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-[#172B4D] flex flex-col">
      <TravelTopNav
        activeCategory={navCategory}
        onSelectCategory={(c) => {
          setNavCategory(c);
          router.push('/');
        }}
        wishlistCount={savedIds.length}
        wishlistDestinations={savedDestinations}
        onRemoveWishlist={toggleWishlist}
      />

      <main className="flex-1 space-y-6 pb-12">
        {/* Hero Banner */}
        <section className="relative h-80 sm:h-96 overflow-hidden bg-slate-900">
          <img
            src={destination.heroImage}
            alt={destination.name}
            fetchPriority="high"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-slate-950/50" />

          <div className="absolute inset-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col justify-between text-white">
            <div className="flex items-center justify-between">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-black/45 hover:bg-black/65 backdrop-blur-md text-xs font-bold text-white border border-white/20"
              >
                <ArrowLeft className="w-4 h-4" /> All Travel Categories
              </Link>
              <button
                type="button"
                onClick={() => toggleWishlist(destination.id)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/90 text-[#172B4D] text-xs font-bold shadow-md cursor-pointer"
              >
                <Heart className={`w-4 h-4 ${saved ? 'text-rose-500 fill-rose-500' : ''}`} />
                <span>{saved ? 'Saved in Wishlist' : 'Save to Wishlist'}</span>
              </button>
            </div>

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="space-y-2 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                  <span className="px-2.5 py-1 rounded-full bg-sky-500/25 border border-sky-300/30 text-sky-200">
                    {destination.region} India
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/25 border border-emerald-300/30 text-emerald-200 num-inr">
                    Baseline From ₹{destination.startingPrice.toLocaleString('en-IN')}/day
                  </span>
                </div>
                <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
                  {destination.name}
                </h1>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                  {destination.description}
                </p>
              </div>

              <div className="flex flex-wrap gap-2.5 shrink-0">
                <Link
                  href={`/3d-experience?city=${encodeURIComponent(destination.id)}`}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-[#1666F2] to-[#0EA5E9] text-white text-xs font-extrabold shadow-lg hover:opacity-95"
                >
                  <Compass className="w-4 h-4" /> Explore 360° 3D Tour
                </Link>
                <button
                  type="button"
                  onClick={() => setCreateTripOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white text-[#173B70] text-xs font-extrabold shadow-lg hover:bg-slate-100 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" /> Plan Group Trip
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Weather + Live Supplier Adapters Row */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Weather Card */}
          <div className="bg-white rounded-3xl border border-[#E5EAF1] p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-[#172B4D] flex items-center gap-2">
                <CloudSun className="w-4 h-4 text-[#1666F2]" /> Live Weather Telemetry
              </h2>
              {weatherLoading && <Loader2 className="w-4 h-4 animate-spin text-[#1666F2]" />}
            </div>
            {weather ? (
              <>
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-extrabold text-[#173B70] num-inr">
                    {weather.temperatureC}°C
                  </span>
                  <span className="text-xs text-[#64748B]">Wind {weather.windKmh} km/h</span>
                </div>
                {weather.forecast3Day && (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {weather.forecast3Day.map((d) => (
                      <div key={d.date} className="rounded-xl bg-[#F8FAFC] border border-[#E5EAF1] p-2 text-center">
                        <p className="text-[10px] text-[#64748B]">{d.date.slice(5)}</p>
                        <p className="text-xs font-extrabold text-[#172B4D] num-inr">
                          {Math.round(d.minC)}°–{Math.round(d.maxC)}°
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-[#64748B]">
                  Source: {weather.source}
                  {weather.lastUpdated ? ` • Updated ${new Date(weather.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                </p>
              </>
            ) : (
              <p className="text-xs text-[#64748B]">Fetching Open-Meteo coordinates telemetry...</p>
            )}
          </div>

          {/* Hotel Availability Adapter */}
          <div className="bg-white rounded-3xl border border-[#E5EAF1] p-5 shadow-xs space-y-3">
            <h2 className="text-sm font-extrabold text-[#172B4D] flex items-center gap-2">
              <Hotel className="w-4 h-4 text-[#1666F2]" /> Stay &amp; Hotel Search
            </h2>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Query connected LiteAPI/Hotelbeds supplier inventory for {cityShort}, or inspect verified external listings without fabricated prices.
            </p>
            {hotelStatus && (
              <p className="text-[11px] p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                {hotelStatus}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={hotelChecking}
                onClick={handleCheckHotels}
                className="px-3.5 py-2 rounded-xl bg-[#173B70] text-white text-xs font-bold hover:bg-[#1666F2] disabled:opacity-50 cursor-pointer"
              >
                {hotelChecking ? 'Checking...' : 'Check Hotel Adapter'}
              </button>
              <a
                href={`https://www.booking.com/searchresults.html?ss=${encodeURIComponent(cityShort)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl border border-[#DCE4EF] text-xs font-bold text-[#172B4D] hover:bg-slate-50"
              >
                Booking.com <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Transit Links */}
          <div className="bg-white rounded-3xl border border-[#E5EAF1] p-5 shadow-xs space-y-3">
            <h2 className="text-sm font-extrabold text-[#172B4D] flex items-center gap-2">
              <TrainFront className="w-4 h-4 text-[#1666F2]" /> Rail, Bus &amp; Road Transit
            </h2>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Launch official operator searches to plan your arrival in {cityShort}.
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href="https://www.irctc.co.in/nget/train-search"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-bold hover:bg-blue-50"
              >
                <TrainFront className="w-3.5 h-3.5 text-[#1666F2]" /> IRCTC Rail <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="https://www.redbus.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-bold hover:bg-blue-50"
              >
                <Bus className="w-3.5 h-3.5 text-rose-600" /> RedBus <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-bold hover:bg-blue-50"
              >
                <MapPin className="w-3.5 h-3.5 text-emerald-600" /> Maps <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </section>

          {/* Curated 4 Local Spots + Package Scope */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white rounded-3xl border border-[#E5EAF1] p-5 shadow-xs">
            <div className="space-y-1.5">
              <p className="text-xs font-extrabold text-[#047857] uppercase tracking-wider">Catalog Estimate Inclusions</p>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Curated local sightseeing route, baseline daily stay/dining estimate (₹{destination.startingPrice.toLocaleString('en-IN')}/day), interactive 360° spot exploration, and group expense ledger setup.
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-extrabold text-amber-700 uppercase tracking-wider">Not Included / Supplier-Verified Separately</p>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Live flight fares, confirmed hotel room inventory, rail/bus tickets, and travel insurance require connected supplier providers or external partner checkout.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-[#172B4D]">
                Curated Spots &amp; Sightseeing in {cityShort}
              </h2>
              <p className="text-xs text-[#64748B]">
                Verified catalog highlights and indicative activity ticket costs
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {destination.spots.map((spot, idx) => (
              <article
                key={spot.id}
                className="bg-white rounded-3xl border border-[#E5EAF1] shadow-xs overflow-hidden flex flex-col sm:flex-row"
              >
                <div className="sm:w-44 h-48 sm:h-auto bg-slate-100 shrink-0 relative">
                  <img
                    src={spot.realPhotoUrl || destination.heroImage}
                    alt={spot.name}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-black/65 text-white text-[10px] font-bold">
                    Spot #{idx + 1} • {spot.category}
                  </span>
                </div>

                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-extrabold text-[#172B4D]">{spot.name}</h3>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 shrink-0">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        {spot.rating}
                      </span>
                    </div>
                    <p className="text-xs text-[#64748B] leading-relaxed">{spot.description}</p>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {spot.highlights.map((h) => (
                        <span
                          key={h}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F4F7FB] border border-[#E5EAF1] text-[10px] font-semibold text-[#475569]"
                        >
                          <Check className="w-2.5 h-2.5 text-emerald-600" />
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#E5EAF1] flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-3 text-[#64748B]">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> {spot.duration}
                      </span>
                      <span>Best: {spot.bestTime}</span>
                    </div>
                    <span className="font-extrabold text-[#173B70] num-inr">
                      {spot.cost === 0 ? 'Free Entry' : `Est. ₹${spot.cost.toLocaleString('en-IN')}`}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <PlatformTrustFooter />

      <CreateTripModal
        isOpen={createTripOpen}
        onClose={() => setCreateTripOpen(false)}
        onCreate={handleCreateDestinationTrip}
        initialTitle={`${cityShort} Group Escape`}
        initialDestination={destination.name}
        initialBudget={destination.startingPrice * 4 * 3}
      />
    </div>
  );
};
