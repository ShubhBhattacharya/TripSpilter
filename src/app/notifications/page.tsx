'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../components/layout/Sidebar';
import { TopHeader } from '../../components/layout/TopHeader';
import { BottomNav } from '../../components/layout/BottomNav';
import { useAuth } from '../../components/auth/AuthProvider';
import {
  Bell,
  CheckCircle2,
  Receipt,
  Users,
  Compass,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  created_at?: string;
  time?: string;
  type?: 'expense' | 'settlement' | 'invite' | 'itinerary';
  read: boolean;
}

export default function NotificationsPage() {
  const { isConfigured, user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    async function loadNotifications() {
      try {
        const res = await fetch('/api/notifications');
        if (res.ok && active) {
          const data = await res.json();
          setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
        }
      } catch {
        // fail gracefully
      } finally {
        if (active) setLoading(false);
      }
    }
    loadNotifications();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
    } catch {
      // ignore if demo
    }
    toast.success('All notifications marked as read');
  };

  const getIcon = (type?: NotificationItem['type']) => {
    switch (type) {
      case 'expense':
        return <Receipt className="w-4 h-4 text-[#1685D4]" />;
      case 'settlement':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'invite':
        return <Users className="w-4 h-4 text-purple-600" />;
      default:
        return <Compass className="w-4 h-4 text-amber-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-[#172B4D] flex flex-col lg:flex-row">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-12">
        <TopHeader title="Notifications" />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-4xl mx-auto w-full space-y-6">
          <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-[#E5EAF1] shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1685D4] flex items-center justify-center">
                <Bell className="w-5 h-5 stroke-[2]" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#172B4D]">Trip Notifications</h1>
                <p className="text-xs text-[#64748B]">
                  Real-time updates on group splits, settlements & itinerary changes.
                </p>
              </div>
            </div>

            {notifications.length > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-xs font-semibold text-[#1685D4] hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 bg-white rounded-2xl border border-[#E5EAF1]">
              <Loader2 className="w-5 h-5 text-[#1685D4] animate-spin mr-2" />
              <span className="text-xs font-medium text-[#64748B]">Loading notifications...</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-14 px-6 bg-white rounded-2xl border border-[#E5EAF1]">
              <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <h2 className="text-sm font-bold text-[#172B4D]">No notifications yet</h2>
              <p className="text-xs text-[#64748B] mt-1">
                {isConfigured
                  ? 'Activity alerts for expenses, settlements, and bookings will appear here automatically.'
                  : 'Connect Supabase credentials in .env.local to sync persistent notifications across devices.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition-all flex items-start gap-3.5 ${
                    item.read
                      ? 'bg-white border-[#E5EAF1]'
                      : 'bg-[#F0F7FF] border-[#BFDBFE] shadow-xs'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-[#E5EAF1] shrink-0 mt-0.5 shadow-2xs">
                    {getIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-[#172B4D]">{item.title}</h3>
                      <span className="text-[11px] text-[#64748B] shrink-0">
                        {item.created_at
                          ? new Date(item.created_at).toLocaleString('en-IN')
                          : item.time || 'Just now'}
                      </span>
                    </div>
                    <p className="text-xs text-[#475569] mt-1 leading-relaxed">{item.message}</p>
                  </div>
                  {!item.read && (
                    <span className="w-2 h-2 rounded-full bg-[#1685D4] shrink-0 mt-2" />
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
