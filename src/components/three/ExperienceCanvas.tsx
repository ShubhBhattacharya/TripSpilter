'use client';

import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { useProgress, Html } from '@react-three/drei';
import { TravelGuide } from './TravelGuide';
import { OfficeScene } from './OfficeScene';
import { RealPanoramaViewer } from './RealPanoramaViewer';
import { CameraRig } from './CameraRig';
import { OverlayUI } from './OverlayUI';
import { useTrip3DStore } from '@/store/useTrip3DStore';
import { Compass } from 'lucide-react';

function CanvasLoader() {
  const { progress } = useProgress();

  return (
    <Html center>
      <div className="flex flex-col items-center justify-center p-6 rounded-3xl bg-slate-900/95 backdrop-blur-2xl border border-white/15 text-white shadow-2xl min-w-[260px]">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white mb-4 shadow-lg shadow-sky-500/30 animate-pulse">
          <Compass className="w-6 h-6 animate-spin-slow" />
        </div>
        <p className="font-bold text-sm text-white mb-1">Loading 3D Travel HQ...</p>
        <p className="text-xs text-sky-400 font-semibold mb-3">{Math.round(progress)}% Complete</p>
        <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-sky-400 to-indigo-500 h-full rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </Html>
  );
}

export function ExperienceCanvas() {
  const stage = useTrip3DStore((s) => s.stage);
  const currentSpot = useTrip3DStore((s) => s.getCurrentSpot());

  return (
    <div className="relative w-full h-screen bg-slate-950 overflow-hidden select-none">
      {/* 1. Real Full-Screen Photographic Panoramic Background in Stage 3 (z-0) */}
      {stage === 'virtual-tour' && <RealPanoramaViewer spot={currentSpot} />}

      {/* 2. Transparent 3D WebGL Canvas Layer mounted ABOVE 360 photo at z-20 */}
      <Canvas
        shadows
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        camera={{ position: [0.3, 1.45, 4.5], fov: 48 }}
        className="!fixed inset-0 z-20 pointer-events-none w-full h-full"
      >
        <CameraRig />

        {/* Dedicated Scene Lighting so Guide character stays bright across all stages */}
        <ambientLight intensity={1.8} color="#fffbeb" />
        <directionalLight position={[2, 4, 5]} intensity={2.2} color="#fff7ed" />

        <Suspense fallback={<CanvasLoader />}>
          <OfficeScene />
          <TravelGuide />
        </Suspense>
      </Canvas>

      {/* 3. Glassmorphic UI HUD (Controls, Speech Bubble, Badges, Split Bill) at z-40 */}
      <OverlayUI />
    </div>
  );
}
