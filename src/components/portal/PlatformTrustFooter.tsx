'use client';

import React from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  QrCode,
  Calculator,
  PhoneCall,
  Wallet,
  Compass,
  Sparkles,
  Users,
} from 'lucide-react';

export const PlatformTrustFooter: React.FC = () => {
  return (
    <div className="space-y-8 pt-4">
      {/* 11. TripSplitter Core Benefits & Existing Outing HQ Bridge */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl border border-[#E5EAF1] shadow-xs p-5 sm:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E5EAF1] pb-5">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">
                Why Plan &amp; Travel With TripSplitter
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#172B4D] mt-0.5">
                Built for Real Group Travel — Zero Wallet Escrow
              </h2>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#173B70] hover:bg-[#1666F2] text-white text-xs font-bold transition-colors"
              >
                <Wallet className="w-4 h-4" /> Open Expense Dashboard
              </Link>
              <Link
                href="/trips"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#DCE4EF] bg-[#FAFCFF] hover:bg-slate-100 text-[#172B4D] text-xs font-bold transition-colors"
              >
                <Users className="w-4 h-4 text-[#1666F2]" /> My Trips
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E5EAF1] space-y-1.5">
              <QrCode className="w-5 h-5 text-[#1666F2]" />
              <h3 className="text-sm font-bold text-[#172B4D]">Direct Merchant UPI Splits</h3>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Group members pay restaurants, hotels, and cabs straight from their own UPI app — never held in an intermediary wallet.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E5EAF1] space-y-1.5">
              <Calculator className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-[#172B4D]">Exact Integer-Paise Math</h3>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Equal, percentage, itemized, and custom splits plus minimum-transfer debt optimization verified down to ₹0.01.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E5EAF1] space-y-1.5">
              <Compass className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-[#172B4D]">60-City 360° Exploration</h3>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Inspect 240 curated attractions across India with bilingual Hindi and English narration before locking plans.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E5EAF1] space-y-1.5">
              <Sparkles className="w-5 h-5 text-amber-600" />
              <h3 className="text-sm font-bold text-[#172B4D]">Approval-Gated AI Agent</h3>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Plan routes, convert currencies, scan bills, and draft outings in English, Hindi, or Hinglish with explicit confirmation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 12. Customer Support & Trust Information */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-sky-50 border border-sky-200/80 p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-6 h-6 text-[#1666F2] shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-[#172B4D]">
                Traveler Support, Emergency Helplines &amp; Transparency
              </h2>
              <p className="text-xs text-[#475569] mt-0.5">
                Pan-India Emergency: <strong>112</strong> • Ministry of Tourism 24x7 Helpline: <strong>1363</strong> • Indian Railways: <strong>139</strong>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <a
              href="tel:1363"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-sky-200 text-xs font-bold text-[#173B70] hover:bg-sky-100"
            >
              <PhoneCall className="w-3.5 h-3.5" /> Call 1363 Helpline
            </a>
            <Link
              href="/ai-assistant"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1666F2] text-white text-xs font-bold hover:bg-[#173B70]"
            >
              24x7 AI Travel Help
            </Link>
          </div>
        </div>
      </section>

      {/* 13. Professional Footer (Verified Routes Only) */}
      <footer className="bg-[#0B1C36] text-slate-300 pt-12 pb-28 lg:pb-12 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-8 pb-8 border-b border-white/10">
          <div className="col-span-2 md:col-span-1 space-y-3">
            <div className="flex items-center gap-2 text-white">
              <div className="w-8 h-8 rounded-xl bg-[#1666F2] flex items-center justify-center">
                <Compass className="w-4 h-4" />
              </div>
              <span className="font-extrabold text-base">TripSplitter</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Full-stack Indian &amp; global trip planner, 360° destination explorer, AI companion, and direct-to-vendor UPI bill splitter.
            </p>
          </div>

          <div className="space-y-2.5 text-xs">
            <h3 className="font-extrabold text-white uppercase tracking-wider text-[11px]">
              Travel Discovery
            </h3>
            <ul className="space-y-1.5">
              <li><Link href="/explore" className="hover:text-white transition-colors">Explore 60 Cities</Link></li>
              <li><Link href="/3d-experience" className="hover:text-white transition-colors">3D Virtual Tour HQ</Link></li>
              <li><Link href="/destinations/manali" className="hover:text-white transition-colors">Manali Guide</Link></li>
              <li><Link href="/destinations/goa" className="hover:text-white transition-colors">Goa Coastline</Link></li>
              <li><Link href="/ai-assistant" className="hover:text-white transition-colors">AI Travel Agent</Link></li>
            </ul>
          </div>

          <div className="space-y-2.5 text-xs">
            <h3 className="font-extrabold text-white uppercase tracking-wider text-[11px]">
              Group Finance &amp; Trips
            </h3>
            <ul className="space-y-1.5">
              <li><Link href="/dashboard" className="hover:text-white transition-colors">Expense Dashboard</Link></li>
              <li><Link href="/trips" className="hover:text-white transition-colors">My Trips &amp; Outings</Link></li>
              <li><Link href="/qr-split" className="hover:text-white transition-colors">Direct Merchant QR Split</Link></li>
              <li><Link href="/notifications" className="hover:text-white transition-colors">Notifications</Link></li>
              <li><Link href="/profile" className="hover:text-white transition-colors">Profile &amp; UPI ID</Link></li>
            </ul>
          </div>

          <div className="space-y-2.5 text-xs">
            <h3 className="font-extrabold text-white uppercase tracking-wider text-[11px]">
              Account &amp; Legal
            </h3>
            <ul className="space-y-1.5">
              <li><Link href="/login" className="hover:text-white transition-colors">Sign In (Personal / Business)</Link></li>
              <li><Link href="/signup" className="hover:text-white transition-colors">Create Account</Link></li>
              <li><Link href="/forgot-password" className="hover:text-white transition-colors">Reset Password</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms &amp; Conditions</Link></li>
              <li><Link href="/refunds" className="hover:text-white transition-colors">Refunds &amp; Cancellations</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact &amp; Grievance</Link></li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
          <p>© 2026 TripSplitter. Zero-escrow direct UPI travel architecture.</p>
          <p>Live weather &amp; currency via Open-Meteo and ECB Frankfurter adapters.</p>
        </div>
      </footer>
    </div>
  );
};
