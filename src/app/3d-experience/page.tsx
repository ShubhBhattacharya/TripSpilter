'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import { Compass } from 'lucide-react';

const ExperienceCanvas = dynamic(
  () => import('@/components/three/ExperienceCanvas').then((mod) => mod.ExperienceCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white p-6">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white mb-6 shadow-2xl shadow-sky-500/40 animate-pulse">
          <Compass className="w-8 h-8 animate-spin-slow" />
        </div>
        <h2 className="text-xl font-black text-white mb-2">Initializing TripSplit 3D Travel HQ</h2>
        <p className="text-sm text-slate-400 max-w-sm text-center">
          Preparing interactive WebGL scene, 360° virtual tours, and automated split calculations...
        </p>
      </div>
    ),
  }
);

export default function ExperiencePage() {
  return (
    <main className="w-full h-screen overflow-hidden bg-slate-950">
      <ExperienceCanvas />
    </main>
  );
}
