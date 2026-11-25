'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '../../components/layout/Sidebar';
import { TopHeader } from '../../components/layout/TopHeader';
import { BottomNav } from '../../components/layout/BottomNav';
import { AiAgentConsole } from '../../components/ai/AiAgentConsole';
import { ShieldCheck, Sparkles } from 'lucide-react';

export default function AiAssistantPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-[#172B4D] flex flex-col lg:flex-row">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-6">
        <TopHeader onScanClick={() => router.push('/qr-split')} title="AI Travel Companion" />

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 lg:px-8 py-5 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#173B70] flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#1685D4]" />
                Central AI Travel Companion
              </h1>
              <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">
                All-in-one planner with 60 curated cities, live weather, currency FX, receipt scanning, voice I/O & confirmation-gated trip mutations.
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Zero Fabricated Rates • Approval Gated
            </div>
          </div>

          <div className="h-[calc(100vh-14.5rem)] min-h-[520px] rounded-2xl border border-[#E5EAF1] shadow-sm overflow-hidden bg-white">
            <AiAgentConsole mode="embedded" />
          </div>
        </main>
      </div>

      <BottomNav
        onOpenQuickSplit={() => router.push('/qr-split')}
        onScanClick={() => router.push('/qr-split')}
      />
    </div>
  );
}
