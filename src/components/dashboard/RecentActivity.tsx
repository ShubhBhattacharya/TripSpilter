'use client';

import React from 'react';
import { recentActivities } from '../../data/mockData';
import { Vote, QrCode, FileText, CheckCircle2, Clock } from 'lucide-react';

export const RecentActivity: React.FC = () => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'poll':
        return <Vote className="w-3.5 h-3.5 text-purple-400" />;
      case 'split':
        return <QrCode className="w-3.5 h-3.5 text-emerald-400" />;
      case 'booking':
        return <FileText className="w-3.5 h-3.5 text-blue-400" />;
      case 'payment':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="rounded-2xl bg-[#111827] border border-[#1F2937] p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          Trip Activity Stream
        </h3>
        <span className="text-[11px] text-slate-300 font-medium">Real-time sync</span>
      </div>

      <div className="space-y-3.5">
        {recentActivities.map((act) => (
          <div key={act.id} className="flex items-start gap-3 text-xs">
            <img
              src={act.avatar}
              alt={act.user}
              className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-800 shrink-0 mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <p className="text-slate-300 leading-snug">
                <strong className="text-white font-semibold">{act.user}</strong>{' '}
                {act.action}{' '}
                <span className="text-emerald-400 font-medium">{act.target}</span>
              </p>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-300 mt-1">
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
