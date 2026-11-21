import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`animate-pulse bg-slate-200 rounded-lg ${className}`}
    />
  );
};

export const TripCardSkeleton: React.FC = () => {
  return (
    <div className="rounded-xl bg-white border border-[#E5EAF1] p-0 overflow-hidden shadow-sm space-y-4">
      <Skeleton className="h-44 w-full rounded-none bg-slate-200" />
      <div className="p-5 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="pt-2 flex justify-between">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
    </div>
  );
};
