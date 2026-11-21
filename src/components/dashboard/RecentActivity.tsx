'use client';

import React from 'react';
import { recentActivities } from '../../data/mockData';
import { Vote, QrCode, FileText, CheckCircle2, Clock } from 'lucide-react';

export const RecentActivity: React.FC = () => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'poll':
        return <Vote className="w-3.5 h-3.5 text-purple-600" />;
      case 'split':
        return <QrCode className="w-3.5 h-3.5 text-[#0A9B78]" />;
      case 'booking':
        return <FileText className="w-3.5 h-3.5 text-[#1685D4]" />;
      case 'payment':
        return <CheckCircle2 className="w-3.5 h-3.5 text-[#0A9B78]" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-[#64748B]" />;
    }
  };

  return (
    <div className="rounded-xl bg-white border border-[#E5EAF1] p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold text-[#172B4D] uppercase tracking-wider">
          Recent Trip Activity
        </h3>
        <span className="text-[11px] text-[#64748B]">Live sync</span>
      </div>

      <div className="space-y-3.5">
        {recentActivities.map((act) => (
          <div key={act.id} className="flex items-start gap-3 text-xs">
            <img
              src={act.avatar}
              alt={act.user}
              className="w-7 h-7 rounded-full object-cover ring-1 ring-[#E5EAF1] shrink-0 mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[#172B4D] leading-snug">
                <strong className="font-semibold">{act.user}</strong>{' '}
                {act.action}{' '}
                <span className="text-[#1685D4] font-medium">{act.target}</span>
              </p>
              <div className="flex items-center gap-1.5 text-[10px] text-[#64748B] mt-0.5">
                {getIcon(act.type)}
                <span>{act.time}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
