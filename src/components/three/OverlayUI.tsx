'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import {
  Compass,
  Volume2,
  VolumeX,
  ArrowRight,
  ArrowLeft,
  Users,
  CheckCircle2,
  Sparkles,
  QrCode,
  Share2,
  RotateCcw,
  Building2,
  Calendar,
  IndianRupee,
  Eye,
  Check,
  ChevronRight,
  X,
  ExternalLink,
} from 'lucide-react';
import { useTrip3DStore } from '@/store/useTrip3DStore';
import { DESTINATIONS } from '@/data/destinations';

export function OverlayUI() {
  const router = useRouter();
  const {
    stage,
    setStage,
    selectedCityId,
    setSelectedCityId,
    currentSpotIndex,
    setCurrentSpotIndex,
    selectedSpotIds,
    toggleSpot,
    friendsCount,
    setFriendsCount,
    isAudioEnabled,
    toggleAudio,
    resetExperience,
    getSelectedCity,
    getCurrentSpot,
    getSelectedSpots,
    getTotalCost,
    getPerPersonCost,
  } = useTrip3DStore();

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const city = getSelectedCity();
  const currentSpot = getCurrentSpot();
  const selectedSpots = getSelectedSpots();
  const totalCost = getTotalCost();
  const perPersonCost = getPerPersonCost();

  const handleEnterOffice = () => {
    setStage('walking');
    setTimeout(() => {
      setStage('desk');
    }, 1100);
  };

  const handleSaveToMyTrips = () => {
    try {
      const tripData = {
        name: `${city.name} 3D Itinerary`,
        destination: city.name,
        startDate: new Date().toISOString().split('T')[0],
        totalBudget: totalCost,
        friendsCount,
        perPersonShare: perPersonCost,
        spots: selectedSpots.map((s) => ({ name: s.name, cost: s.cost })),
        createdAt: new Date().toISOString(),
      };

      const existing = JSON.parse(localStorage.getItem('tripsplit_custom_trips') || '[]');
      existing.unshift(tripData);
      localStorage.setItem('tripsplit_custom_trips', JSON.stringify(existing));
    } catch {
      // localStorage fallback
    }

    setSavedSuccess(true);
    setTimeout(() => {
      router.push('/trips');
    }, 1200);
  };

  const handleCopyPaymentLink = () => {
    const upiUrl = `upi://pay?pa=tripsplit@okhdfcbank&pn=TripSplit&am=${perPersonCost}&cu=INR&tn=TripSplit_${city.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(upiUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-4 md:p-6 overflow-hidden">
      {/* 1. TOP NAV BAR */}
      <header className="pointer-events-auto flex items-center justify-between gap-4 w-full">
        {/* Brand & Stage Pill */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-white/10 hover:border-sky-500/50 shadow-xl transition-all duration-300"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-500/30">
              <Compass className="w-4 h-4 animate-spin-slow" />
            </div>
            <div>
              <div className="text-xs font-black tracking-tight text-white flex items-center gap-1.5">
                TripSplit
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-sky-500/20 text-sky-300 border border-sky-400/30">
                  3D HQ
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Virtual Experience</p>
            </div>
          </Link>

          {/* Stage Progress Pills (Desktop) */}
          <div className="hidden lg:flex items-center gap-1.5 p-1 rounded-2xl bg-slate-950/70 backdrop-blur-xl border border-white/10 text-xs">
            {[
              { key: 'entrance', label: '1. Welcome' },
              { key: 'desk', label: '2. Destination' },
              { key: 'virtual-tour', label: '3. 360° Tour' },
              { key: 'bill', label: '4. Split Bill' },
            ].map((step) => {
              const isCurrent = stage === step.key || (stage === 'walking' && step.key === 'desk');
              return (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => setStage(step.key as any)}
                  className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
                    isCurrent
                      ? 'bg-sky-500 text-white shadow-md shadow-sky-500/40'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {step.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          {/* Mute Audio Toggle */}
          <button
            type="button"
            onClick={toggleAudio}
            className="p-2.5 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-white/10 hover:border-white/20 text-slate-300 hover:text-white shadow-lg transition-all"
            title={isAudioEnabled ? 'Mute Ambiance' : 'Play Ambiance'}
          >
            {isAudioEnabled ? <Volume2 className="w-4 h-4 text-sky-400" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Reset / Start Over */}
          <button
            type="button"
            onClick={resetExperience}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-white/10 hover:border-white/20 text-xs font-semibold text-slate-300 hover:text-white shadow-lg transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restart
          </button>

          {/* Exit to 2D Dashboard */}
          <Link
            href="/trips"
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/15 backdrop-blur-xl border border-white/20 text-xs font-bold text-white shadow-lg transition-all"
          >
            Dashboard
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* 2. STAGE SPECIFIC INTERLAYS */}

      {/* STAGE 1: ENTRANCE */}
      {stage === 'entrance' && (
        <div className="pointer-events-auto absolute left-6 md:left-10 top-1/2 -translate-y-1/2 max-w-md w-full animate-in fade-in slide-in-from-left-8 duration-500 z-30">
          <div className="p-6 md:p-7 rounded-3xl bg-slate-900/90 backdrop-blur-2xl border border-white/15 shadow-2xl shadow-sky-950/60 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30 text-xs font-bold mb-3">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              Interactive 3D Concierge
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-tight mb-2">
              Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-300">TripSplit Travel HQ</span>
            </h1>
            <p className="text-xs md:text-sm text-slate-300 mb-5 leading-relaxed">
              Step inside our virtual travel office. Explore handpicked destinations in high-definition 360° virtual tours, customize group sightseeing spots, and split costs instantly with dynamic UPI QR codes.
            </p>

            <div className="grid grid-cols-3 gap-2 py-2.5 px-3 rounded-2xl bg-white/5 border border-white/10 text-left mb-5">
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Step 1</p>
                <p className="text-xs font-bold text-white">Meet Concierge</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Step 2</p>
                <p className="text-xs font-bold text-sky-300">360° Tour</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Step 3</p>
                <p className="text-xs font-bold text-emerald-300">Live Split Bill</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleEnterOffice}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-sky-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Enter Office & Plan Trip
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STAGE 2: DESK / DESTINATION SELECTOR */}
      {stage === 'desk' && (
        <div className="pointer-events-auto max-w-xl mx-auto mb-6 w-full animate-in fade-in slide-in-from-bottom-6 duration-400">
          <div className="p-5 md:p-7 rounded-3xl bg-slate-900/90 backdrop-blur-2xl border border-white/15 shadow-2xl text-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-wider">
                  <Building2 className="w-4 h-4" />
                  Select Group Destination
                </div>
                <h2 className="text-xl md:text-2xl font-black text-white">Where are you heading?</h2>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-white/10 text-slate-300">
                {city.spots.length} Attractions Ready
              </span>
            </div>

            {/* City Selection Grid */}
            <div className="grid grid-cols-3 gap-2.5 mb-5">
              {DESTINATIONS.map((d) => {
                const isSelected = selectedCityId === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSelectedCityId(d.id)}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'bg-sky-500/20 border-sky-400 text-white shadow-lg shadow-sky-500/20'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <p className="font-bold text-xs md:text-sm text-white line-clamp-1">{d.name.split(',')[0]}</p>
                    <p className="text-[10px] text-slate-400 line-clamp-1">{d.state}</p>
                    <div className="mt-2 text-[11px] font-semibold text-emerald-400">
                      ₹{d.startingPrice}+ /person
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected City Highlight Card */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 mb-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h3 className="font-black text-base text-white">{city.name}</h3>
                  <p className="text-xs text-sky-300 font-medium">{city.tagline}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Est. Cost</span>
                  <span className="text-sm font-black text-emerald-400">₹{totalCost}</span>
                </div>
              </div>
              <p className="text-xs text-slate-300 mb-3">{city.description}</p>

              {/* Spot Pills */}
              <div className="flex flex-wrap gap-1.5">
                {city.spots.map((s) => (
                  <span
                    key={s.id}
                    className="px-2.5 py-1 rounded-xl bg-white/10 text-[11px] font-medium text-slate-200 border border-white/5"
                  >
                    {s.name} ({s.cost > 0 ? `₹${s.cost}` : 'Free'})
                  </span>
                ))}
              </div>
            </div>

            {/* Launch CTA */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStage('entrance')}
                className="py-3 px-4 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-xs border border-white/10 transition-all"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStage('virtual-tour')}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-sky-500/30 hover:scale-[1.01] active:scale-[0.99] transition-all"
              >
                <Eye className="w-4 h-4" />
                Launch 360° Virtual Tour
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STAGE 3: 360° VIRTUAL TOUR */}
      {stage === 'virtual-tour' && (
        <div className="pointer-events-auto flex flex-col justify-between w-full h-full pb-2">
          {/* Top Virtual Tour Header */}
          <div className="max-w-xl mx-auto w-full pt-16 md:pt-14 text-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/85 backdrop-blur-xl border border-sky-400/40 text-xs font-bold text-white shadow-xl">
              <Eye className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
              <span>360° Equirectangular Tour • Click & drag around to explore</span>
            </div>
          </div>

          {/* Bottom Dock: Attractions Selector Carousel */}
          <div className="max-w-4xl mx-auto w-full mt-auto">
            <div className="p-4 md:p-5 rounded-3xl bg-slate-900/90 backdrop-blur-2xl border border-white/15 shadow-2xl">
              {/* Active Spot Banner & Inclusion Toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-3 border-b border-white/10">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                      {currentSpot.category}
                    </span>
                    <h3 className="font-black text-lg text-white">{currentSpot.name}</h3>
                    <span className="text-xs font-bold text-emerald-400">
                      {currentSpot.cost > 0 ? `₹${currentSpot.cost}` : 'Free Entry'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">{currentSpot.subtitle}</p>
                </div>

                <div className="flex items-center gap-3">
                  {/* Add / Remove from Group Split */}
                  <button
                    type="button"
                    onClick={() => toggleSpot(currentSpot.id)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold border transition-all ${
                      selectedSpotIds.includes(currentSpot.id)
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40 shadow-md shadow-emerald-500/20'
                        : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
                    }`}
                  >
                    <CheckCircle2
                      className={`w-4 h-4 ${
                        selectedSpotIds.includes(currentSpot.id) ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    />
                    {selectedSpotIds.includes(currentSpot.id) ? 'Included in Split' : 'Add to Split'}
                  </button>

                  {/* Proceed to Split Bill */}
                  <button
                    type="button"
                    onClick={() => setStage('bill')}
                    className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-sky-500/30 transition-all hover:scale-[1.02]"
                  >
                    <span>Proceed to Split Bill ({selectedSpotIds.length})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Spots Carousel Track */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {city.spots.map((spot, idx) => {
                  const isCurrent = currentSpotIndex === idx;
                  const isSelected = selectedSpotIds.includes(spot.id);

                  return (
                    <button
                      key={spot.id}
                      type="button"
                      onClick={() => setCurrentSpotIndex(idx)}
                      className={`p-2.5 rounded-2xl border text-left transition-all ${
                        isCurrent
                          ? 'bg-sky-500/25 border-sky-400 shadow-md shadow-sky-500/20'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-bold text-xs text-white line-clamp-1">{spot.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">{spot.duration}</span>
                        <span className="font-semibold text-emerald-400">
                          {spot.cost > 0 ? `₹${spot.cost}` : 'Free'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STAGE 4: SPLIT BILL RECEIPT & DYNAMIC UPI QR */}
      {stage === 'bill' && (
        <div className="pointer-events-auto max-w-lg mx-auto my-auto w-full animate-in fade-in zoom-in-95 duration-400">
          <div className="p-6 md:p-8 rounded-3xl bg-slate-900/95 backdrop-blur-2xl border border-white/15 shadow-2xl text-white">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400 uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  Verified TripSplit Receipt
                </div>
                <h2 className="text-2xl font-black text-white">{city.name} Split</h2>
              </div>
              <button
                type="button"
                onClick={() => setStage('virtual-tour')}
                className="p-2 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10"
                title="Back to 360° Tour"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>

            {/* Selected Spots Breakdown */}
            <div className="space-y-2 mb-5 max-h-40 overflow-y-auto pr-1">
              {selectedSpots.map((spot) => (
                <div
                  key={spot.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="font-semibold text-white">{spot.name}</span>
                  </div>
                  <span className="font-bold text-slate-200">
                    {spot.cost > 0 ? `₹${spot.cost}` : 'Free'}
                  </span>
                </div>
              ))}
            </div>

            {/* Interactive Friends Slider */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 mb-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-sky-400" />
                  Number of Friends Splitting:
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-500/20 text-sky-300 border border-sky-400/30">
                  {friendsCount} {friendsCount === 1 ? 'Person' : 'Friends'}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={12}
                value={friendsCount}
                onChange={(e) => setFriendsCount(parseInt(e.target.value, 10))}
                className="w-full accent-sky-400 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-medium">
                <span>Solo (1)</span>
                <span>Trio (3)</span>
                <span>Group (6)</span>
                <span>Large Squad (12)</span>
              </div>
            </div>

            {/* Cost Summary Box */}
            <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-gradient-to-br from-sky-950/60 to-indigo-950/60 border border-sky-500/30 mb-5">
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase">Total Trip Itinerary</p>
                <p className="text-lg font-black text-white">₹{totalCost.toLocaleString('en-IN')}</p>
              </div>
              <div className="text-right border-l border-white/10 pl-3">
                <p className="text-[11px] font-semibold text-sky-300 uppercase">Per Person Share</p>
                <p className="text-xl font-black text-emerald-400">₹{perPersonCost.toLocaleString('en-IN')}</p>
              </div>
            </div>

            {/* Dynamic UPI QR Code Box */}
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white p-3.5 mb-5 shadow-inner">
              <div className="p-2 rounded-xl bg-slate-100 shrink-0">
                <QRCodeSVG
                  value={`upi://pay?pa=tripsplit@okhdfcbank&pn=TripSplit&am=${perPersonCost}&cu=INR&tn=TripSplit_${city.id}`}
                  size={96}
                  level="H"
                />
              </div>
              <div className="text-slate-900">
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold mb-1">
                  <QrCode className="w-3 h-3" />
                  Instant UPI Payment
                </div>
                <h4 className="font-extrabold text-xs text-slate-900">Scan with GPay / PhonePe / Paytm</h4>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Auto-populated for ₹{perPersonCost}/person share.
                </p>
                <button
                  type="button"
                  onClick={handleCopyPaymentLink}
                  className="mt-2 text-[11px] font-bold text-sky-600 hover:text-sky-700 underline"
                >
                  {copiedLink ? '✓ UPI Link Copied!' : 'Copy Payment Link'}
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={handleSaveToMyTrips}
                disabled={savedSuccess}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/30 transition-all hover:scale-[1.01]"
              >
                {savedSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Saved to My Trips! Redirecting...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Save Itinerary to My Trips
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={resetExperience}
                className="py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs border border-white/10 transition-all"
              >
                Explore Another City
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
