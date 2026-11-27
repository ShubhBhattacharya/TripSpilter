import React from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';

export const metadata = {
  title: 'Terms & Conditions — TripSplitter',
  description: 'Terms governing use of TripSplitter group travel planning and expense splitting services.',
};

export default function TermsPage() {
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
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#173B70] bg-slate-100 border border-slate-200 px-3 py-1 rounded-full">
            <FileText className="w-3.5 h-3.5" /> Terms of Use
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
            TripSplitter Terms & Conditions
          </h1>
          <p className="text-xs text-[#64748B] mt-1">Effective Date: November 25, 2026</p>
        </div>

        <section className="space-y-2 text-sm text-[#334155] leading-relaxed">
          <h2 className="text-base font-bold text-[#172B4D]">1. Service Scope</h2>
          <p>
            TripSplitter provides collaborative trip itinerary discovery, AI-assisted planning tools, and deterministic expense splitting utilities for personal and corporate/team travel groups. You are responsible for verifying final booking policies and travel documentation directly with external providers.
          </p>
        </section>

        <section className="space-y-2 text-sm text-[#334155] leading-relaxed">
          <h2 className="text-base font-bold text-[#172B4D]">2. Expense Splitting & Settlement Accuracy</h2>
          <p>
            All expense allocations are calculated using integer-paise arithmetic across trip members. Group members remain responsible for confirming recipient UPI handles before authorizing external UPI payments. Manually reported payment statuses reflect self-declaration until verified by a configured payment webhook.
          </p>
        </section>

        <section className="space-y-2 text-sm text-[#334155] leading-relaxed">
          <h2 className="text-base font-bold text-[#172B4D]">3. Account Responsibility</h2>
          <p>
            Keep your email credentials, OTPs, and recovery links confidential.TripSplitter enforces authentication checks before allowing database writes, trip membership updates, or expense edits.
          </p>
        </section>

        <section className="space-y-2 text-sm text-[#334155] leading-relaxed">
          <h2 className="text-base font-bold text-[#172B4D]">4. Indicative Estimates & External Links</h2>
          <p>
            Catalog destination baselines, weather forecasts, and ECB currency exchange rates are informational estimates unless live commercial APIs are connected. External links open third-party booking providers under their respective terms.
          </p>
        </section>

        <div className="pt-4 border-t border-[#E5EAF1] flex flex-wrap items-center justify-between gap-3 text-xs text-[#64748B]">
          <Link href="/privacy" className="font-semibold text-[#1685D4] hover:underline">
            Read Privacy Policy →
          </Link>
          <Link href="/" className="font-semibold text-[#173B70] hover:underline">
            Go to TripSplitter Home
          </Link>
        </div>
      </div>
    </main>
  );
}
