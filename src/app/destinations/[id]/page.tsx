import React from 'react';
import Link from 'next/link';
import { getDestinationById } from '../../../data/travelCatalog';
import { DestinationDetailView } from '../../../components/portal/DestinationDetailView';
import { MapPinOff, ArrowLeft } from 'lucide-react';

export default async function DestinationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const destination = getDestinationById(id);

  if (!destination) {
    return (
      <main className="min-h-screen bg-[#F4F7FB] flex items-center justify-center p-6 text-[#172B4D]">
        <div className="max-w-md w-full bg-white border border-[#E5EAF1] rounded-3xl p-8 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-[#64748B] flex items-center justify-center mx-auto">
            <MapPinOff className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-extrabold text-[#172B4D]">Destination Not Found</h1>
          <p className="text-xs text-[#64748B]">
            We couldn&apos;t find &ldquo;{id}&rdquo; in our 60-city curated Indian destination index.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1666F2] text-white text-xs font-bold"
            >
              <ArrowLeft className="w-4 h-4" /> Travel Home
            </Link>
            <Link
              href="/explore"
              className="px-4 py-2 rounded-xl border border-[#DCE4EF] text-xs font-bold text-[#172B4D]"
            >
              Browse All 60 Cities
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return <DestinationDetailView destination={destination} />;
}
