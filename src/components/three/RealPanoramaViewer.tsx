'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Spot } from '@/data/destinations';

interface RealPanoramaViewerProps {
  spot: Spot;
}

export function RealPanoramaViewer({ spot }: RealPanoramaViewerProps) {
  const [photoUrl, setPhotoUrl] = useState<string>(spot.realPhotoUrl);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });
  const currentOffset = useRef({ x: 0, y: 0 });

  // Dynamically fetch highest-res monument photo from Wikimedia API with fallback to spot.realPhotoUrl
  useEffect(() => {
    let isCancelled = false;
    setPhotoUrl(spot.realPhotoUrl);

    async function fetchWikiPhoto() {
      try {
        const endpoint = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
          spot.wikiTitle
        )}&prop=pageimages&format=json&pithumbsize=2400&origin=*`;
        const res = await fetch(endpoint);
        const data = await res.json();
        const pages = data?.query?.pages;
        if (pages) {
          const pageId = Object.keys(pages)[0];
          const source = pages[pageId]?.thumbnail?.source;
          if (source && !isCancelled) {
            setPhotoUrl(source);
          }
        }
      } catch {
        // Safe fallback already in state
      }
    }

    fetchWikiPhoto();
    return () => {
      isCancelled = true;
    };
  }, [spot.wikiTitle, spot.realPhotoUrl]);

  // Interactive Pan / Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    startPos.current = { x: e.clientX - currentOffset.current.x, y: e.clientY - currentOffset.current.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const nx = Math.max(-120, Math.min(120, e.clientX - startPos.current.x));
    const ny = Math.max(-60, Math.min(60, e.clientY - startPos.current.y));
    currentOffset.current = { x: nx, y: ny };
    setDragOffset({ x: nx, y: ny });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div
      className="fixed inset-0 z-0 overflow-hidden select-none cursor-grab active:cursor-grabbing bg-slate-950"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* High-Resolution Real Monument Panoramic Photograph */}
      <div
        className="absolute -inset-16 bg-cover bg-center transition-transform duration-300 ease-out will-change-transform"
        style={{
          backgroundImage: `url('${photoUrl}')`,
          transform: `scale(1.12) translate(${dragOffset.x * 0.4}px, ${dragOffset.y * 0.3}px)`,
        }}
      />

      {/* Subtle vignette & photographic depth gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />
    </div>
  );
}
