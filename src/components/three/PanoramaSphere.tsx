'use client';

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useTrip3DStore } from '@/store/useTrip3DStore';
import { Spot } from '@/data/destinations';
import { Info, Sparkles, MapPin, Eye } from 'lucide-react';

interface HotspotData {
  id: string;
  title: string;
  desc: string;
  position: [number, number, number];
  badge: string;
}

// Procedural Equirectangular 360° Canvas Texture Generator
function createEquirectangularPanorama(spot: Spot): THREE.CanvasTexture {
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    const dummy = new THREE.CanvasTexture(canvas);
    return dummy;
  }

  const { skyTop, skyHorizon, groundColor, ambientColor, monumentName } = spot.panorama;

  // 1. Sky & Horizon Gradient
  const skyGradient = ctx.createLinearGradient(0, 0, 0, height * 0.6);
  skyGradient.addColorStop(0, skyTop);
  skyGradient.addColorStop(0.7, skyHorizon);
  skyGradient.addColorStop(1, ambientColor);

  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, width, height * 0.6);

  // 2. Stars / Atmosphere Particles in Upper Sky
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  for (let i = 0; i < 240; i++) {
    const sx = Math.sin(i * 99) * width;
    const sy = (Math.cos(i * 33) * 0.5 + 0.5) * (height * 0.4);
    const r = (Math.sin(i * 12) * 0.5 + 0.5) * 2 + 1;
    ctx.beginPath();
    ctx.arc((sx + width) % width, sy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. Sun / Glow Disc on Horizon
  const sunX = width * 0.35;
  const sunY = height * 0.5;
  const sunGlow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 320);
  sunGlow.addColorStop(0, 'rgba(255, 245, 220, 0.95)');
  sunGlow.addColorStop(0.3, 'rgba(251, 191, 36, 0.5)');
  sunGlow.addColorStop(1, 'rgba(251, 191, 36, 0)');
  ctx.fillStyle = sunGlow;
  ctx.fillRect(0, 0, width, height * 0.7);

  // 4. Distant Mountain & Fort Silhouette Ridge
  ctx.fillStyle = 'rgba(30, 20, 45, 0.65)';
  ctx.beginPath();
  ctx.moveTo(0, height * 0.58);
  for (let x = 0; x <= width; x += 40) {
    const mountainY =
      height * 0.54 +
      Math.sin(x * 0.008) * 35 +
      Math.cos(x * 0.02) * 20 +
      Math.sin(x * 0.04) * 8;
    ctx.lineTo(x, mountainY);
  }
  ctx.lineTo(width, height * 0.6);
  ctx.lineTo(0, height * 0.6);
  ctx.closePath();
  ctx.fill();

  // 5. Ground / Courtyard Floor
  const groundGradient = ctx.createLinearGradient(0, height * 0.58, 0, height);
  groundGradient.addColorStop(0, groundColor);
  groundGradient.addColorStop(0.4, '#1c1917');
  groundGradient.addColorStop(1, '#09090b');
  ctx.fillStyle = groundGradient;
  ctx.fillRect(0, height * 0.58, width, height * 0.42);

  // 6. Courtyard Flagstone Grid Lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1.5;
  for (let x = 0; x < width; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, height * 0.58);
    ctx.lineTo(x * 1.4 - width * 0.2, height);
    ctx.stroke();
  }

  // 7. Iconic Architectural Frontal Silhouettes & Archways
  ctx.fillStyle = 'rgba(15, 12, 24, 0.75)';
  // Main Palace Silhouette Arch
  const pCenter = width * 0.5;
  ctx.beginPath();
  ctx.rect(pCenter - 340, height * 0.38, 680, height * 0.22);
  ctx.fill();

  // Decorative Jharokhas / Windows
  ctx.fillStyle = ambientColor;
  for (let row = 0; row < 3; row++) {
    for (let col = -5; col <= 5; col++) {
      const jx = pCenter + col * 55;
      const jy = height * 0.42 + row * 45;
      ctx.beginPath();
      ctx.arc(jx, jy, 12, Math.PI, 0, false);
      ctx.rect(jx - 12, jy, 24, 18);
      ctx.fill();
    }
  }

  // Banner Watermark in 360 Sky
  ctx.font = 'bold 28px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.textAlign = 'center';
  ctx.fillText(`TripSplit 360° Panorama • ${monumentName}`, pCenter, height * 0.28);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.x = -1; // Invert horizontally for correct inside-sphere view
  texture.needsUpdate = true;
  return texture;
}

export function PanoramaSphere() {
  const currentSpot = useTrip3DStore((s) => s.getCurrentSpot());
  const activeHotspot = useTrip3DStore((s) => s.activeHotspot);
  const setActiveHotspot = useTrip3DStore((s) => s.setActiveHotspot);

  // Generate panorama texture whenever spot changes
  const panoramaTexture = useMemo(() => {
    return createEquirectangularPanorama(currentSpot);
  }, [currentSpot]);

  // Dynamic 3D Hotspots positioned at specific angles around the spot
  const hotspots: HotspotData[] = useMemo(() => {
    return [
      {
        id: 'monument-facade',
        title: `${currentSpot.name} Grand Façade`,
        desc: currentSpot.subtitle,
        position: [0, 1.2, -6],
        badge: 'Key Attraction',
      },
      {
        id: 'viewpoint',
        title: 'Panoramic Vista Deck',
        desc: `Top-rated 360° angle with ${currentSpot.rating}★ rating from ${currentSpot.reviewsCount} travelers.`,
        position: [5.5, 0.8, -2.5],
        badge: 'Photo Spot',
      },
      {
        id: 'cultural-lore',
        title: 'Heritage & Lore',
        desc: currentSpot.description,
        position: [-5.2, 1.5, -2],
        badge: 'History',
      },
      {
        id: 'group-perk',
        title: 'Group Split Advantage',
        desc: currentSpot.cost > 0 ? `Entry ₹${currentSpot.cost}/person • Split automatically in TripSplit!` : 'Free Public Landmark • Zero ticket cost for group!',
        position: [1.8, -1.2, 5.5],
        badge: currentSpot.cost > 0 ? `₹${currentSpot.cost}` : 'FREE',
      },
    ];
  }, [currentSpot]);

  return (
    <group position={[0, 0, 0]}>
      {/* Smooth OrbitControls for looking around in 360 degrees */}
      <OrbitControls
        enableZoom={true}
        minDistance={0.1}
        maxDistance={4.0}
        enablePan={false}
        rotateSpeed={-0.45}
        dampingFactor={0.06}
        autoRotate={false}
      />

      {/* 360° Spherical Panoramic Dome */}
      <mesh scale={[-1, 1, 1]} rotation={[0, -Math.PI / 2, 0]}>
        <sphereGeometry args={[20, 60, 40]} />
        <meshBasicMaterial map={panoramaTexture} side={THREE.BackSide} />
      </mesh>

      {/* 3D Interactive Hotspot Billboards */}
      {hotspots.map((h) => {
        const isActive = activeHotspot === h.id;
        return (
          <group key={h.id} position={h.position}>
            {/* 3D Pulsing Ring Mesh */}
            <mesh
              onClick={(e) => {
                e.stopPropagation();
                setActiveHotspot(isActive ? null : h.id);
              }}
            >
              <ringGeometry args={[0.22, 0.32, 32]} />
              <meshBasicMaterial
                color={isActive ? '#38bdf8' : '#fbbf24'}
                side={THREE.DoubleSide}
                transparent
                opacity={0.85}
              />
            </mesh>
            <mesh
              onClick={(e) => {
                e.stopPropagation();
                setActiveHotspot(isActive ? null : h.id);
              }}
            >
              <circleGeometry args={[0.18, 32]} />
              <meshBasicMaterial
                color={isActive ? '#0284c7' : '#d97706'}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* HTML Overlay Marker & Tooltip */}
            <Html center distanceFactor={12} zIndexRange={[100, 0]}>
              <div className="relative group select-none">
                <button
                  type="button"
                  onClick={() => setActiveHotspot(isActive ? null : h.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md border text-xs font-semibold shadow-2xl transition-all duration-300 ${
                    isActive
                      ? 'bg-sky-500/90 text-white border-white scale-110 shadow-sky-500/50'
                      : 'bg-slate-900/80 text-amber-300 border-amber-500/40 hover:scale-105 hover:bg-slate-900/95'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">{h.badge}</span>
                </button>

                {/* Expanded Hotspot Card */}
                {isActive && (
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 w-64 p-3.5 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-sky-400/40 text-white shadow-2xl shadow-sky-950 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between pb-1.5 border-b border-white/10 mb-2">
                      <div className="flex items-center gap-1.5 text-sky-400 text-xs font-bold uppercase tracking-wider">
                        <Sparkles className="w-3.5 h-3.5" />
                        {h.badge}
                      </div>
                      <span className="text-[10px] text-slate-400">Click to close</span>
                    </div>
                    <h4 className="font-bold text-sm text-white mb-1">{h.title}</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">{h.desc}</p>
                  </div>
                )}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}
