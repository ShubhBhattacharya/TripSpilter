import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail } from 'lucide-react';

export const metadata = {
  title: 'Contact & Grievance Officer — TripSplit',
  description: 'Support and statutory grievance redressal details for TripSplit.',
};

export default function ContactPage() {
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
            <Mail className="w-3.5 h-3.5" /> Contact &amp; Redressal
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
            Contact TripSplit &amp; Grievance Redressal
          </h1>
          <p className="text-xs text-[#64748B] mt-1">
            Official support and compliance contact details must be populated before public launch.
          </p>
        </div>

        <section className="space-y-3 text-sm text-[#334155] leading-relaxed rounded-2xl border border-[#E5EAF1] bg-[#F8FAFC] p-5">
          <h2 className="text-base font-bold text-[#172B4D]">Designated Grievance Officer</h2>
          <dl className="space-y-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">Name</dt>
              <dd className="font-bold text-[#172B4D]">[GRIEVANCE_OFFICER_NAME]</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">Email Address</dt>
              <dd className="font-bold text-[#172B4D]">[GRIEVANCE_OFFICER_EMAIL]</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">Expected Response Time</dt>
              <dd className="font-bold text-[#172B4D]">[RESPONSE_TIME_SLA]</dd>
            </div>
          </dl>
        </section>

        <section className="space-y-2 text-sm text-[#334155] leading-relaxed">
          <h2 className="text-base font-bold text-[#172B4D]">Direct Payment Responsibility Notice</h2>
          <p>
            You pay merchants directly. TripSplit does not hold your money. For UPI transaction reversals, contact your issuing bank/UPI app alongside the recipient merchant reference ID.
          </p>
        </section>

        <div className="pt-4 border-t border-[#E5EAF1] flex flex-wrap items-center justify-between gap-3 text-xs text-[#64748B]">
          <Link href="/refunds" className="font-semibold text-[#1685D4] hover:underline">
            View Refunds Policy →
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="font-semibold text-[#173B70] hover:underline">
              Privacy Policy
            </Link>
            <Link href="/terms" className="font-semibold text-[#173B70] hover:underline">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
