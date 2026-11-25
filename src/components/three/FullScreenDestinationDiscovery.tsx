'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  Mic,
  MicOff,
  MapPin,
  ArrowRight,
  Eye,
  Volume2,
  VolumeX,
  X,
  Clock,
  Sparkles,
  Check,
  Compass,
  Wallet,
} from 'lucide-react';
import { useTrip3DStore } from '@/store/useTrip3DStore';
import { DESTINATIONS, Destination } from '@/data/destinations';

const REGIONS = ['All', 'North', 'South', 'West', 'East', 'Central', 'Northeast'] as const;
type RegionFilter = (typeof REGIONS)[number];

// Hinglish & cultural keyword expansion so Hindi/Hinglish search queries match Indian cities naturally
const HINGLISH_KEYWORDS: Record<string, string[]> = {
  kashi: ['varanasi'],
  banaras: ['varanasi'],
  benaras: ['varanasi'],
  dilli: ['delhi'],
  pahad: ['manali', 'shimla', 'mussoorie', 'nainital', 'darjeeling', 'leh', 'gangtok', 'munnar', 'ooty', 'dharamshala', 'spiti'],
  snow: ['manali', 'shimla', 'gulmarg', 'leh', 'auli', 'spiti', 'tawang'],
  barf: ['manali', 'shimla', 'gulmarg', 'leh', 'auli', 'spiti', 'tawang'],
  samundar: ['goa', 'gokarna', 'andaman', 'pondicherry', 'varkala', 'kovalam', 'alleppey', 'puri'],
  beach: ['goa', 'gokarna', 'andaman', 'pondicherry', 'varkala', 'kovalam', 'puri', 'diu'],
  mandir: ['varanasi', 'tirupati', 'madurai', 'khajuraho', 'rishikesh', 'haridwar', 'dwarka', 'somnath', 'puri', 'amritsar'],
  temple: ['varanasi', 'tirupati', 'madurai', 'khajuraho', 'rishikesh', 'haridwar', 'dwarka', 'somnath', 'hampi', 'konark'],
  kila: ['jaipur', 'jodhpur', 'jaisalmer', 'udaipur', 'chittorgarh', 'gwalior', 'agra'],
  fort: ['jaipur', 'jodhpur', 'jaisalmer', 'udaipur', 'chittorgarh', 'gwalior', 'agra'],
  mahal: ['jaipur', 'agra', 'udaipur', 'mysore'],
  lake: ['udaipur', 'nainital', 'bhopal', 'srinagar', 'alleppey'],
  jheel: ['udaipur', 'nainital', 'srinagar'],
  chai: ['darjeeling', 'munnar', 'assam', 'kaziranga'],
  tea: ['darjeeling', 'munnar', 'coorg'],
  backwater: ['alleppey', 'kochi', 'kumarakom'],
  desert: ['jaisalmer', 'bikaner', 'pushkar', 'kutch'],
  registan: ['jaisalmer', 'bikaner', 'kutch'],
  yoga: ['rishikesh', 'haridwar', 'mysore'],
  ganga: ['varanasi', 'rishikesh', 'haridwar'],
  waterfall: ['shillong', 'cherrapunji', 'athirappilly', 'lonavala', 'dudhsagar'],
  jharna: ['shillong', 'cherrapunji', 'lonavala'],
};

function getStateAbbreviation(state: string): string {
  const map: Record<string, string> = {
    'Himachal Pradesh': 'HP',
    Rajasthan: 'RJ',
    Goa: 'GA',
    'Uttar Pradesh': 'UP',
    Uttarakhand: 'UK',
    'West Bengal': 'WB',
    Kerala: 'KL',
    Karnataka: 'KA',
    Punjab: 'PB',
    'Tamil Nadu': 'TN',
    Maharashtra: 'MH',
    Gujarat: 'GJ',
    'Madhya Pradesh': 'MP',
    Odisha: 'OD',
    Assam: 'AS',
    Meghalaya: 'ML',
    Sikkim: 'SK',
    'Arunachal Pradesh': 'AR',
    Ladakh: 'LA',
    'Jammu and Kashmir': 'JK',
    'Jammu & Kashmir': 'JK',
    Delhi: 'DL',
    Puducherry: 'PY',
    'Andaman and Nicobar Islands': 'AN',
    'Andhra Pradesh': 'AP',
    Telangana: 'TS',
    Bihar: 'BR',
    Jharkhand: 'JH',
    Chhattisgarh: 'CG',
    Tripura: 'TR',
    Manipur: 'MN',
    Nagaland: 'NL',
    Mizoram: 'MZ',
  };
  return (
    map[state] ||
    state
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
  );
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function DestinationCardImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-amber-600/40 via-slate-800 to-indigo-900/60 flex items-center justify-center">
        <Compass className="w-10 h-10 text-amber-300/60" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
    />
  );
}

export function FullScreenDestinationDiscovery() {
  const {
    stage,
    setStage,
    selectedCityId,
    setSelectedCityId,
    destinationIntroOpen,
    setDestinationIntroOpen,
    getSelectedCity,
    getTotalItemsCount,
    isAudioEnabled,
    toggleAudio,
  } = useTrip3DStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<RegionFilter>('All');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState<'hi-IN' | 'en-IN'>('hi-IN');
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  const selectedCity = getSelectedCity();
  const totalItemsCount = getTotalItemsCount();

  // Close autocomplete on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setShowAutocomplete(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Stop voice recognition on unmount
  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
    };
  }, []);

  const filteredDestinations = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const expandedIds = new Set<string>();
    if (q) {
      for (const [alias, ids] of Object.entries(HINGLISH_KEYWORDS)) {
        if (q.includes(alias) || alias.includes(q)) {
          ids.forEach((id) => expandedIds.add(id));
        }
      }
    }

    return DESTINATIONS.filter((d) => {
      const matchesRegion = selectedRegion === 'All' || d.region === selectedRegion;
      if (!matchesRegion) return false;
      if (!q) return true;

      return (
        d.name.toLowerCase().includes(q) ||
        d.state.toLowerCase().includes(q) ||
        d.region.toLowerCase().includes(q) ||
        d.tagline.toLowerCase().includes(q) ||
        expandedIds.has(d.id) ||
        d.spots.some(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.subtitle.toLowerCase().includes(q) ||
            s.category.toLowerCase().includes(q)
        )
      );
    });
  }, [searchQuery, selectedRegion]);

  const autocompleteMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return filteredDestinations.slice(0, 6);
  }, [searchQuery, filteredDestinations]);

  const handleToggleVoiceSearch = () => {
    setVoiceError(null);
    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) {
      setVoiceError('Voice search works in Chrome/Edge browsers.');
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.lang = voiceLang;
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (ev) => {
        const transcript = ev.results?.[0]?.[0]?.transcript || '';
        if (transcript) {
          setSearchQuery(transcript.trim());
          setShowAutocomplete(true);
        }
      };
      rec.onerror = () => {
        setIsListening(false);
        setVoiceError('Could not hear clear speech. Please allow microphone access.');
      };
      rec.onend = () => {
        setIsListening(false);
      };
      recognitionRef.current = rec;
      setIsListening(true);
      rec.start();
    } catch {
      setIsListening(false);
      setVoiceError('Microphone could not be started.');
    }
  };

  const handleSelectCity = (city: Destination) => {
    setSelectedCityId(city.id);
    setShowAutocomplete(false);
    setDestinationIntroOpen(true);
  };

  const handleLaunchTour = () => {
    setDestinationIntroOpen(false);
    setStage('virtual-tour');
  };

  return (
    <div
      data-testid="fullscreen-destination-discovery"
      className="w-screen h-screen overflow-y-auto bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col"
    >
      {/* 1. TOP APPLICATION HEADER */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-4 w-full px-4 sm:px-6 lg:px-10 py-3.5 bg-slate-950/90 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="cursor-pointer flex items-center gap-2.5 px-3.5 py-1.5 rounded-2xl bg-white text-slate-900 shadow-lg hover:bg-slate-100 transition-all"
          >
            <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-600 flex items-center justify-center text-white font-black text-sm">
              <span>₹</span>
            </div>
            <span className="font-extrabold text-sm tracking-tight">TripSplit</span>
          </Link>

          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300">
            <span>Stage 2:</span>
            <span className="font-bold text-amber-400">Destination Discovery</span>
          </div>
        </div>

        {/* Stage Progress Pills */}
        <div className="hidden lg:flex items-center gap-1.5 p-1 rounded-2xl bg-white/5 border border-white/10 text-xs">
          {[
            { key: 'entrance', label: '1. Welcome' },
            { key: 'desk', label: '2. Destination' },
            { key: 'virtual-tour', label: '3. 360° Tour' },
            { key: 'bill', label: '4. Split Bill' },
          ].map((step) => {
            const isCurrent = stage === step.key;
            return (
              <button
                key={step.key}
                type="button"
                onClick={() => setStage(step.key as 'entrance' | 'desk' | 'virtual-tour' | 'bill')}
                className={`cursor-pointer px-3.5 py-1.5 rounded-xl font-bold transition-all ${
                  isCurrent
                    ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/40'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                {step.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStage('bill')}
            className="cursor-pointer flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-extrabold text-xs shadow-lg"
          >
            <span>Split Bill ({totalItemsCount})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={toggleAudio}
            className="cursor-pointer p-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white transition-all"
            title={isAudioEnabled ? 'Mute Guide Voice' : 'Unmute Guide Voice'}
          >
            {isAudioEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <Link
            href="/trips"
            className="cursor-pointer hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white"
          >
            Dashboard
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* 2. FULL-SCREEN HERO HEADER + PROMINENT SEARCH BAR */}
      <section className="w-full px-4 sm:px-6 lg:px-10 pt-6 pb-4">
        <div className="w-full flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-5">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
              Where do you want to explore?
            </h1>
            <p className="text-sm sm:text-base text-slate-300 mt-1">
              Discover amazing destinations across India.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <span className="px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-300 text-xs sm:text-sm font-bold">
              {filteredDestinations.length} of {DESTINATIONS.length} Destinations
            </span>
            <button
              type="button"
              onClick={() => setDestinationIntroOpen(true)}
              className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/30 text-xs sm:text-sm font-bold transition-all"
            >
              <MapPin className="w-4 h-4 text-emerald-400" />
              <span>Selected: {selectedCity.name}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Full-Width Prominent Search Bar with Microphone Button INSIDE */}
        <div ref={searchWrapperRef} className="relative w-full mb-4">
          <div className="relative flex items-center w-full rounded-2xl bg-slate-900/90 border border-white/20 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-500/30 shadow-2xl transition-all">
            <Search className="w-5 h-5 text-slate-400 ml-4 shrink-0 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setShowAutocomplete(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowAutocomplete(true);
              }}
              placeholder="Search cities, states, monuments or Hinglish keywords (e.g. Manali, Jaipur, Kashi, Pahad, Beach)..."
              className="w-full px-3.5 py-3.5 sm:py-4 bg-transparent text-sm sm:text-base text-white placeholder-slate-400 focus:outline-none"
            />

            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="cursor-pointer p-2 text-slate-400 hover:text-white transition-colors"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Voice Search Language Toggle + Microphone Inside Search Bar */}
            <div className="flex items-center gap-1.5 pr-2.5 pl-1 shrink-0">
              <button
                type="button"
                onClick={() => setVoiceLang((prev) => (prev === 'hi-IN' ? 'en-IN' : 'hi-IN'))}
                className="cursor-pointer px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-bold text-slate-200 border border-white/10"
                title="Switch voice search language (Hindi / English)"
              >
                {voiceLang === 'hi-IN' ? 'हिं' : 'EN'}
              </button>
              <button
                type="button"
                onClick={handleToggleVoiceSearch}
                aria-label="Voice search destination"
                className={`cursor-pointer p-2.5 rounded-xl transition-all flex items-center gap-1.5 ${
                  isListening
                    ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/40'
                    : 'bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-white border border-amber-500/30'
                }`}
                title={isListening ? 'Stop voice search' : `Speak destination in ${voiceLang === 'hi-IN' ? 'Hindi' : 'English'}`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {voiceError && (
            <p className="text-xs text-amber-300 mt-1.5 pl-2">{voiceError}</p>
          )}

          {/* Autocomplete Suggestions Dropdown */}
          {showAutocomplete && autocompleteMatches.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-2 z-40 rounded-2xl bg-slate-900 border border-white/20 shadow-2xl overflow-hidden divide-y divide-white/10">
              {autocompleteMatches.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectCity(item)}
                  className="cursor-pointer w-full px-4 py-3 flex items-center justify-between gap-4 hover:bg-white/10 text-left transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{item.name}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {item.spots.map((s) => s.name).join(' • ')}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-amber-300 shrink-0">{item.region}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 3. FULL-WIDTH REGION FILTERS */}
        <div className="flex items-center gap-2 w-full overflow-x-auto pb-1">
          {REGIONS.map((region) => {
            const count =
              region === 'All'
                ? DESTINATIONS.length
                : DESTINATIONS.filter((d) => d.region === region).length;
            const active = selectedRegion === region;
            return (
              <button
                key={region}
                type="button"
                onClick={() => setSelectedRegion(region)}
                className={`cursor-pointer px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                  active
                    ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                    : 'bg-white/5 text-slate-300 hover:text-white hover:bg-white/15 border border-white/10'
                }`}
              >
                <span>{region}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                    active ? 'bg-black/25 text-white' : 'bg-white/10 text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 4. SPACIOUS FULL-SCREEN MULTI-COLUMN DESTINATION GRID (NO NESTED SCROLLBAR) */}
      <main className="w-full px-4 sm:px-6 lg:px-10 pb-14 flex-1">
        {filteredDestinations.length === 0 ? (
          <div className="w-full py-20 text-center rounded-3xl bg-white/5 border border-white/10">
            <Compass className="w-12 h-12 text-amber-400 mx-auto mb-3 opacity-80" />
            <h2 className="text-xl font-bold text-white mb-1">No matching destinations found</h2>
            <p className="text-sm text-slate-400 mb-4">
              Try clearing your search or switching back to All regions.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedRegion('All');
              }}
              className="cursor-pointer px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-bold text-sm"
            >
              Show All {DESTINATIONS.length} Cities
            </button>
          </div>
        ) : (
          <div
            data-testid="destination-full-grid"
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-5 w-full"
          >
            {filteredDestinations.map((dest) => {
              const isSelected = dest.id === selectedCityId;
              const cityOnlyName = dest.name.split(',')[0].trim();
              const stateAbbr = getStateAbbreviation(dest.state);

              return (
                <button
                  key={dest.id}
                  type="button"
                  onClick={() => handleSelectCity(dest)}
                  className={`group cursor-pointer text-left rounded-2xl overflow-hidden flex flex-col transition-all duration-200 border ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-400 ring-2 ring-amber-400/60 shadow-2xl shadow-amber-500/20 -translate-y-0.5'
                      : 'bg-slate-900/80 border-white/10 hover:border-amber-400/60 hover:bg-slate-800/90 hover:-translate-y-1 shadow-xl'
                  }`}
                >
                  {/* Card Photo Header */}
                  <div className="relative w-full h-36 sm:h-40 overflow-hidden bg-slate-800">
                    <DestinationCardImage src={dest.heroImage} alt={dest.name} />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent" />

                    <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-black/60 backdrop-blur-md text-slate-100 border border-white/15">
                        {dest.region}
                      </span>
                      {isSelected && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-500 text-white flex items-center gap-1 shadow">
                          <Check className="w-3 h-3 stroke-[3]" />
                          Selected
                        </span>
                      )}
                    </div>

                    <div className="absolute bottom-2.5 left-3 right-3 flex items-end justify-between gap-2">
                      <div>
                        <h3 className="text-lg font-black text-white leading-snug tracking-tight">
                          {cityOnlyName}
                        </h3>
                        <p className="text-xs font-semibold text-amber-300">
                          {dest.state} • {stateAbbr}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Card Details Body */}
                  <div className="p-3.5 flex-1 flex flex-col justify-between gap-2.5">
                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                      {dest.tagline}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
                      <span className="text-slate-300 font-semibold">
                        {dest.spots.length} Spots • From ₹{dest.startingPrice.toLocaleString('en-IN')}
                      </span>
                      <span className="text-amber-400 font-bold inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        Explore
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>

      {/* 5. DESTINATION INTRODUCTION, IMAGES, EXPENSES & 360° LAUNCH VIEW */}
      {destinationIntroOpen && (
        <div
          data-testid="destination-intro-modal"
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xl overflow-y-auto p-4 sm:p-8 flex items-center justify-center"
        >
          <div className="w-full max-w-5xl rounded-3xl bg-slate-900 border border-white/20 shadow-2xl overflow-hidden my-auto">
            {/* Hero Banner */}
            <div className="relative h-56 sm:h-72 w-full bg-slate-800">
              <DestinationCardImage src={selectedCity.heroImage} alt={selectedCity.name} />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />

              <button
                type="button"
                onClick={() => setDestinationIntroOpen(false)}
                className="cursor-pointer absolute top-4 right-4 px-3.5 py-2 rounded-xl bg-black/60 hover:bg-black/80 border border-white/20 text-xs font-bold text-white flex items-center gap-1.5"
              >
                <X className="w-4 h-4" />
                Back to Destinations
              </button>

              <div className="absolute bottom-5 left-6 right-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500 text-white text-xs font-extrabold mb-2">
                    <Sparkles className="w-3.5 h-3.5" />
                    {selectedCity.region} India • {selectedCity.state}
                  </span>
                  <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                    {selectedCity.name}
                  </h2>
                  <p className="text-sm text-amber-200 font-semibold mt-0.5">{selectedCity.tagline}</p>
                </div>

                <button
                  type="button"
                  onClick={handleLaunchTour}
                  className="cursor-pointer inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-extrabold text-sm shadow-xl shadow-orange-500/30 transition-all hover:scale-[1.02]"
                >
                  <Eye className="w-4 h-4" />
                  Launch 360° Virtual Tour
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body: Overview + 4 Famous Spots + Relevant Expenses */}
            <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-5">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400 mb-1.5">
                    Destination Overview
                  </h3>
                  <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
                    {selectedCity.description}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400 mb-3">
                    4 Included 360° Tour Spots
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedCity.spots.map((spot, idx) => (
                      <div
                        key={spot.id}
                        className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[11px] font-bold text-amber-400">
                              Spot {idx + 1} • {spot.category}
                            </span>
                            <h4 className="text-sm font-extrabold text-white">{spot.name}</h4>
                          </div>
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-bold shrink-0">
                            {spot.cost > 0 ? `₹${spot.cost}` : 'Free'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">{spot.subtitle}</p>
                        <div className="flex items-center gap-3 text-[11px] text-slate-300 pt-1">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-400" />
                            {spot.duration}
                          </span>
                          <span>Best: {spot.bestTime}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Relevant City Expense Estimate Sidebar inside Intro Modal */}
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Wallet className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-white">
                      {selectedCity.name.split(',')[0]} Expense Guide
                    </h3>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10">
                      <div>
                        <p className="font-bold text-white">Sightseeing Passes</p>
                        <p className="text-slate-400">{selectedCity.spots.length} Spots Included</p>
                      </div>
                      <span className="font-black text-emerald-400">
                        ₹
                        {selectedCity.spots
                          .reduce((acc, s) => acc + s.cost, 0)
                          .toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10">
                      <div>
                        <p className="font-bold text-white">Local Stays Estimate</p>
                        <p className="text-slate-400">{selectedCity.name.split(',')[0]} Resorts & Hostels</p>
                      </div>
                      <span className="font-bold text-slate-200">
                        From ₹{selectedCity.startingPrice.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10">
                      <div>
                        <p className="font-bold text-white">Local Transport</p>
                        <p className="text-slate-400">{selectedCity.spots[0]?.name} Route</p>
                      </div>
                      <span className="font-bold text-sky-300">Split Ready</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={handleLaunchTour}
                    className="cursor-pointer w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg"
                  >
                    <Eye className="w-4 h-4" />
                    Start 360° Tour with AI Guide
                  </button>
                  <button
                    type="button"
                    onClick={() => setStage('bill')}
                    className="cursor-pointer w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 font-bold text-xs"
                  >
                    Go to Split Bill Calculator →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
