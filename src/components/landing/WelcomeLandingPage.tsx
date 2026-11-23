'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Compass,
  QrCode,
  ShieldCheck,
  Users,
  Receipt,
  FolderLock,
  ArrowRight,
  Calendar,
  MapPin,
  Sparkles,
  ChevronRight,
  Zap,
} from 'lucide-react';

interface WelcomeLandingPageProps {
  onGetStarted?: () => void;
  onLogin?: () => void;
  onExploreDemo?: () => void;
}

export const WelcomeLandingPage: React.FC<WelcomeLandingPageProps> = ({
  onGetStarted,
  onLogin,
  onExploreDemo,
}) => {
  const router = useRouter();

  // Floating Card Interactive State (Inspired by Image 1)
  const [selectedCategory, setSelectedCategory] = useState<'weekend' | 'mountain' | 'beach'>('mountain');
  const [destinationInput, setDestinationInput] = useState('Manali, Himachal Pradesh');
  const [travelDates, setTravelDates] = useState('15 Dec - 20 Dec 2026');
  const [travelersCount, setTravelersCount] = useState('4 Travelers');

  const handleStartPlanning = (e: React.FormEvent) => {
    e.preventDefault();
    if (onGetStarted) {
      onGetStarted();
    } else {
      router.push('/signup');
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-[#172B4D] flex flex-col font-sans selection:bg-[#1685D4]/20 selection:text-[#173B70]">
      {/* 1. Header Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#E5EAF1] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-[#173B70] text-white flex items-center justify-center font-black text-xl shadow-xs group-hover:bg-[#1685D4] transition-colors">
              <span>₹</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg text-[#172B4D] tracking-tight">TripSplit</span>
                <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase rounded bg-[#EBF5FB] text-[#1685D4] border border-[#1685D4]/20">
                  TRAVEL-FINTECH
                </span>
              </div>
              <p className="text-[11px] text-[#64748B]">Travel Together. Split Smarter.</p>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-[#64748B]">
            <a href="#features" className="hover:text-[#173B70] transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-[#173B70] transition-colors">How It Works</a>
            <Link href="/explore" className="hover:text-[#173B70] transition-colors flex items-center gap-1">
              <span>Explore</span>
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-bold">New</span>
            </Link>
            <a href="#security" className="hover:text-[#173B70] transition-colors">Zero-Float Security</a>
          </nav>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              onClick={onLogin}
              className="px-4 py-2 text-xs font-semibold text-[#173B70] hover:text-[#1685D4] hover:bg-slate-100 rounded-lg transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              onClick={onGetStarted}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#173B70] hover:bg-[#1685D4] rounded-lg shadow-xs hover:shadow transition-all active:scale-95"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Hero Section with Scenic Travel Photography (Direct reference from Image 1) */}
      <section className="relative overflow-hidden pt-8 pb-16 lg:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Scenic Background Container with Layered Card */}
          <div className="relative rounded-3xl overflow-hidden shadow-xl border border-slate-200/80 min-h-[580px] lg:min-h-[620px] flex items-center">
            {/* Background Image - High-Res Scenic Mountain Lake with Traveler (as seen in Image 1) */}
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 scale-105"
              style={{
                backgroundImage: `url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2000&q=85')`,
              }}
            />
            {/* High-fidelity Gradient Overlay for readability */}
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-950/60 to-slate-900/40" />

            {/* Hero Inner Grid: Left Copy + Right Floating Widget Card */}
            <div className="relative z-10 w-full p-6 sm:p-10 lg:p-14 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left Headline & Pitch */}
              <div className="lg:col-span-7 space-y-6 text-white">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white text-xs font-semibold">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>The Modern Indian Travel & Expense Experience</span>
                </div>

                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1]">
                  Travel Together. <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-sky-300">
                    Split Smarter.
                  </span>
                </h1>

                <p className="text-sm sm:text-base text-slate-200 max-w-xl font-normal leading-relaxed">
                  Collaborative group itineraries, shared ticket vaults, and direct-to-vendor UPI bill splitting. No pooled money, no wallet float, and zero settlement awkwardness.
                </p>

                {/* Trust Badges */}
                <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-medium text-slate-200">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Zero Float Risk</span>
                  </div>
                  <div className="w-1 h-1 rounded-full bg-slate-400" />
                  <div className="flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-sky-400" />
                    <span>Direct-to-Merchant UPI</span>
                  </div>
                  <div className="w-1 h-1 rounded-full bg-slate-400" />
                  <div className="flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-amber-400" />
                    <span>Exact Paise Arithmetic</span>
                  </div>
                </div>

                {/* CTA Row */}
                <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <Link
                    href="/signup"
                    onClick={onGetStarted}
                    className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white text-[#173B70] hover:bg-slate-100 font-bold text-sm shadow-lg hover:shadow-xl active:scale-95 transition-all"
                  >
                    <span>Start Your Outing</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  {onExploreDemo && (
                    <button
                      type="button"
                      onClick={onExploreDemo}
                      className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/25 text-white font-semibold text-sm transition-all"
                    >
                      <Compass className="w-4 h-4" />
                      <span>Preview Live Dashboard</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Right Floating Card Widget (Direct implementation of Image 1 "Find the best place") */}
              <div className="lg:col-span-5">
                <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-6 sm:p-7 shadow-2xl border border-white/40 text-[#172B4D]">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base sm:text-lg font-bold text-[#172B4D]">
                      Plan Your Next Outing
                    </h3>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Zero Fees
                    </span>
                  </div>

                  {/* Category Pills (Holiday, Flight, Hotels -> Outing, Trek, Roadtrip) */}
                  <div className="grid grid-cols-3 gap-1 bg-[#F4F7FB] p-1 rounded-xl mb-5 border border-[#E5EAF1]">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory('mountain');
                        setDestinationInput('Manali, Himachal Pradesh');
                      }}
                      className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                        selectedCategory === 'mountain'
                          ? 'bg-white text-[#173B70] shadow-xs'
                          : 'text-[#64748B] hover:text-[#172B4D]'
                      }`}
                    >
                      Hill Station
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory('beach');
                        setDestinationInput('North Goa Beaches');
                      }}
                      className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                        selectedCategory === 'beach'
                          ? 'bg-white text-[#173B70] shadow-xs'
                          : 'text-[#64748B] hover:text-[#172B4D]'
                      }`}
                    >
                      Beach & Sun
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory('weekend');
                        setDestinationInput('Jaipur Heritage Pink City');
                      }}
                      className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                        selectedCategory === 'weekend'
                          ? 'bg-white text-[#173B70] shadow-xs'
                          : 'text-[#64748B] hover:text-[#172B4D]'
                      }`}
                    >
                      Weekend Getaway
                    </button>
                  </div>

                  {/* Destination Field */}
                  <form onSubmit={handleStartPlanning} className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                        Destination
                      </label>
                      <div className="relative">
                        <MapPin className="w-4 h-4 text-[#1685D4] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={destinationInput}
                          onChange={(e) => setDestinationInput(e.target.value)}
                          placeholder="e.g. Manali, Goa, Leh Ladakh, Munnar"
                          className="w-full pl-10 pr-3 py-2.5 bg-[#F4F7FB] border border-[#E5EAF1] rounded-xl text-xs font-medium text-[#172B4D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1685D4]/20 focus:border-[#1685D4] transition-all"
                        />
                      </div>
                    </div>

                    {/* Dates Field */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                          Dates
                        </label>
                        <div className="relative">
                          <Calendar className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={travelDates}
                            onChange={(e) => setTravelDates(e.target.value)}
                            className="w-full pl-8 pr-2 py-2 bg-[#F4F7FB] border border-[#E5EAF1] rounded-xl text-[11px] font-medium text-[#172B4D] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1685D4]"
                          />
                        </div>
                      </div>

                      {/* Group Size Field */}
                      <div>
                        <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                          Group Size
                        </label>
                        <div className="relative">
                          <Users className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={travelersCount}
                            onChange={(e) => setTravelersCount(e.target.value)}
                            className="w-full pl-8 pr-2 py-2 bg-[#F4F7FB] border border-[#E5EAF1] rounded-xl text-[11px] font-medium text-[#172B4D] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1685D4]"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      className="w-full py-3 rounded-xl bg-[#172B4D] hover:bg-[#173B70] text-white font-bold text-xs tracking-wide shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2"
                    >
                      <span>Explore & Create Outing</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Core Value Highlights Grid */}
      <section id="features" className="py-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold text-[#1685D4] uppercase tracking-wider bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
            Why Travelers Choose TripSplit
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#172B4D] mt-3">
            Designed for Real Group Adventures in India
          </h2>
          <p className="text-xs sm:text-sm text-[#64748B] mt-2">
            Eliminate awkward IOUs and Excel spreadsheets with purposeful travel-fintech engineering.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <div className="p-6 rounded-2xl bg-white border border-[#E5EAF1] shadow-xs hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-[#EBF5FB] text-[#1685D4] flex items-center justify-center mb-4">
              <QrCode className="w-6 h-6 stroke-[2]" />
            </div>
            <h3 className="text-base font-bold text-[#172B4D] mb-2">Direct-to-Vendor UPI Splits</h3>
            <p className="text-xs text-[#64748B] leading-relaxed">
              When the restaurant or taxi bill arrives, generate individual UPI QR codes for each friend. Everyone pays their exact share directly to the vendor with zero wallet holding.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="p-6 rounded-2xl bg-white border border-[#E5EAF1] shadow-xs hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <ShieldCheck className="w-6 h-6 stroke-[2]" />
            </div>
            <h3 className="text-base font-bold text-[#172B4D] mb-2">Zero Float & Bank Escrow Risk</h3>
            <p className="text-xs text-[#64748B] leading-relaxed">
              We never touch your money or hold funds in escrow accounts. All money flows peer-to-peer or peer-to-merchant using standard NPCI UPI rails.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="p-6 rounded-2xl bg-white border border-[#E5EAF1] shadow-xs hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
              <Compass className="w-6 h-6 stroke-[2]" />
            </div>
            <h3 className="text-base font-bold text-[#172B4D] mb-2">Shared Day-by-Day Itineraries</h3>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Organize daily roadtrips, cafe stops, sightseeing spots, and activity timings. Trip members can pin locations and track the schedule together.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="p-6 rounded-2xl bg-white border border-[#E5EAF1] shadow-xs hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
              <Receipt className="w-6 h-6 stroke-[2]" />
            </div>
            <h3 className="text-base font-bold text-[#172B4D] mb-2">AI Bill Scanner & OCR</h3>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Snap a paper receipt from any cafe. Our parser extracts dishes, prices, and GST so each buddy can tag what they ate without arguing over the bill.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="p-6 rounded-2xl bg-white border border-[#E5EAF1] shadow-xs hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center mb-4">
              <FolderLock className="w-6 h-6 stroke-[2]" />
            </div>
            <h3 className="text-base font-bold text-[#172B4D] mb-2">Encrypted Bookings Vault</h3>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Store flight tickets, train PNRs, hotel booking vouchers, and adventure permits in one shared vault accessible offline during mountain travels.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="p-6 rounded-2xl bg-white border border-[#E5EAF1] shadow-xs hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 stroke-[2]" />
            </div>
            <h3 className="text-base font-bold text-[#172B4D] mb-2">Debt Minimization Algorithm</h3>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Our graph settlement optimizer collapses multi-person debts into the absolute minimum number of UPI transfers, eliminating circular IOUs.
            </p>
          </div>
        </div>
      </section>

      {/* 4. How It Works Steps */}
      <section id="how-it-works" className="py-14 bg-white border-y border-[#E5EAF1] px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-12">
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
              Effortless 3-Step Flow
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#172B4D] mt-3">
              How TripSplit Works on Vacation
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Step 1 */}
            <div className="relative p-6 rounded-2xl bg-[#F4F7FB] border border-[#E5EAF1] flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-[#173B70] text-white font-bold flex items-center justify-center text-sm mb-4">
                1
              </div>
              <h4 className="text-base font-bold text-[#172B4D] mb-2">Create Outing & Invite Friends</h4>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Add destination, dates, and budget. Share a quick invite link via WhatsApp so friends join the trip space with a single tap.
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative p-6 rounded-2xl bg-[#F4F7FB] border border-[#E5EAF1] flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-[#1685D4] text-white font-bold flex items-center justify-center text-sm mb-4">
                2
              </div>
              <h4 className="text-base font-bold text-[#172B4D] mb-2">Scan Bills & Split by Item</h4>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Take a picture of the bill or enter amounts manually. Assign dishes or split equally with exact paise precision.
              </p>
            </div>

            {/* Step 3 */}
            <div className="relative p-6 rounded-2xl bg-[#F4F7FB] border border-[#E5EAF1] flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm mb-4">
                3
              </div>
              <h4 className="text-base font-bold text-[#172B4D] mb-2">Direct UPI Settlement</h4>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Tap to pay directly via GPay, PhonePe, or Paytm. Settle instantly to the merchant or buddy with zero balance holding.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Footer */}
      <footer className="bg-[#172B4D] text-white py-12 px-4 sm:px-6 lg:px-8 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 border-b border-slate-700 pb-8 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white text-[#172B4D] flex items-center justify-center font-black text-lg">
              <span>₹</span>
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight">TripSplit</span>
              <p className="text-[11px] text-slate-300">Travel Together. Split Smarter.</p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-300">
            <Link href="/login" className="hover:text-white transition-colors">Sign In</Link>
            <Link href="/signup" className="hover:text-white transition-colors">Register</Link>
            <Link href="/explore" className="hover:text-white transition-colors">Explore Destinations</Link>
          </div>
        </div>

        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© 2026 TripSplit Technologies. Direct-to-Vendor UPI architecture. Made for Indian travelers.</p>
          <p className="flex items-center gap-2">
            <span>NPCI UPI Standard</span>
            <span>•</span>
            <span>Zero Holding Risk</span>
          </p>
        </div>
      </footer>
    </div>
  );
};
