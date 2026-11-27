import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy — TripSplitter',
  description: 'How TripSplitter handles authentication sessions, trip data, and direct-to-vendor UPI payments.',
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#F4F7FB] text-[#172B4D] py-10 px-4 sm:px-8">
      <div className="max-w-3xl mx-auto bg-white border border-[#E5EAF1] rounded-3xl shadow-sm p-6 sm:p-10 space-y-6">
        <div className="flex items-center justify-between gap-4 border-b border-[#E5EAF1] pb-5">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#1685D4] hover:underline"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Sign In
          </Link>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5" /> Zero Escrow Policy
          </span>
        </div>

        <div
          role="status"
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900"
        >
          Draft — [TO BE REVIEWED BY COUNSEL BEFORE PUBLIC LAUNCH]
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#173B70]">
            TripSplitter Privacy Policy
          </h1>
          <p className="text-xs text-[#64748B] mt-1">Effective Date: November 25, 2026</p>
        </div>

        <section className="space-y-2 text-sm text-[#334155] leading-relaxed">
          <h2 className="text-base font-bold text-[#172B4D]">1. Authentication & Account Information</h2>
          <p>
            When you sign in to TripSplitter using Google OAuth, email/password, or mobile OTP (where configured), we process your account identifier, display name, and optional UPI ID strictly to manage your sessions, group itineraries, shared expenses, and settlement balances via Supabase Auth and Row-Level Security (RLS).
          </p>
        </section>

        <section className="space-y-2 text-sm text-[#334155] leading-relaxed">
          <h2 className="text-base font-bold text-[#172B4D]">2. Direct-to-Vendor Payments & Non-Custodial Handling</h2>
          <p>
            TripSplitter operates a zero-escrow workflow. Direct UPI payment links redirect to your chosen banking or UPI application. We never store your UPI PIN, bank credentials, or card CVV numbers. Server-side webhook verification checks only cryptographic transaction signatures when an authorized gateway provider is enabled.
          </p>
        </section>

        <section className="space-y-2 text-sm text-[#334155] leading-relaxed">
          <h2 className="text-base font-bold text-[#172B4D]">3. AI Travel Companion & External Data Feeds</h2>
          <p>
            Queries sent to the AI Travel Companion use only the prompts, trip context, and receipt images you explicitly submit. Private trip and expense conversations are isolated per authenticated account (`ai_conversations`, `ai_messages`). Weather and exchange-rate utilities query Open-Meteo and Frankfurter public feeds without transmitting your personal identity.
          </p>
        </section>

        <section className="space-y-2 text-sm text-[#334155] leading-relaxed">
          <h2 className="text-base font-bold text-[#172B4D]">4. Cookies & Local Preferences</h2>
          <p>
            Essential HTTP cookies maintain authenticated Supabase sessions across page loads. Language preferences, UI mode state, and preview demo threads use browser storage only when needed for continuity.
          </p>
        </section>

        <div className="pt-4 border-t border-[#E5EAF1] flex flex-wrap items-center justify-between gap-3 text-xs text-[#64748B]">
          <Link href="/terms" className="font-semibold text-[#1685D4] hover:underline">
            Read Terms & Conditions →
          </Link>
          <Link href="/" className="font-semibold text-[#173B70] hover:underline">
            Go to TripSplitter Home
          </Link>
        </div>
      </div>
    </main>
  );
}
