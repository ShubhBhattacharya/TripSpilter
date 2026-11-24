'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import {
  Compass,
  ArrowRight,
  ArrowLeft,
  Users,
  CheckCircle2,
  Sparkles,
  QrCode,
  RotateCcw,
  Volume2,
  VolumeX,
  ChevronRight,
  ChevronLeft,
  Check,
  Eye,
  MapPin,
  ExternalLink,
} from 'lucide-react';
import { useTrip3DStore, ExtraActivity } from '@/store/useTrip3DStore';
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
    addedActivities,
    toggleActivity,
    friendsCount,
    setFriendsCount,
    isAudioEnabled,
    toggleAudio,
    resetExperience,
    getSelectedCity,
    getCurrentSpot,
    getSelectedSpots,
    getTotalItemsCount,
    getTotalCost,
    getPerPersonCost,
  } = useTrip3DStore();

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const city = getSelectedCity();
  const currentSpot = getCurrentSpot();
  const selectedSpots = getSelectedSpots();
  const totalItemsCount = getTotalItemsCount();
  const totalCost = getTotalCost();
  const perPersonCost = getPerPersonCost();

  const handleEnterOffice = () => {
    setStage('walking');
    setTimeout(() => {
      setStage('desk');
    }, 1000);
  };

  const handleNextSpot = () => {
    const nextIdx = (currentSpotIndex + 1) % city.spots.length;
    setCurrentSpotIndex(nextIdx);
  };

  const handlePrevSpot = () => {
    const prevIdx = (currentSpotIndex - 1 + city.spots.length) % city.spots.length;
    setCurrentSpotIndex(prevIdx);
  };

  const handleSaveToMyTrips = () => {
    try {
      const tripData = {
        name: `${city.name} 3D Itinerary`,
        destination: city.name,
        startDate: new Date().toISOString().split('T')[0],
        totalBudget: totalCost + 3700,
        friendsCount,
        perPersonShare: Math.ceil((totalCost + 3700) / friendsCount),
        spots: [
          ...selectedSpots.map((s) => ({ name: s.name, cost: s.cost })),
          ...addedActivities.map((a) => ({ name: a.name, cost: a.cost })),
        ],
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
    const finalPerPerson = Math.ceil((totalCost + 3700) / friendsCount);
    const upiUrl = `upi://pay?pa=tripsplit@okhdfcbank&pn=TripSplit&am=${finalPerPerson}&cu=INR&tn=TripSplit_${city.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(upiUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-30 flex flex-col justify-between overflow-hidden">
      {/* 1. TOP HEADER NAVIGATION - Always high z-index (z-50) and clickable */}
      <header className="pointer-events-auto relative z-50 flex items-center justify-between gap-4 w-full px-6 py-4 bg-gradient-to-b from-black/60 via-black/30 to-transparent">
        {/* Brand & Breadcrumbs */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="cursor-pointer flex items-center gap-2.5 px-3.5 py-1.5 rounded-2xl bg-white/95 backdrop-blur-xl border border-white/50 shadow-xl hover:bg-white text-slate-900 transition-all hover:scale-105 active:scale-95"
          >
            <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-600 flex items-center justify-center text-white font-black text-sm shadow-sm">
              <span>₹</span>
            </div>
            <span className="font-extrabold text-sm tracking-tight text-slate-900">TripSplit</span>
          </Link>

          {/* Breadcrumb Indicator (Reference Image 1: "Login > Route navigation") */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/50 backdrop-blur-md border border-white/15 text-xs text-white/90">
            <span className="text-white/60">Stage {stage === 'entrance' ? '1' : stage === 'desk' ? '2' : stage === 'virtual-tour' ? '3' : '4'}:</span>
            <span className="font-semibold text-white">
              {stage === 'entrance' && 'Welcome HQ'}
              {stage === 'desk' && 'Destination & Expenses'}
              {stage === 'virtual-tour' && '360° Route Navigation'}
              {stage === 'bill' && 'Split Bill Receipt'}
            </span>
          </div>
        </div>

        {/* Stage Progress Pills (Desktop) - Guaranteed Clickable with explicit stage triggers */}
        <div className="hidden lg:flex items-center gap-1.5 p-1 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/20 text-xs text-white">
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
                className={`cursor-pointer px-3.5 py-1.5 rounded-xl font-bold transition-all ${
                  isCurrent
                    ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/50 scale-105'
                    : 'text-white/80 hover:text-white hover:bg-white/15'
                }`}
              >
                {step.label}
              </button>
            );
          })}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          {/* Direct Split Bill Navigation CTA Button in Header */}
          <button
            type="button"
            onClick={() => setStage('bill')}
            className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-extrabold text-xs shadow-xl shadow-orange-500/40 hover:scale-105 active:scale-95 transition-all border border-amber-300/30"
          >
            <span>Split Bill ({totalItemsCount})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={toggleAudio}
            className="cursor-pointer p-2.5 rounded-xl bg-black/50 backdrop-blur-xl border border-white/20 text-white/90 hover:text-white shadow-lg transition-all hover:bg-black/70"
            title={isAudioEnabled ? 'Mute Ambiance' : 'Play Ambiance'}
          >
            {isAudioEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <Link
            href="/trips"
            className="cursor-pointer flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-xl border border-white/20 text-xs font-bold text-white shadow-lg transition-all"
          >
            Dashboard
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* 2. STAGE 1: WELCOME / ENTRANCE CARD (Positioned on Left Side matching Reference Image 2) */}
      {stage === 'entrance' && (
        <div className="pointer-events-auto fixed left-6 md:left-10 top-24 bottom-6 w-[380px] max-w-[90vw] z-40 flex flex-col justify-center animate-in fade-in slide-in-from-left-8 duration-500">
          <div className="p-7 md:p-8 rounded-3xl bg-slate-900/85 backdrop-blur-2xl border border-white/20 shadow-2xl shadow-black/60 text-white">
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight leading-none mb-3">
              Trip Split
            </h1>
            <p className="text-sm text-slate-200 mb-8 leading-relaxed font-medium">
              Easily split group expenses on the go.
            </p>

            {/* Primary Start Trip Button (Reference Image 2) */}
            <button
              type="button"
              onClick={handleEnterOffice}
              className="cursor-pointer w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-white font-extrabold text-base shadow-xl shadow-orange-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all mb-4 text-center"
            >
              Start Trip
            </button>

            <div className="text-center text-[11px] text-slate-400 font-medium mb-4">or</div>

            {/* Secondary Dual Action Buttons */}
            <div className="grid grid-cols-2 gap-2.5 mb-6">
              <button
                type="button"
                onClick={handleEnterOffice}
                className="cursor-pointer py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white transition-all text-center"
              >
                Create New Group
              </button>
              <button
                type="button"
                onClick={handleEnterOffice}
                className="cursor-pointer py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white transition-all text-center"
              >
                Join Existing
              </button>
            </div>

            {/* Quick Pagination Control Pill (Reference Image 2) */}
            <div className="flex items-center justify-center gap-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={handleEnterOffice}
                className="cursor-pointer p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[11px] text-slate-300 font-semibold tracking-wider">Meet 3D Guide</span>
              <button
                type="button"
                onClick={handleEnterOffice}
                className="cursor-pointer p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. STAGE 2: DESTINATION & TRIP EXPENSES (Positioned on Left Side matching Reference Image 3) */}
      {stage === 'desk' && (
        <div className="pointer-events-auto fixed left-6 md:left-10 top-24 bottom-6 w-[380px] max-w-[90vw] z-40 flex flex-col justify-center animate-in fade-in slide-in-from-left-6 duration-400">
          <div className="p-6 md:p-7 rounded-3xl bg-slate-900/85 backdrop-blur-2xl border border-white/20 shadow-2xl text-white">
            <div className="mb-4">
              <h2 className="text-xl font-black text-white tracking-tight">TRIP EXPENSES</h2>
              <p className="text-xs text-slate-300">Splitwise-style collaborative features</p>
            </div>

            {/* Destination Selection Tabs */}
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-white/5 border border-white/10 mb-4">
              {DESTINATIONS.map((d) => {
                const isSelected = selectedCityId === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSelectedCityId(d.id)}
                    className={`cursor-pointer py-2 px-1 rounded-xl text-center text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {d.name.split(',')[0]}
                  </button>
                );
              })}
            </div>

            {/* Splitwise Expense Category Breakdown (Matching Reference Image 3) */}
            <div className="space-y-2.5 mb-5">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-xs">
                    A
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Accommodation</p>
                    <p className="text-[10px] text-slate-400">Jaipur Heritage Stay</p>
                  </div>
                </div>
                <span className="text-xs font-black text-emerald-400">+₹1,200</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-rose-500/20 text-rose-300 flex items-center justify-center font-bold text-xs">
                    M
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Food & Dining</p>
                    <p className="text-[10px] text-slate-400">Dal Baati & Thali</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-rose-400">-₹450</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-slate-300">
                    Split
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-sky-500/20 text-sky-300 flex items-center justify-center font-bold text-xs">
                    J
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Transport & Cabs</p>
                    <p className="text-[10px] text-slate-400">Fort Shuttle</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-emerald-400">+₹250</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-slate-300">
                    Split
                  </span>
                </div>
              </div>
            </div>

            {/* Launch CTA */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setStage('entrance')}
                className="cursor-pointer py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 font-semibold text-xs transition-all"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStage('virtual-tour')}
                className="cursor-pointer flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold text-xs shadow-xl shadow-orange-500/30 hover:scale-[1.01] active:scale-[0.99] transition-all"
              >
                <Eye className="w-4 h-4" />
                Launch 360° Virtual Tour
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. STAGE 3: REAL 360° PANORAMA OVERLAY (Matching Reference Image 1) - Pointer Events Cleanly Filtered */}
      {stage === 'virtual-tour' && (
        <div className="pointer-events-none absolute inset-0 z-30 flex flex-col justify-between p-6">
          {/* Floating Interactive Monument Badges (Reference Image 1) */}
          <div className="absolute inset-0 pointer-events-none z-30">
            {currentSpot.floatingBadges.map((badge) => {
              const isItinerary = badge.type === 'itinerary';
              const isSpotInItinerary = selectedSpotIds.includes(currentSpot.id);
              const isActivityInList = addedActivities.some((a) => a.id === badge.id);
              const isAdded = isItinerary ? isSpotInItinerary : isActivityInList;

              return (
                <button
                  key={badge.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isItinerary) {
                      toggleSpot(currentSpot.id);
                    } else {
                      toggleActivity({ id: badge.id, name: badge.label, cost: badge.cost });
                    }
                  }}
                  style={{ top: badge.top, left: badge.left }}
                  className={`pointer-events-auto cursor-pointer absolute -translate-x-1/2 -translate-y-1/2 px-4 py-2 rounded-2xl text-xs font-bold shadow-2xl transition-all duration-200 hover:scale-105 active:scale-95 ${
                    isAdded
                      ? 'bg-emerald-600 text-white border border-emerald-400/50 shadow-emerald-600/40 ring-2 ring-emerald-400/30'
                      : 'bg-white/95 text-slate-900 border border-white/60 hover:bg-white shadow-black/30'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {isAdded ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                        <span>✓ Added ({badge.cost > 0 ? `₹${badge.cost}` : 'Included'})</span>
                      </>
                    ) : (
                      badge.label
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Spacer to push controls to bottom */}
          <div />

          {/* Bottom Controls Row: Bottom-Left Card + Bottom-Center Dock + Bottom-Right Guide Speech Bubble */}
          <div className="pointer-events-none relative z-40 w-full flex flex-col md:flex-row items-end justify-between gap-4 mt-auto">
            {/* Bottom-Left Spot Info Card (Reference Image 1) */}
            <div className="pointer-events-auto p-4 md:p-5 rounded-3xl bg-white/95 backdrop-blur-2xl border border-white/60 shadow-2xl text-slate-900 max-w-sm">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                {city.name} • Spot {currentSpotIndex + 1} of {city.spots.length}
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-3">{currentSpot.name}</h3>

              <button
                type="button"
                onClick={() => toggleSpot(currentSpot.id)}
                className={`cursor-pointer w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                  selectedSpotIds.includes(currentSpot.id)
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                    : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-500/30 hover:scale-[1.02] active:scale-[0.98]'
                }`}
              >
                {selectedSpotIds.includes(currentSpot.id) ? (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>✓ Spot Added to Itinerary!</span>
                  </>
                ) : (
                  <>+ Add Spot to Trip ({currentSpot.cost > 0 ? `₹${currentSpot.cost}` : 'Free'})</>
                )}
              </button>
            </div>

            {/* Bottom-Center Spot Selector Dock */}
            <div className="pointer-events-auto hidden sm:flex flex-col items-center gap-2 p-2 rounded-2xl bg-black/75 backdrop-blur-xl border border-white/20 text-xs shadow-2xl">
              <div className="flex items-center justify-between w-full px-2 gap-4">
                <span className="text-[11px] font-bold text-slate-300 tracking-wider">
                  {city.spots.length} City Spots
                </span>
                <button
                  type="button"
                  onClick={() => setStage('bill')}
                  className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-extrabold text-[11px] shadow-md shadow-orange-500/30 transition-all hover:scale-105 active:scale-95"
                >
                  <span>Finish Tour & Split Bill</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                {city.spots.map((spot, idx) => {
                  const isCurrent = currentSpotIndex === idx;
                  return (
                    <button
                      key={spot.id}
                      type="button"
                      onClick={() => setCurrentSpotIndex(idx)}
                      className={`cursor-pointer px-3 py-1.5 rounded-xl font-bold transition-all text-xs ${
                        isCurrent
                          ? 'bg-white text-slate-900 shadow-lg scale-105'
                          : 'text-white/80 hover:text-white hover:bg-white/15'
                      }`}
                    >
                      {idx + 1}. {spot.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom-Right Guide Speech Bubble (Reference Image 1: Floats above 3D character) */}
            <div className="pointer-events-auto relative p-4 md:p-5 rounded-3xl bg-white/95 backdrop-blur-2xl border border-white/60 shadow-2xl text-slate-900 max-w-xs md:max-w-sm mb-2 md:mb-6">
              <p className="text-xs font-semibold text-slate-800 leading-relaxed mb-3">
                {currentSpot.speechQuote}
              </p>
              <button
                type="button"
                onClick={handleNextSpot}
                className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 hover:text-sky-700 hover:underline"
              >
                <span>[Next Spot: {currentSpot.nextSpotName} →]</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. STAGE 4: SPLIT BILL RECEIPT (Positioned on Left Side matching Reference Image 4) */}
      {stage === 'bill' && (
        <div className="pointer-events-auto fixed left-6 md:left-10 top-20 bottom-6 w-[400px] max-w-[92vw] z-40 flex flex-col justify-center animate-in fade-in slide-in-from-left-6 duration-400">
          <div className="max-h-[85vh] overflow-y-auto p-5 md:p-6 rounded-3xl bg-white/95 backdrop-blur-2xl border border-white/60 shadow-2xl text-slate-900 flex flex-col">
            {/* Receipt Header (Reference Image 4) */}
            <div className="text-center pb-3 border-b border-dashed border-slate-300 mb-3">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">TripSplit Receipt</h2>
              <p className="text-[11px] text-slate-500 font-medium">Glassmorphic receipt • Verified UPI</p>
            </div>

            {/* Itemized Line Items (Compact & Scrollable) */}
            <div className="space-y-1.5 mb-3 max-h-36 overflow-y-auto pr-1 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Cab / Outing fare:</span>
                <span className="font-bold text-slate-900">₹1,500</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Heritage Lodge:</span>
                <span className="font-bold text-slate-900">₹2,200</span>
              </div>
              {selectedSpots.map((spot) => (
                <div key={spot.id} className="flex justify-between text-slate-600">
                  <span>{spot.name}:</span>
                  <span className="font-bold text-slate-900">
                    {spot.cost > 0 ? `₹${spot.cost}` : 'Free'}
                  </span>
                </div>
              ))}
              {addedActivities.map((act) => (
                <div key={act.id} className="flex justify-between text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg">
                  <span>{act.name}:</span>
                  <span className="font-bold">₹{act.cost}</span>
                </div>
              ))}
            </div>

            {/* Total Line (Reference Image 4) */}
            <div className="flex justify-between items-center py-2 border-y border-slate-200 mb-3">
              <span className="font-extrabold text-sm text-slate-800">Total:</span>
              <span className="font-black text-base text-slate-900">₹{(totalCost + 3700).toLocaleString('en-IN')}</span>
            </div>

            {/* Friends Split Slider */}
            <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 mb-3">
              <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                <span>Friends Splitting:</span>
                <span className="text-amber-600">{friendsCount} {friendsCount === 1 ? 'Person' : 'Friends'}</span>
              </div>
              <input
                type="range"
                min={1}
                max={12}
                value={friendsCount}
                onChange={(e) => setFriendsCount(parseInt(e.target.value, 10))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-bold text-emerald-600 mt-1">
                <span>Your Share:</span>
                <span>₹{Math.ceil((totalCost + 3700) / friendsCount).toLocaleString('en-IN')}/person</span>
              </div>
            </div>

            {/* Dynamic UPI QR Code Box (Reference Image 4) */}
            <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50 border border-slate-200 mb-3 shadow-inner">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Scan UPI with GPay / PhonePe / Paytm
              </span>
              <div className="p-2 bg-white rounded-xl shadow-xs border border-slate-200">
                <QRCodeSVG
                  value={`upi://pay?pa=tripsplit@okhdfcbank&pn=TripSplit&am=${Math.ceil((totalCost + 3700) / friendsCount)}&cu=INR&tn=TripSplit_${city.id}`}
                  size={120}
                  level="H"
                />
              </div>
              <button
                type="button"
                onClick={handleCopyPaymentLink}
                className="cursor-pointer mt-1 text-[11px] font-bold text-sky-600 hover:text-sky-700 underline"
              >
                {copiedLink ? '✓ Copied Payment Link!' : 'Copy Payment Link'}
              </button>
            </div>

            {/* Save & Pay Action Buttons */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleSaveToMyTrips}
                disabled={savedSuccess}
                className="cursor-pointer w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-500/30 transition-all"
              >
                {savedSuccess ? '✓ Saved to My Trips! Redirecting...' : 'Save & Pay via UPI'}
              </button>

              <button
                type="button"
                onClick={() => setStage('virtual-tour')}
                className="cursor-pointer w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all"
              >
                ← Back to 360° Tour
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
