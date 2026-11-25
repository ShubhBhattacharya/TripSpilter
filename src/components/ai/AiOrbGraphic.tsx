'use client';

import React from 'react';

interface AiOrbGraphicProps {
  size?: number;
  listening?: boolean;
  thinking?: boolean;
}

export const AiOrbGraphic: React.FC<AiOrbGraphicProps> = ({
  size = 38,
  listening = false,
  thinking = false,
}) => {
  return (
    <div
      className="relative flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span
        className={`absolute inset-0 rounded-full blur-md transition-opacity ${
          listening
            ? 'bg-gradient-to-tr from-cyan-400 via-fuchsia-500 to-amber-300 opacity-90 animate-pulse'
            : thinking
              ? 'bg-gradient-to-tr from-sky-400 via-indigo-500 to-purple-500 opacity-85 animate-pulse'
              : 'bg-gradient-to-tr from-cyan-400/80 via-indigo-500/80 to-purple-500/80 opacity-75'
        }`}
      />
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        className="relative drop-shadow-md"
      >
        <defs>
          <linearGradient id="tripsplit-ai-orb-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0F172A" />
            <stop offset="55%" stopColor="#1E1B4B" />
            <stop offset="100%" stopColor="#312E81" />
          </linearGradient>
          <linearGradient id="tripsplit-ai-ring" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22D3EE" />
            <stop offset="50%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#C084FC" />
          </linearGradient>
        </defs>
        <path
          d="M32 6C17.6 6 6 17.1 6 31c0 7.7 3.5 14.5 9.1 19l-2 7.5 8.1-3.2c3.4 1.1 7 1.7 10.8 1.7 14.4 0 26-11.1 26-25S46.4 6 32 6z"
          fill="url(#tripsplit-ai-orb-bg)"
          stroke="url(#tripsplit-ai-ring)"
          strokeWidth="3"
        />
        <ellipse
          cx="32"
          cy="32"
          rx="28"
          ry="9.5"
          transform="rotate(-14 32 32)"
          fill="none"
          stroke="url(#tripsplit-ai-ring)"
          strokeWidth="2.4"
          strokeOpacity="0.9"
        />
        <circle cx="14" cy="18" r="3" fill="#67E8F9" />
        <circle cx="24" cy="29" r="3.4" fill="#A5F3FC" />
        <circle cx="40" cy="29" r="3.4" fill="#A5F3FC" />
        <path
          d="M25.5 37.5c2 2.4 11 2.4 13 0"
          fill="none"
          stroke="#E0F2FE"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};
