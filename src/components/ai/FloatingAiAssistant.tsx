'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { AiOrbGraphic } from './AiOrbGraphic';
import { AiAgentConsole } from './AiAgentConsole';

export const FloatingAiAssistant: React.FC = () => {
  const pathname = usePathname() || '/';
  const [open, setOpen] = useState<boolean>(false);
  const [expanded, setExpanded] = useState<boolean>(false);

  // Allow keyboard Escape to minimize open drawer cleanly
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  // Keep dedicated AI workspace and full-screen auth pages uncluttered
  if (
    pathname.startsWith('/ai-assistant') ||
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password'
  ) {
    return null;
  }

  // Offset bottom placement cleanly on pages that have BottomNav on mobile
  const is3dExperience = pathname.startsWith('/3d-experience');
  const launcherPosition = is3dExperience
    ? 'bottom-4 right-4'
    : 'bottom-24 right-4 lg:bottom-6 lg:right-6';

  return (
    <>
      {/* Expanded Full-Screen / Large Modal or Compact Floating Drawer */}
      {open && (
        <div
          className={
            expanded
              ? 'fixed inset-0 z-[80] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6'
              : `fixed ${launcherPosition} z-[80] w-[calc(100vw-2rem)] sm:w-[420px] max-w-[440px] h-[min(78vh,640px)] rounded-2xl shadow-2xl border border-indigo-200/80 overflow-hidden`
          }
          data-testid="floating-ai-drawer"
          role="dialog"
          aria-label="TripSplit AI Travel Agent"
        >
          <div
            className={
              expanded
                ? 'w-full max-w-5xl h-full max-h-[88vh] rounded-2xl overflow-hidden shadow-2xl border border-indigo-300/60 bg-white'
                : 'w-full h-full bg-white'
            }
          >
            <AiAgentConsole
              mode={expanded ? 'expanded' : 'compact'}
              onToggleExpand={() => setExpanded((prev) => !prev)}
              onClose={() => {
                setOpen(false);
                setExpanded(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Permanently Visible Bottom-Right Glowing AI Orb Launcher */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-testid="floating-ai-trigger"
          aria-label="Open TripSplit AI Travel Agent"
          className={`fixed ${launcherPosition} z-[75] group flex items-center gap-2.5 pl-2 pr-3.5 py-2 rounded-full bg-slate-950/92 hover:bg-slate-900 text-white border border-cyan-400/40 shadow-[0_10px_30px_rgba(22,133,212,0.38)] backdrop-blur-md transition-all hover:scale-[1.03] active:scale-95 animate-ai-orb cursor-pointer`}
        >
          <AiOrbGraphic size={38} />
          <div className="hidden sm:flex flex-col items-start text-left leading-tight">
            <span className="text-xs font-bold tracking-wide text-white flex items-center gap-1">
              Ask AI Agent
              <Sparkles className="w-3 h-3 text-cyan-300" />
            </span>
            <span className="text-[10px] text-cyan-200/90">Plan • Split • Guide</span>
          </div>
        </button>
      )}
    </>
  );
};
