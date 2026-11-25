'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Plane,
  Hotel,
  Home,
  Luggage,
  TrainFront,
  Bus,
  CarTaxiFront,
  MapPinned,
  ShieldCheck,
  ArrowLeftRight,
  Search,
  Compass,
  Sparkles,
  QrCode,
  Globe,
  Wallet,
  ExternalLink,
  AlertCircle,
  Loader2,
  CloudSun,
  MapPin,
  PhoneCall,
  X,
} from 'lucide-react';
import { DESTINATIONS, type Destination } from '../../data/destinations';
import { PORTAL_NAV_CATEGORIES, type BookingCategoryId } from '../../data/travelCatalog';

interface HeroBookingSearchProps {
  activeCategory: BookingCategoryId;
  onSelectCategory: (cat: BookingCategoryId) => void;
}

interface SearchOutcome {
  category: BookingCategoryId;
  title: string;
  subtitle: string;
  statusTag: string;
  message: string;
  weather?: {
    city: string;
    temperatureC: number;
    windKmh: number;
    source: string;
  } | null;
  route?: {
    origin: string;
    destination: string;
    distanceKm: number;
    durationMinutes: number;
    source: string;
  } | null;
  matchedDestinations?: Destination[];
  externalLinks?: Array<{ label: string; url: string }>;
  missingCredential?: string;
}

const TAB_ICONS: Record<BookingCategoryId, React.ComponentType<{ className?: string }>> = {
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

const QUICK_AIRPORT_OPTIONS = [
  'Delhi (DEL)',
  'Mumbai (BOM)',
  'Bengaluru (BLR)',
  'Goa (GOI)',
  'Jaipur (JAI)',
  'Kochi (COK)',
  'Kolkata (CCU)',
  'Hyderabad (HYD)',
];

export const HeroBookingSearch: React.FC<HeroBookingSearchProps> = ({
  activeCategory,
  onSelectCategory,
}) => {
  // Flights state
  const [flightTripType, setFlightTripType] = useState<'one_way' | 'round_trip' | 'multi_city'>('one_way');
  const [flightFrom, setFlightFrom] = useState('Delhi (DEL)');
  const [flightTo, setFlightTo] = useState('Bengaluru (BLR)');
  const [flightDepDate, setFlightDepDate] = useState('2026-12-15');
  const [flightRetDate, setFlightRetDate] = useState('2026-12-20');
  const [flightLeg2To, setFlightLeg2To] = useState('Goa (GOI)');
  const [flightTravellers, setFlightTravellers] = useState('2');
  const [flightClass, setFlightClass] = useState('Economy');

  // Hotels / Homestays state
  const [stayCity, setStayCity] = useState('Manali');
  const [checkInDate, setCheckInDate] = useState('2026-12-15');
  const [checkOutDate, setCheckOutDate] = useState('2026-12-18');
  const [roomsCount, setRoomsCount] = useState('1');
  const [guestsCount, setGuestsCount] = useState('2');

  // Trains state
  const [trainFrom, setTrainFrom] = useState('New Delhi');
  const [trainTo, setTrainTo] = useState('Jaipur');
  const [trainDate, setTrainDate] = useState('2026-12-15');

  // Buses state
  const [busSource, setBusSource] = useState('Delhi');
  const [busDest, setBusDest] = useState('Manali');
  const [busDate, setBusDate] = useState('2026-12-15');

  // Cabs state
  const [cabPickup, setCabPickup] = useState('Delhi');
  const [cabDrop, setCabDrop] = useState('Rishikesh');
  const [cabDateTime, setCabDateTime] = useState('2026-12-15T08:00');

  // Packages state
  const [pkgDest, setPkgDest] = useState('Manali');
  const [pkgDays, setPkgDays] = useState('4');
  const [pkgTravellers, setPkgTravellers] = useState('4');
  const [pkgBudget, setPkgBudget] = useState('25000');

  // Activities state
  const [activityQuery, setActivityQuery] = useState('Temple, Trek & Waterfalls');

  // Execution state
  const [searching, setSearching] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<SearchOutcome | null>(null);

  const citySuggestions = useMemo(
    () => DESTINATIONS.slice(0, 24).map((d) => d.name.split(',')[0].trim()),
    []
  );

  const findCatalogMatches = (query: string): Destination[] => {
    const q = query.toLowerCase().trim();
    if (!q) return DESTINATIONS.slice(0, 4);
    const terms = q
      .split(/[\s,()]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3);
    const matched = DESTINATIONS.filter((d) => {
      const hay = `${d.name} ${d.state} ${d.region} ${d.tagline} ${d.spots
        .map((s) => `${s.name} ${s.category}`)
        .join(' ')}`.toLowerCase();
      return terms.some((term) => hay.includes(term));
    });
    return (matched.length > 0 ? matched : DESTINATIONS).slice(0, 4);
  };

  const fetchWeatherSafe = async (city: string) => {
    try {
      const r = await fetch(`/api/travel?type=weather&city=${encodeURIComponent(city)}`);
      if (!r.ok) return null;
      const json = await r.json();
      if (json?.data) {
        return {
          city: String(json.data.city || city),
          temperatureC: Number(json.data.temperatureC ?? 0),
          windKmh: Number(json.data.windKmh ?? 0),
          source: String(json.source || 'Open-Meteo'),
        };
      }
    } catch {
      // Ignore transient weather failure cleanly
    }
    return null;
  };

  const fetchRouteSafe = async (origin: string, destination: string) => {
    try {
      const r = await fetch(
        `/api/travel?type=route&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`
      );
      if (!r.ok) return null;
      const json = await r.json();
      if (json?.data) {
        return {
          origin: String(json.data.origin || origin),
          destination: String(json.data.destination || destination),
          distanceKm: Number(json.data.distanceKm ?? 0),
          durationMinutes: Number(json.data.durationMinutes ?? 0),
          source: String(json.source || 'Route Adapter'),
        };
      }
    } catch {
      // Ignore transient route failure
    }
    return null;
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setOutcome(null);

    if (activeCategory === 'insurance') {
      setOutcome({
        category: 'insurance',
        title: 'Travel Insurance — Coming Soon',
        subtitle: 'Partner insurer onboarding required before policy issuance',
        statusTag: 'Coming Soon',
        message:
          'TripSplitter does not offer unverified insurance quotes. Meanwhile, you have instant access to pan-India tourist & emergency helplines (112, 1363, 139).',
      });
      return;
    }

    setSearching(true);
    try {
      if (activeCategory === 'flights') {
        if (!flightFrom.trim() || !flightTo.trim()) {
          setValidationError('Please enter both origin and destination airports or cities.');
          return;
        }
        if (flightFrom.trim().toLowerCase() === flightTo.trim().toLowerCase()) {
          setValidationError('Origin and destination must be different.');
          return;
        }
        if (flightTripType === 'round_trip' && flightRetDate < flightDepDate) {
          setValidationError('Return date cannot be earlier than departure date.');
          return;
        }

        const originCode = flightFrom.match(/\(([A-Z]{3})\)/)?.[1] || flightFrom.trim();
        const destCode = flightTo.match(/\(([A-Z]{3})\)/)?.[1] || flightTo.trim();
        const destCity = flightTo.split('(')[0].trim();

        const [apiRes, weather] = await Promise.all([
          fetch(
            `/api/travel?type=flights&origin=${encodeURIComponent(originCode)}&destination=${encodeURIComponent(destCode)}&departureDate=${encodeURIComponent(flightDepDate)}&passengers=${encodeURIComponent(flightTravellers)}`
          ),
          fetchWeatherSafe(destCity),
        ]);

        const json = await apiRes.json();
        const links = [
          {
            label: 'Continue to Google Flights',
            url: `https://www.google.com/travel/flights?q=${encodeURIComponent(`Flights from ${originCode} to ${destCode} on ${flightDepDate}`)}`,
          },
        ];

        if (apiRes.status === 401) {
          setOutcome({
            category: 'flights',
            title: `Flights: ${flightFrom} → ${flightTo}`,
            subtitle: `${flightTravellers} Traveller(s) • ${flightClass}`,
            statusTag: 'Sign In / External Search',
            message:
              'Sign in to run authenticated Amadeus API flight searches, or continue directly to Google Flights without fake fares.',
            weather,
            matchedDestinations: findCatalogMatches(destCity),
            externalLinks: links,
          });
          return;
        }

        setOutcome({
          category: 'flights',
          title: `Flights: ${flightFrom} → ${flightTo}`,
          subtitle: `${flightTripType.replace('_', ' ')} • ${flightDepDate} • ${flightTravellers} Traveller(s) • ${flightClass}`,
          statusTag:
            json?.status === 'live_verified' ? 'Live Amadeus Offers' : 'Waiting for Credentials',
          missingCredential: json?.missingCredential,
          message:
            json?.disclaimer ||
            'Live airline inventory requires FLIGHT_PROVIDER_API_KEY & FLIGHT_PROVIDER_API_SECRET. Zero fabricated ticket fares shown.',
          weather,
          matchedDestinations: findCatalogMatches(destCity),
          externalLinks: links,
        });
        return;
      }

      if (activeCategory === 'hotels' || activeCategory === 'homestays') {
        if (!stayCity.trim()) {
          setValidationError('Please enter a destination city for your stay search.');
          return;
        }
        if (checkOutDate <= checkInDate) {
          setValidationError('Check-out date must be after check-in date.');
          return;
        }

        const [apiRes, weather] = await Promise.all([
          fetch(
            `/api/travel?type=hotels&city=${encodeURIComponent(stayCity)}&checkIn=${encodeURIComponent(checkInDate)}&checkOut=${encodeURIComponent(checkOutDate)}&guests=${encodeURIComponent(guestsCount)}`
          ),
          fetchWeatherSafe(stayCity),
        ]);

        const json = await apiRes.json();
        setOutcome({
          category: activeCategory,
          title: `${activeCategory === 'homestays' ? 'Villas & Homestays' : 'Hotels'} in ${stayCity}`,
          subtitle: `${checkInDate} → ${checkOutDate} • ${roomsCount} Room(s), ${guestsCount} Guest(s)`,
          statusTag:
            json?.status === 'live_verified' ? 'Live Inventory' : 'Waiting for Credentials',
          missingCredential: json?.missingCredential,
          message:
            json?.disclaimer ||
            'Live hotel rates require HOTEL_PROVIDER_API_KEY. Browse matching TripSplit destinations and catalog stay estimates below.',
          weather,
          matchedDestinations: findCatalogMatches(stayCity),
          externalLinks: [
            {
              label: `Search ${stayCity} on Booking.com`,
              url: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(stayCity)}&checkin=${checkInDate}&checkout=${checkOutDate}`,
            },
          ],
        });
        return;
      }

      if (activeCategory === 'packages') {
        if (!pkgDest.trim()) {
          setValidationError('Please enter a destination for your holiday package.');
          return;
        }
        const matched = findCatalogMatches(pkgDest);
        setOutcome({
          category: 'packages',
          title: `${pkgDays}-Day ${pkgDest} Group Package Ideas`,
          subtitle: `${pkgTravellers} Travelers • Budget Cap ₹${Number(pkgBudget || 0).toLocaleString('en-IN')}`,
          statusTag: 'Catalog Packages Ready',
          message: `Matched destinations from TripSplit’s verified 60-city catalog with daily cost baselines and 3D previews. Click any card below to inspect 4 curated spots & launch 360° planning.`,
          weather: null,
          matchedDestinations: matched,
        });
        const weather = await fetchWeatherSafe(pkgDest);
        if (weather) {
          setOutcome((prev) => (prev && prev.category === 'packages' ? { ...prev, weather } : prev));
        }
        return;
      }

      if (activeCategory === 'trains' || activeCategory === 'buses' || activeCategory === 'cabs') {
        const origin =
          activeCategory === 'trains' ? trainFrom : activeCategory === 'buses' ? busSource : cabPickup;
        const destination =
          activeCategory === 'trains' ? trainTo : activeCategory === 'buses' ? busDest : cabDrop;

        if (!origin.trim() || !destination.trim()) {
          setValidationError('Please enter both origin and destination.');
          return;
        }

        const [route, weather] = await Promise.all([
          fetchRouteSafe(origin, destination),
          fetchWeatherSafe(destination),
        ]);

        const externalLinks =
          activeCategory === 'trains'
            ? [
                { label: 'Continue to IRCTC Rail Connect', url: 'https://www.irctc.co.in/nget/train-search' },
                {
                  label: 'Google Maps Transit',
                  url: `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=transit`,
                },
              ]
            : activeCategory === 'buses'
              ? [
                  { label: 'Continue to RedBus', url: 'https://www.redbus.in/' },
                  {
                    label: 'Google Maps Transit',
                    url: `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=transit`,
                  },
                ]
              : [
                  {
                    label: 'Open Driving Directions',
                    url: `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`,
                  },
                ];

        setOutcome({
          category: activeCategory,
          title: `${activeCategory === 'cabs' ? 'Cab Route' : activeCategory === 'trains' ? 'Rail Route' : 'Bus Route'}: ${origin} → ${destination}`,
          subtitle:
            activeCategory === 'trains'
              ? `Journey Date: ${trainDate}`
              : activeCategory === 'buses'
                ? `Travel Date: ${busDate}`
                : `Pickup: ${cabDateTime.replace('T', ' ')}`,
          statusTag: route ? `${route.distanceKm} km Route Estimate` : 'Official External Redirect',
          message:
            activeCategory === 'cabs'
              ? 'Road distance and indicative driving estimate from TripSplit Route Adapter. Live cab fleet pricing is not invented.'
              : 'Live rail/bus seat counts are queried externally via official booking providers ("Continue to provider to book").',
          route,
          weather,
          matchedDestinations: findCatalogMatches(destination),
          externalLinks,
        });
        return;
      }

      if (activeCategory === 'activities') {
        const matched = findCatalogMatches(activityQuery);
        setOutcome({
          category: 'activities',
          title: `Tours & Experiences: "${activityQuery || 'All Destinations'}"`,
          subtitle: `Matched across ${DESTINATIONS.length} cities (240+ curated sightseeing spots)`,
          statusTag: 'Catalog & 3D Previews Active',
          message:
            'Explore verified landmark tickets, timings, and 360° panoramas below, or connect GOOGLE_MAPS_API_KEY for live Google Places hours.',
          weather: null,
          matchedDestinations: matched,
        });
        const weather = matched[0] ? await fetchWeatherSafe(matched[0].name.split(',')[0]) : null;
        if (weather) {
          setOutcome((prev) => (prev && prev.category === 'activities' ? { ...prev, weather } : prev));
        }
      }
    } finally {
      setSearching(false);
    }
  };

  return (
    <section
      id="booking-search-panel"
      className="relative bg-gradient-to-b from-[#07152B] via-[#0F2749] to-[#F4F7FB] pb-12"
    >
      {/* Subtle Top Scenic Atmosphere Background */}
      <div className="relative pt-8 pb-24 sm:pb-28 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?auto=format&fit=crop&w=1800&q=80"
          alt="Himalayan travel skyline"
          fetchPriority="high"
          className="absolute inset-0 w-full h-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#07152B]/80 via-[#0E2444]/65 to-[#07152B]/90" />

        <div className="relative z-10 max-w-6xl mx-auto text-center sm:text-left flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6">
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
              Plan Destinations. Book Smart. Split Fairly.
            </h1>
            <p className="text-xs sm:text-sm text-sky-100/90 max-w-2xl">
              Search flights, stays, rail, buses, cabs &amp; curated Indian holiday packages — powered by live adapters, 360° city previews, and direct zero-float UPI splits.
            </p>
          </div>
          <Link
            href="/3d-experience"
            className="self-center sm:self-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/25 text-white text-xs font-bold transition-all shrink-0"
          >
            <Compass className="w-4 h-4 text-sky-300" />
            <span>Launch 360° Virtual Tour</span>
          </Link>
        </div>
      </div>

      {/* Overlapping Floating White Booking Search Card (MakeMyTrip inspired layout) */}
      <div className="relative z-20 max-w-6xl mx-auto px-3 sm:px-6 -mt-20">
        {/* Elevated Category Icons Pill Strip */}
        <div className="max-w-5xl mx-auto -mb-5 relative z-30 bg-white rounded-2xl shadow-lg border border-[#E5EAF1] px-2 sm:px-4 py-2 flex items-center justify-between gap-1 overflow-x-auto no-scrollbar">
          {PORTAL_NAV_CATEGORIES.map((cat) => {
            const Icon = TAB_ICONS[cat.id];
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                data-testid={`search-tab-${cat.id}`}
                onClick={() => {
                  onSelectCategory(cat.id);
                  setValidationError(null);
                  setOutcome(null);
                }}
                className={`relative shrink-0 flex flex-col items-center justify-center gap-1 px-3 sm:px-4 pt-2 pb-2 rounded-xl transition-all cursor-pointer min-w-[78px] ${
                  active
                    ? 'text-[#1666F2] bg-blue-50/70'
                    : 'text-[#475569] hover:text-[#172B4D] hover:bg-slate-50'
                }`}
              >
                <div className="h-3.5 flex items-center justify-center">
                  {cat.badge && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[8px] font-extrabold uppercase tracking-wider leading-none ${
                        cat.badge === 'Soon'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-[#1666F2] text-white'
                      }`}
                    >
                      {cat.badge}
                    </span>
                  )}
                </div>
                <Icon className="w-5 h-5" />
                <span className="text-[11px] font-bold whitespace-nowrap">{cat.shortLabel}</span>
                {active && (
                  <span className="w-6 h-0.5 rounded-full bg-[#1666F2] mt-0.5" />
                )}
              </button>
            );
          })}
        </div>

        {/* Main White Booking Input Card */}
        <form
          onSubmit={handleSearch}
          className="bg-white rounded-3xl shadow-xl border border-[#E5EAF1] pt-10 pb-10 px-4 sm:px-8 space-y-5"
        >
          {/* FLIGHTS FORM */}
          {activeCategory === 'flights' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4 text-xs font-bold">
                  {(
                    [
                      ['one_way', 'One Way'],
                      ['round_trip', 'Round Trip'],
                      ['multi_city', 'Multi City'],
                    ] as const
                  ).map(([val, label]) => (
                    <label key={val} className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="flightTripType"
                        checked={flightTripType === val}
                        onChange={() => setFlightTripType(val)}
                        className="accent-[#1666F2] w-3.5 h-3.5"
                      />
                      <span className={flightTripType === val ? 'text-[#1666F2]' : 'text-[#475569]'}>
                        {label}
                      </span>
                    </label>
                  ))}
                </div>
                <span className="text-[11px] font-medium text-[#64748B]">
                  Connected to Amadeus Flight Adapter (Live credentials or external fallback)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 rounded-2xl border border-[#DCE4EF] divide-y sm:divide-y-0 sm:divide-x divide-[#DCE4EF] bg-[#FAFCFF]">
                {/* From */}
                <div className="lg:col-span-3 p-3.5 relative">
                  <label htmlFor="flight-from" className="block text-[11px] font-semibold text-[#64748B] mb-1">
                    From
                  </label>
                  <select
                    id="flight-from"
                    value={flightFrom}
                    onChange={(e) => setFlightFrom(e.target.value)}
                    className="w-full text-base font-extrabold text-[#172B4D] bg-transparent outline-none cursor-pointer"
                  >
                    {QUICK_AIRPORT_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    aria-label="Swap Origin and Destination"
                    onClick={() => {
                      const prev = flightFrom;
                      setFlightFrom(flightTo);
                      setFlightTo(prev);
                    }}
                    className="hidden lg:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white border border-[#DCE4EF] shadow-sm items-center justify-center text-[#1666F2] hover:bg-blue-50 cursor-pointer"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* To */}
                <div className="lg:col-span-3 p-3.5 lg:pl-6">
                  <label htmlFor="flight-to" className="block text-[11px] font-semibold text-[#64748B] mb-1">
                    To
                  </label>
                  <select
                    id="flight-to"
                    value={flightTo}
                    onChange={(e) => setFlightTo(e.target.value)}
                    className="w-full text-base font-extrabold text-[#172B4D] bg-transparent outline-none cursor-pointer"
                  >
                    {QUICK_AIRPORT_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Departure */}
                <div className="lg:col-span-2 p-3.5">
                  <label htmlFor="flight-dep" className="block text-[11px] font-semibold text-[#64748B] mb-1">
                    Departure
                  </label>
                  <input
                    id="flight-dep"
                    type="date"
                    value={flightDepDate}
                    onChange={(e) => setFlightDepDate(e.target.value)}
                    className="w-full text-xs sm:text-sm font-bold text-[#172B4D] bg-transparent outline-none"
                  />
                </div>

                {/* Return */}
                <div className="lg:col-span-2 p-3.5">
                  <label htmlFor="flight-ret" className="block text-[11px] font-semibold text-[#64748B] mb-1">
                    Return
                  </label>
                  {flightTripType === 'one_way' ? (
                    <button
                      type="button"
                      onClick={() => setFlightTripType('round_trip')}
                      className="text-left text-xs text-[#94A3B8] hover:text-[#1666F2] font-medium cursor-pointer"
                    >
                      Tap to add return date
                    </button>
                  ) : (
                    <input
                      id="flight-ret"
                      type="date"
                      value={flightRetDate}
                      onChange={(e) => setFlightRetDate(e.target.value)}
                      className="w-full text-xs sm:text-sm font-bold text-[#172B4D] bg-transparent outline-none"
                    />
                  )}
                </div>

                {/* Travellers & Class */}
                <div className="lg:col-span-2 p-3.5">
                  <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                    Travellers &amp; Class
                  </label>
                  <div className="flex items-center gap-1.5">
                    <select
                      aria-label="Travellers"
                      value={flightTravellers}
                      onChange={(e) => setFlightTravellers(e.target.value)}
                      className="text-sm font-extrabold text-[#172B4D] bg-transparent outline-none cursor-pointer"
                    >
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={String(n)}>
                          {n} Pax
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Cabin Class"
                      value={flightClass}
                      onChange={(e) => setFlightClass(e.target.value)}
                      className="text-xs font-semibold text-[#475569] bg-transparent outline-none cursor-pointer min-w-0"
                    >
                      <option value="Economy">Economy</option>
                      <option value="Premium Economy">Prem. Eco</option>
                      <option value="Business">Business</option>
                    </select>
                  </div>
                </div>
              </div>

              {flightTripType === 'multi_city' && (
                <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 flex flex-wrap items-center gap-3 text-xs">
                  <span className="font-bold text-[#173B70]">Leg 2 Stopover:</span>
                  <span>{flightTo} →</span>
                  <select
                    aria-label="Multi-city second leg"
                    value={flightLeg2To}
                    onChange={(e) => setFlightLeg2To(e.target.value)}
                    className="px-2.5 py-1 rounded-lg border border-blue-200 bg-white font-bold text-[#172B4D]"
                  >
                    {QUICK_AIRPORT_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* HOTELS & HOMESTAYS FORM */}
          {(activeCategory === 'hotels' || activeCategory === 'homestays') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 rounded-2xl border border-[#DCE4EF] divide-y sm:divide-y-0 sm:divide-x divide-[#DCE4EF] bg-[#FAFCFF]">
              <div className="lg:col-span-4 p-3.5">
                <label htmlFor="stay-city" className="block text-[11px] font-semibold text-[#64748B] mb-1">
                  Destination ({activeCategory === 'homestays' ? 'Villas & Homestays' : 'City or Property Area'})
                </label>
                <input
                  id="stay-city"
                  list="portal-city-list"
                  value={stayCity}
                  onChange={(e) => setStayCity(e.target.value)}
                  placeholder="Search city e.g. Manali, Udaipur, Goa"
                  className="w-full text-base font-extrabold text-[#172B4D] bg-transparent outline-none"
                />
              </div>

              <div className="lg:col-span-3 p-3.5">
                <label htmlFor="stay-checkin" className="block text-[11px] font-semibold text-[#64748B] mb-1">
                  Check-in
                </label>
                <input
                  id="stay-checkin"
                  type="date"
                  value={checkInDate}
                  onChange={(e) => setCheckInDate(e.target.value)}
                  className="w-full text-sm font-bold text-[#172B4D] bg-transparent outline-none"
                />
              </div>

              <div className="lg:col-span-3 p-3.5">
                <label htmlFor="stay-checkout" className="block text-[11px] font-semibold text-[#64748B] mb-1">
                  Check-out
                </label>
                <input
                  id="stay-checkout"
                  type="date"
                  value={checkOutDate}
                  onChange={(e) => setCheckOutDate(e.target.value)}
                  className="w-full text-sm font-bold text-[#172B4D] bg-transparent outline-none"
                />
              </div>

              <div className="lg:col-span-2 p-3.5">
                <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                  Rooms &amp; Guests
                </label>
                <div className="flex items-center gap-2 text-xs font-bold text-[#172B4D]">
                  <select
                    aria-label="Rooms"
                    value={roomsCount}
                    onChange={(e) => setRoomsCount(e.target.value)}
                    className="bg-transparent outline-none"
                  >
                    {[1, 2, 3, 4].map((r) => (
                      <option key={r} value={String(r)}>
                        {r} Rm
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Guests"
                    value={guestsCount}
                    onChange={(e) => setGuestsCount(e.target.value)}
                    className="bg-transparent outline-none"
                  >
                    {[1, 2, 3, 4, 6, 8].map((g) => (
                      <option key={g} value={String(g)}>
                        {g} Guests
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* HOLIDAY PACKAGES FORM */}
          {activeCategory === 'packages' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 rounded-2xl border border-[#DCE4EF] divide-y sm:divide-y-0 sm:divide-x divide-[#DCE4EF] bg-[#FAFCFF]">
              <div className="lg:col-span-4 p-3.5">
                <label htmlFor="pkg-dest" className="block text-[11px] font-semibold text-[#64748B] mb-1">
                  Holiday Destination
                </label>
                <input
                  id="pkg-dest"
                  list="portal-city-list"
                  value={pkgDest}
                  onChange={(e) => setPkgDest(e.target.value)}
                  placeholder="Manali, Goa, Munnar, Jaipur..."
                  className="w-full text-base font-extrabold text-[#172B4D] bg-transparent outline-none"
                />
              </div>
              <div className="lg:col-span-3 p-3.5">
                <label htmlFor="pkg-days" className="block text-[11px] font-semibold text-[#64748B] mb-1">
                  Duration
                </label>
                <select
                  id="pkg-days"
                  value={pkgDays}
                  onChange={(e) => setPkgDays(e.target.value)}
                  className="w-full text-sm font-bold text-[#172B4D] bg-transparent outline-none"
                >
                  {[2, 3, 4, 5, 6, 7].map((d) => (
                    <option key={d} value={String(d)}>
                      {d} Days / {d - 1} Nights
                    </option>
                  ))}
                </select>
              </div>
              <div className="lg:col-span-2 p-3.5">
                <label htmlFor="pkg-pax" className="block text-[11px] font-semibold text-[#64748B] mb-1">
                  Travellers
                </label>
                <select
                  id="pkg-pax"
                  value={pkgTravellers}
                  onChange={(e) => setPkgTravellers(e.target.value)}
                  className="w-full text-sm font-bold text-[#172B4D] bg-transparent outline-none"
                >
                  {[1, 2, 3, 4, 6, 8, 10].map((p) => (
                    <option key={p} value={String(p)}>
                      {p} Travellers
                    </option>
                  ))}
                </select>
              </div>
              <div className="lg:col-span-3 p-3.5">
                <label htmlFor="pkg-budget" className="block text-[11px] font-semibold text-[#64748B] mb-1">
                  Group Budget Target (₹)
                </label>
                <input
                  id="pkg-budget"
                  type="number"
                  min={2000}
                  step={1000}
                  value={pkgBudget}
                  onChange={(e) => setPkgBudget(e.target.value)}
                  className="w-full text-sm font-extrabold text-[#172B4D] num-inr bg-transparent outline-none"
                />
              </div>
            </div>
          )}

          {/* TRAINS FORM */}
          {activeCategory === 'trains' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 rounded-2xl border border-[#DCE4EF] divide-y sm:divide-y-0 sm:divide-x divide-[#DCE4EF] bg-[#FAFCFF]">
              <div className="p-3.5">
                <label htmlFor="train-from" className="block text-[11px] font-semibold text-[#64748B] mb-1">
                  From Station / City
                </label>
                <input
                  id="train-from"
                  value={trainFrom}
                  onChange={(e) => setTrainFrom(e.target.value)}
                  className="w-full text-base font-extrabold text-[#172B4D] bg-transparent outline-none"
                />
              </div>
              <div className="p-3.5">
                <label htmlFor="train-to" className="block text-[11px] font-semibold text-[#64748B] mb-1">
                  To Station / City
                </label>
                <input
                  id="train-to"
                  list="portal-city-list"
                  value={trainTo}
                  onChange={(e) => setTrainTo(e.target.value)}
                  className="w-full text-base font-extrabold text-[#172B4D] bg-transparent outline-none"
                />
              </div>
              <div className="p-3.5">
                <label htmlFor="train-date" className="block text-[11px] font-semibold text-[#64748B] mb-1">
                  Journey Date
                </label>
                <input
                  id="train-date"
                  type="date"
                  value={trainDate}
                  onChange={(e) => setTrainDate(e.target.value)}
                  className="w-full text-sm font-bold text-[#172B4D] bg-transparent outline-none"
                />
              </div>
            </div>
          )}

          {/* BUSES FORM */}
          {activeCategory === 'buses' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 rounded-2xl border border-[#DCE4EF] divide-y sm:divide-y-0 sm:divide-x divide-[#DCE4EF] bg-[#FAFCFF]">
              <div className="p-3.5">
                <label htmlFor="bus-src" className="block text-[11px] font-semibold text-[#64748B] mb-1">
                  Source City
                </label>
                <input
                  id="bus-src"
                  value={busSource}
                  onChange={(e) => setBusSource(e.target.value)}
                  className="w-full text-base font-extrabold text-[#172B4D] bg-transparent outline-none"
                />
              </div>
              <div className="p-3.5">
                <label htmlFor="bus-dest" className="block text-[11px] font-semibold text-[#64748B] mb-1">
                  Destination City
                </label>
                <input
                  id="bus-dest"
                  list="portal-city-list"
                  value={busDest}
                  onChange={(e) => setBusDest(e.target.value)}
                  className="w-full text-base font-extrabold text-[#172B4D] bg-transparent outline-none"
                />
              </div>
              <div className="p-3.5">
                <label htmlFor="bus-date" className="block text-[11px] font-semibold text-[#64748B] mb-1">
                  Travel Date
                </label>
                <input
                  id="bus-date"
                  type="date"
                  value={busDate}
                  onChange={(e) => setBusDate(e.target.value)}
                  className="w-full text-sm font-bold text-[#172B4D] bg-transparent outline-none"
                />
              </div>
            </div>
          )}

          {/* CABS FORM */}
          {activeCategory === 'cabs' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 rounded-2xl border border-[#DCE4EF] divide-y sm:divide-y-0 sm:divide-x divide-[#DCE4EF] bg-[#FAFCFF]">
              <div className="p-3.5">
                <label htmlFor="cab-pickup" className="block text-[11px] font-semibold text-[#64748B] mb-1">
                  Pickup Location
                </label>
                <input
                  id="cab-pickup"
                  value={cabPickup}
                  onChange={(e) => setCabPickup(e.target.value)}
                  className="w-full text-base font-extrabold text-[#172B4D] bg-transparent outline-none"
                />
              </div>
              <div className="p-3.5">
                <label htmlFor="cab-drop" className="block text-[11px] font-semibold text-[#64748B] mb-1">
                  Drop Destination
                </label>
                <input
                  id="cab-drop"
                  list="portal-city-list"
                  value={cabDrop}
                  onChange={(e) => setCabDrop(e.target.value)}
                  className="w-full text-base font-extrabold text-[#172B4D] bg-transparent outline-none"
                />
              </div>
              <div className="p-3.5">
                <label htmlFor="cab-dt" className="block text-[11px] font-semibold text-[#64748B] mb-1">
                  Pickup Date &amp; Time
                </label>
                <input
                  id="cab-dt"
                  type="datetime-local"
                  value={cabDateTime}
                  onChange={(e) => setCabDateTime(e.target.value)}
                  className="w-full text-xs sm:text-sm font-bold text-[#172B4D] bg-transparent outline-none"
                />
              </div>
            </div>
          )}

          {/* ACTIVITIES FORM */}
          {activeCategory === 'activities' && (
            <div className="rounded-2xl border border-[#DCE4EF] p-4 bg-[#FAFCFF]">
              <label htmlFor="act-query" className="block text-[11px] font-semibold text-[#64748B] mb-1">
                Search Sightseeing, Temples, Treks, Lakes, or Cities (60 Destinations)
              </label>
              <input
                id="act-query"
                value={activityQuery}
                onChange={(e) => setActivityQuery(e.target.value)}
                placeholder="Search Manali, Waterfalls, Forts, Beaches..."
                className="w-full text-base font-extrabold text-[#172B4D] bg-transparent outline-none"
              />
            </div>
          )}

          {/* INSURANCE COMING SOON INFO */}
          {activeCategory === 'insurance' && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-amber-900">
                  <ShieldCheck className="w-4 h-4 text-amber-700" />
                  Travel Insurance Integration — Coming Soon
                </span>
                <p className="text-xs text-amber-800">
                  Policy underwriting requires an authorized insurer API integration. No synthetic insurance policies are sold on TripSplitter.
                </p>
              </div>
              <a
                href="tel:1363"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-amber-300 text-xs font-bold text-amber-900 shrink-0"
              >
                <PhoneCall className="w-3.5 h-3.5" /> 24x7 Tourist Helpline: 1363
              </a>
            </div>
          )}

          {validationError && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800 flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          <datalist id="portal-city-list">
            {citySuggestions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>

          {/* Centered Floating Action Search Button */}
          <div className="flex justify-center pt-1">
            <button
              type="submit"
              disabled={searching}
              data-testid="hero-search-submit"
              className="inline-flex items-center justify-center gap-2 px-12 py-3.5 rounded-full bg-gradient-to-r from-[#1666F2] via-[#1D4ED8] to-[#0EA5E9] hover:opacity-95 text-white font-extrabold text-sm tracking-wide shadow-lg hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer"
            >
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>
                {activeCategory === 'insurance'
                  ? 'VIEW SAFETY HELPLINES'
                  : `SEARCH ${activeCategory.toUpperCase()}`}
              </span>
            </button>
          </div>
        </form>

        {/* Bottom Utility Strip ("Explore More" from reference image #1) */}
        <div className="max-w-4xl mx-auto mt-4 bg-white rounded-2xl shadow-md border border-[#E5EAF1] px-4 py-3 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
          <Link
            href="/3d-experience"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-[#F4F7FB] font-bold text-[#172B4D] transition-colors"
          >
            <Compass className="w-4 h-4 text-[#1666F2] shrink-0" />
            <span className="truncate">3D Travel HQ</span>
          </Link>
          <Link
            href="/explore"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-[#F4F7FB] font-bold text-[#172B4D] transition-colors"
          >
            <Globe className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="truncate">60 Destinations</span>
          </Link>
          <Link
            href="/ai-assistant"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-[#F4F7FB] font-bold text-[#172B4D] transition-colors"
          >
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="truncate">AI Planner</span>
          </Link>
          <Link
            href="/qr-split"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-[#F4F7FB] font-bold text-[#172B4D] transition-colors"
          >
            <QrCode className="w-4 h-4 text-[#173B70] shrink-0" />
            <span className="truncate">Direct UPI Split</span>
          </Link>
          <Link
            href="/dashboard"
            className="col-span-2 sm:col-span-1 flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-[#F4F7FB] font-bold text-[#172B4D] transition-colors"
          >
            <Wallet className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="truncate">Expense HQ</span>
          </Link>
        </div>

        {/* Dynamic Live Search Result Panel */}
        {outcome && (
          <div
            data-testid="booking-search-results"
            className="mt-5 bg-white rounded-3xl border border-[#DCE4EF] shadow-lg p-5 sm:p-6 space-y-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-extrabold text-[#172B4D]">{outcome.title}</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-[#1666F2] border border-blue-200">
                    {outcome.statusTag}
                  </span>
                </div>
                <p className="text-xs text-[#64748B] mt-0.5">{outcome.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setOutcome(null)}
                aria-label="Close Search Results"
                className="p-1.5 rounded-lg hover:bg-slate-100 text-[#64748B] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-[#334155] leading-relaxed">{outcome.message}</p>

            {outcome.missingCredential && (
              <p className="text-[11px] font-mono bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 rounded-xl inline-block">
                Missing deployment credential: {outcome.missingCredential}
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {outcome.route && (
                <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                  <p className="text-xs font-bold text-[#173B70]">Route &amp; Driving Estimate</p>
                  <p className="text-sm font-extrabold text-[#172B4D] num-inr">
                    ~{outcome.route.distanceKm} km • ~
                    {Math.round((outcome.route.durationMinutes / 60) * 10) / 10} hrs
                  </p>
                  <p className="text-[11px] text-[#64748B]">Source: {outcome.route.source}</p>
                </div>
              )}

              {outcome.weather && (
                <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200/80 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-sky-900 flex items-center gap-1">
                      <CloudSun className="w-4 h-4 text-sky-600" /> {outcome.weather.city} Weather
                    </p>
                    <p className="text-[11px] text-[#64748B]">
                      {outcome.weather.source} • Wind {outcome.weather.windKmh} km/h
                    </p>
                  </div>
                  <span className="text-xl font-extrabold text-[#173B70] num-inr">
                    {outcome.weather.temperatureC}°C
                  </span>
                </div>
              )}
            </div>

            {outcome.externalLinks && outcome.externalLinks.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {outcome.externalLinks.map((lnk) => (
                  <a
                    key={lnk.url}
                    href={lnk.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#173B70] hover:bg-[#1666F2] text-white text-xs font-bold transition-colors"
                  >
                    {lnk.label} <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ))}
              </div>
            )}

            {outcome.matchedDestinations && outcome.matchedDestinations.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-[#E5EAF1]">
                <p className="text-xs font-bold text-[#172B4D]">
                  Related Verified Catalog Destinations
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {outcome.matchedDestinations.map((dest) => (
                    <Link
                      key={dest.id}
                      href={`/destinations/${dest.id}`}
                      className="group rounded-2xl border border-[#E5EAF1] bg-[#FAFCFF] overflow-hidden hover:shadow-md transition-all"
                    >
                      <div className="h-24 bg-slate-100 overflow-hidden">
                        <img
                          src={dest.heroImage}
                          alt={dest.name}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <div className="p-2.5">
                        <p className="text-xs font-bold text-[#172B4D] truncate">{dest.name}</p>
                        <p className="text-[11px] text-[#64748B] flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 shrink-0" /> {dest.spots.length} curated spots
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
