'use client';

import React, { useState } from 'react';
import { Sidebar } from '../../components/layout/Sidebar';
import { TopHeader } from '../../components/layout/TopHeader';
import { BottomNav } from '../../components/layout/BottomNav';
import { useAuth } from '../../components/auth/AuthProvider';
import {
  CreditCard,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import { toast } from 'sonner';

export default function ProfileSettingsPage() {
  const { user, profile, updateProfile, signOut } = useAuth();

  const [displayName, setDisplayName] = useState(
    profile?.display_name || user?.user_metadata?.full_name || 'Aarav Sharma'
  );
  const [upiId, setUpiId] = useState(profile?.upi_id || 'aarav@okhdfcbank');
  const [phone, setPhone] = useState(user?.user_metadata?.phone || '+91 98765 43210');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Privacy permissions state
  const [permissions, setPermissions] = useState({
    camera: true,
    notifications: true,
    photos: true,
    contacts: false,
    location: false,
  });

  const togglePermission = (key: keyof typeof permissions) => {
    setPermissions((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      toast.success(`Permission "${key}" updated!`);
      return updated;
    });
  };

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiId);
    setCopiedUpi(true);
    toast.success('UPI ID copied to clipboard!');
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const success = await updateProfile({
      displayName: displayName.trim(),
      upiId: upiId.trim().toLowerCase(),
    });
    setIsSaving(false);
    if (success) {
      toast.success('Profile and UPI settings saved successfully! 🚀');
    } else {
      toast.error('Failed to save profile. Check connection.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-[#172B4D] flex flex-col lg:flex-row">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-12">
        <TopHeader title="Profile & Settings" />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-4xl mx-auto w-full space-y-6">
          {/* Header Card */}
          <div className="bg-white p-6 rounded-2xl border border-[#E5EAF1] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    profile?.avatar_url ||
                    user?.user_metadata?.avatar_url ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80'
                  }
                  alt={displayName}
                  className="w-16 h-16 rounded-full object-cover ring-2 ring-[#1685D4]/20"
                />
                <span className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#172B4D]">{displayName}</h1>
                <p className="text-xs text-[#64748B]">{user?.email || 'traveler@tripsplit.app'}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200">
                    Verified Member
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-semibold border border-blue-200">
                    Zero-Float UPI Active
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (window.confirm('Are you sure you want to sign out?')) {
                  signOut();
                }
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs transition-colors self-start sm:self-auto"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>

          {/* Settings Tabs & Forms */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. Account & UPI Details */}
            <div className="bg-white p-6 rounded-2xl border border-[#E5EAF1] shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[#E5EAF1]">
                <CreditCard className="w-5 h-5 text-[#1685D4]" />
                <h2 className="text-sm font-bold text-[#172B4D]">Direct Settlement & UPI ID</h2>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5EAF1] bg-[#F4F7FB] text-xs font-medium text-[#172B4D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1685D4]/20 focus:border-[#1685D4]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-[#172B4D]">Receiving UPI ID</label>
                    <button
                      type="button"
                      onClick={handleCopyUpi}
                      className="text-[11px] text-[#1685D4] hover:underline flex items-center gap-1"
                    >
                      {copiedUpi ? 'Copied!' : 'Copy ID'}
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5EAF1] bg-[#F4F7FB] text-xs font-medium text-[#172B4D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1685D4]/20 focus:border-[#1685D4]"
                  />
                  <p className="text-[10px] text-[#64748B] mt-1">
                    Buddies settle debts straight into this UPI ID. No middle wallet.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                    Verified Mobile Number
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5EAF1] bg-[#F4F7FB] text-xs font-medium text-[#172B4D] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1685D4]"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full py-2.5 rounded-xl bg-[#173B70] hover:bg-[#1685D4] text-white font-bold text-xs shadow-xs active:scale-95 transition-all"
                  >
                    {isSaving ? 'Saving Changes...' : 'Save Profile Changes'}
                  </button>
                </div>
              </form>
            </div>

            {/* 2. Privacy & Permissions Center */}
            <div className="bg-white p-6 rounded-2xl border border-[#E5EAF1] shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[#E5EAF1]">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h2 className="text-sm font-bold text-[#172B4D]">Privacy & App Permissions</h2>
              </div>

              <div className="space-y-3">
                {/* Camera */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#F4F7FB]">
                  <div>
                    <h3 className="text-xs font-bold text-[#172B4D]">Camera & QR Scanner</h3>
                    <p className="text-[10px] text-[#64748B]">Scan merchant UPI QR & restaurant paper bills</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={permissions.camera}
                    onChange={() => togglePermission('camera')}
                    className="w-4 h-4 accent-[#1685D4] rounded cursor-pointer"
                  />
                </div>

                {/* Notifications */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#F4F7FB]">
                  <div>
                    <h3 className="text-xs font-bold text-[#172B4D]">Trip Notifications</h3>
                    <p className="text-[10px] text-[#64748B]">Expense additions & settlement confirmations</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={permissions.notifications}
                    onChange={() => togglePermission('notifications')}
                    className="w-4 h-4 accent-[#1685D4] rounded cursor-pointer"
                  />
                </div>

                {/* Photos & Files */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#F4F7FB]">
                  <div>
                    <h3 className="text-xs font-bold text-[#172B4D]">Photos & Vouchers</h3>
                    <p className="text-[10px] text-[#64748B]">Upload hotel bookings and tickets</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={permissions.photos}
                    onChange={() => togglePermission('photos')}
                    className="w-4 h-4 accent-[#1685D4] rounded cursor-pointer"
                  />
                </div>

                {/* Contacts */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#F4F7FB]">
                  <div>
                    <h3 className="text-xs font-bold text-[#172B4D]">Contacts Integration</h3>
                    <p className="text-[10px] text-[#64748B]">Invite buddies with phone numbers</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={permissions.contacts}
                    onChange={() => togglePermission('contacts')}
                    className="w-4 h-4 accent-[#1685D4] rounded cursor-pointer"
                  />
                </div>

                {/* Location */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#F4F7FB]">
                  <div>
                    <h3 className="text-xs font-bold text-[#172B4D]">Location Discovery</h3>
                    <p className="text-[10px] text-[#64748B]">Suggest nearby cafes & itinerary pins</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={permissions.location}
                    onChange={() => togglePermission('location')}
                    className="w-4 h-4 accent-[#1685D4] rounded cursor-pointer"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                TripSplit does not sell your personal travel information or store banking credentials.
              </div>
            </div>
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
