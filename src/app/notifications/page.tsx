'use client';

import React, { useState } from 'react';
import { Sidebar } from '../../components/layout/Sidebar';
import { TopHeader } from '../../components/layout/TopHeader';
import { BottomNav } from '../../components/layout/BottomNav';
import {
  Bell,
  CheckCircle2,
  Receipt,
  Users,
  Compass,
} from 'lucide-react';
import { toast } from 'sonner';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'expense' | 'settlement' | 'invite' | 'itinerary';
  read: boolean;
}

const initialNotifications: NotificationItem[] = [
  {
    id: 'n1',
    title: 'New Expense Added',
    message: 'Neha Verma added "Riverside Cafe 1947 Trout Dinner" (₹3,800). Your equal share: ₹950.',
    time: '25 mins ago',
    type: 'expense',
    read: false,
  },
  {
    id: 'n2',
    title: 'UPI Payment Verified',
    message: 'Vikram Malhotra settled ₹1,250 for "Solang Paragliding Booking" via PhonePe.',
    time: '2 hours ago',
    type: 'settlement',
    read: false,
  },
  {
    id: 'n3',
    title: 'Trip Invitation Accepted',
    message: 'Rohan Mehta joined "Delhi to Manali Backpacking 2026".',
    time: '5 hours ago',
    type: 'invite',
    read: true,
  },
  {
    id: 'n4',
    title: 'Itinerary Updated',
    message: 'Day 3 activity "Jogini Waterfalls Sunrise Trek" was rescheduled to 6:30 AM.',
    time: '1 day ago',
    type: 'itinerary',
    read: true,
  },
];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success('All notifications marked as read');
  };

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'expense':
        return <Receipt className="w-4 h-4 text-[#1685D4]" />;
      case 'settlement':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'invite':
        return <Users className="w-4 h-4 text-purple-600" />;
      case 'itinerary':
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
                  Stay updated on group splits, member settlements & itinerary changes.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={markAllAsRead}
              className="text-xs font-semibold text-[#1685D4] hover:underline"
            >
              Mark all as read
            </button>
          </div>

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
                <div className="p-2.5 rounded-xl bg-white border border-[#E5EAF1] shrink-0 mt-0.5">
                  {getIcon(item.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-[#172B4D] truncate">{item.title}</h3>
                    <span className="text-[10px] text-[#64748B] shrink-0">{item.time}</span>
                  </div>
                  <p className="text-xs text-[#475569] mt-0.5 leading-relaxed">{item.message}</p>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
