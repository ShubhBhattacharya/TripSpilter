import React from 'react';
import Link from 'next/link';
import { ArrowLeft, RotateCcw } from 'lucide-react';

export const metadata = {
  title: 'Refunds & Cancellations — TripSplit',
  description: 'Refund, dispute, and cancellation policy for TripSplit travel expenses and gateway-processed settlements.',
};

export default function RefundsPage() {
  return (
    <main className="min-h-screen bg-[#F4F7FB] text-[#172B4D] py-10 px-4 sm:px-8">
      <div className="max-w-3xl mx-auto bg-white border border-[#E5EAF1] rounded-3xl shadow-sm p-6 sm:p-10 space-y-6">
        <div className="flex items-center justify-between gap-4 border-b border-[#E5EAF1] pb-5">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#1685D4] hover:underline"
          >
            <ArrowLeft className="w-4 h-4" /> Back to TripSplit
          </Link>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#173B70] bg-slate-100 border border-slate-200 px-3 py-1 rounded-full">
            <RotateCcw className="w-3.5 h-3.5" /> Refunds Policy
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
            TripSplit Refunds &amp; Cancellations Policy
          </h1>
          <p className="text-xs text-[#64748B] mt-1">Last Updated: November 27, 2026</p>
        </div>

        <section className="space-y-2 text-sm text-[#334155] leading-relaxed">
          <h2 className="text-base font-bold text-[#172B4D]">1. Direct Merchant &amp; Peer UPI Transfers</h2>
          <p>
            You pay merchants directly. TripSplit does not hold your money. Payments initiated via external UPI deep links go straight from your bank/PSP account to the payee&apos;s UPI handle; any refund or cancellation for such transfers must be resolved directly with the recipient merchant or trip member and your UPI bank/PSP.
          </p>
        </section>

        <section className="space-y-2 text-sm text-[#334155] leading-relaxed">
          <h2 className="text-base font-bold text-[#172B4D]">2. Gateway-Processed Payment Orders</h2>
          <p>
            When an optional commercial payment gateway is active and captures an order, cumulative refunds up to the captured order amount may be initiated from your trip order controls and reconciled against webhook notifications from the payment provider.
          </p>
        </section>

        <section className="space-y-2 text-sm text-[#334155] leading-relaxed">
          <h2 className="text-base font-bold text-[#172B4D]">3. Third-Party Travel Bookings</h2>
          <p>
            External hotel or transport links redirect to third-party providers. Cancellation penalties, refund eligibility, and timelines are governed exclusively by that third-party provider&apos;s booking terms.
          </p>
        </section>

        <section className="space-y-2 text-sm text-[#334155] leading-relaxed rounded-2xl border border-[#E5EAF1] bg-[#F8FAFC] p-4">
          <h2 className="text-base font-bold text-[#172B4D]">4. Grievance Escalation &amp; Support Contacts</h2>
          <p>
            Grievance Officer: <strong>[GRIEVANCE_OFFICER_NAME]</strong>
          </p>
          <p>
            Contact Email: <strong>[GRIEVANCE_OFFICER_EMAIL]</strong>
          </p>
          <p>
            Acknowledgment &amp; Resolution SLA: <strong>[RESPONSE_TIME_SLA]</strong>
          </p>
        </section>

        <div className="pt-4 border-t border-[#E5EAF1] flex flex-wrap items-center justify-between gap-3 text-xs text-[#64748B]">
          <Link href="/contact" className="font-semibold text-[#1685D4] hover:underline">
            Contact &amp; Grievance Page →
          </Link>
          <Link href="/terms" className="font-semibold text-[#173B70] hover:underline">
            Read Terms &amp; Conditions
          </Link>
        </div>
      </div>
    </main>
  );
}
