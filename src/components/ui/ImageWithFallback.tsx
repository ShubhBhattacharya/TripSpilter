'use client';

import React, { useState } from 'react';
import { MapPin } from 'lucide-react';

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
  fallbackTitle?: string;
}

export const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
  src,
  alt = 'Cover Image',
  className = '',
  fallbackTitle,
  ...props
}) => {
  const [error, setError] = useState(false);

  if (error || !src) {
    return (
      <div
        className={`w-full h-full bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#064E3B] flex flex-col items-center justify-center p-4 relative overflow-hidden ${className}`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(#10B981_1px,transparent_1px)] [background-size:16px_16px] opacity-15" />
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2 shadow-inner">
          <MapPin className="w-5 h-5 text-emerald-400" />
        </div>
        <span className="text-xs font-bold text-slate-200 tracking-tight text-center truncate max-w-[90%] z-10">
          {fallbackTitle || alt}
        </span>
        <span className="text-[10px] text-emerald-400 font-medium z-10 mt-0.5">Trip Destination</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setError(true)}
      {...props}
    />
  );
};
