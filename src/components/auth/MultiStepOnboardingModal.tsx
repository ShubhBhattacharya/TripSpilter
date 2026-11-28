'use client';

import React, { useState } from 'react';
import { useAuth } from './AuthProvider';
import {
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Camera,
  Users,
  Bell,
  MapPin,
  FileText,
  Plus,
  Check,
  CreditCard,
  ChevronRight,
  User as UserIcon,
} from 'lucide-react';
import confetti from 'canvas-confetti';

const travelInterestOptions = [
  'Mountain Trekking',
  'Beach & Coastline',
  'Heritage & Forts',
  'Cafe Hopping & Foodie',
  'Road Trips',
  'Wildlife & Jungle Safari',
  'Adventure Sports',
  'Backpacking & Hostels',
];

const sampleAvatars = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=250&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80',
];

interface MultiStepOnboardingModalProps {
  onOpenCreateTrip?: () => void;
  onOpenJoinTrip?: () => void;
}

export const MultiStepOnboardingModal: React.FC<MultiStepOnboardingModalProps> = ({
  onOpenCreateTrip,
  onOpenJoinTrip,
}) => {
  const { showOnboarding, setShowOnboarding, profile, user, updateProfile } = useAuth();

  // Current Onboarding Step: 1 = Complete Profile, 2 = Permissions & Privacy, 3 = Personalized Welcome
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Profile State
  const [displayName, setDisplayName] = useState(
    profile?.display_name || user?.user_metadata?.full_name || ''
  );
  const [upiId, setUpiId] = useState(profile?.upi_id || '');
  const [selectedAvatar, setSelectedAvatar] = useState(profile?.avatar_url || sampleAvatars[0]);
  const [currency, setCurrency] = useState('INR (₹)');
  const [language, setLanguage] = useState('English');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([
    'Mountain Trekking',
    'Road Trips',
  ]);

  // Step 2: Permissions State
  const [permissions, setPermissions] = useState({
    camera: true,
    contacts: false,
    notifications: true,
    location: false,
    photos: true,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!showOnboarding) return null;

  // Strict Indian UPI ID regex validation (e.g. name@bank)
  const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
  const isValidUpi = upiId.trim() === '' || upiRegex.test(upiId.trim());

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  const togglePermission = (key: keyof typeof permissions) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Step 1 Submit -> Advance to Step 2
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!displayName.trim()) {
      setError('Please provide a display name so your buddies recognize you.');
      return;
    }

    if (upiId.trim() && !isValidUpi) {
      setError('Please enter a valid UPI ID (e.g., name@okhdfcbank or 9876543210@paytm).');
      return;
    }

    setIsSubmitting(true);
    const saved = await updateProfile({
      displayName: displayName.trim(),
      upiId: upiId.trim().toLowerCase() || 'traveler@upi',
    });
    setIsSubmitting(false);
    if (!saved) {
      setError('Failed to save profile to database. Ensure Supabase is configured and try again.');
      return;
    }

    // Save preferences locally
    try {
      localStorage.setItem(
        'tripsplit_user_preferences',
        JSON.stringify({
          currency,
          language,
          interests: selectedInterests,
          avatar: selectedAvatar,
        })
      );
    } catch {
      // ignore storage error
    }

    setStep(2);
  };

  // Step 2 Submit -> Advance to Step 3
  const handlePermissionsSubmit = () => {
    try {
      localStorage.setItem('tripsplit_privacy_permissions', JSON.stringify(permissions));
    } catch {
      // ignore
    }

    try {
      confetti({
        particleCount: 70,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#1685D4', '#0A9B78', '#173B70', '#F59E0B'],
      });
    } catch {
      // ignore
    }

    setStep(3);
  };

  // Step 3 Finish -> Close Modal
  const handleFinishOnboarding = (action?: 'create' | 'join') => {
    setShowOnboarding(false);
    if (action === 'create' && onOpenCreateTrip) {
      onOpenCreateTrip();
    } else if (action === 'join' && onOpenJoinTrip) {
      onOpenJoinTrip();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white border border-[#E5EAF1] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Step Indicator Header */}
        <div className="px-6 py-4 border-b border-[#E5EAF1] bg-[#F4F7FB]/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#173B70] text-white flex items-center justify-center text-xs font-bold">
              ₹
            </div>
            <div>
              <span className="text-xs font-bold text-[#172B4D]">TripSplit Onboarding</span>
              <p className="text-[10px] text-[#64748B]">
                Step {step} of 3: {step === 1 ? 'Profile Setup' : step === 2 ? 'Permissions & Privacy' : 'Welcome'}
              </p>
            </div>
          </div>

          {/* Progress Dots */}
          <div className="flex items-center gap-1.5">
            <span className={`w-6 h-1.5 rounded-full transition-all ${step >= 1 ? 'bg-[#1685D4]' : 'bg-slate-200'}`} />
            <span className={`w-6 h-1.5 rounded-full transition-all ${step >= 2 ? 'bg-[#1685D4]' : 'bg-slate-200'}`} />
            <span className={`w-6 h-1.5 rounded-full transition-all ${step === 3 ? 'bg-emerald-500' : 'bg-slate-200'}`} />
          </div>
        </div>

        {/* Scrollable Step Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* ================= STEP 1: COMPLETE YOUR PROFILE (Screen 3) ================= */}
          {step === 1 && (
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="text-center pb-2">
                <h3 className="text-lg font-bold text-[#172B4D]">Complete Your Traveler Profile</h3>
                <p className="text-xs text-[#64748B] mt-1">
                  Personalize your profile and set your UPI ID for direct bill settlements.
                </p>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs text-rose-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                  <span>{error}</span>
                </div>
              )}

              {/* Avatar Selector */}
              <div>
                <label className="block text-xs font-semibold text-[#172B4D] mb-2">
                  Select Profile Avatar
                </label>
                <div className="flex items-center gap-3">
                  {sampleAvatars.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedAvatar(url)}
                      className={`relative w-12 h-12 rounded-full overflow-hidden border-2 transition-all ${
                        selectedAvatar === url
                          ? 'border-[#1685D4] ring-2 ring-[#1685D4]/20 scale-105'
                          : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={url} alt={`Avatar ${idx}`} className="w-full h-full object-cover" />
                      {selectedAvatar === url && (
                        <div className="absolute inset-0 bg-[#1685D4]/20 flex items-center justify-center">
                          <Check className="w-4 h-4 text-white stroke-[3]" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                  Full Display Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Aarav Sharma"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E5EAF1] bg-[#F4F7FB] text-xs font-medium text-[#172B4D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1685D4]/20 focus:border-[#1685D4]"
                  />
                </div>
              </div>

              {/* UPI ID */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[#172B4D]">
                    UPI ID for Settlements <span className="text-slate-400 font-normal">(optional now)</span>
                  </label>
                  <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                    Direct P2P
                  </span>
                </div>
                <div className="relative">
                  <CreditCard className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="e.g. aarav@okhdfcbank or 9876543210@paytm"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E5EAF1] bg-[#F4F7FB] text-xs font-medium text-[#172B4D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1685D4]/20 focus:border-[#1685D4]"
                  />
                </div>
                <p className="text-[10px] text-[#64748B] mt-1">
                  Friends pay your share directly into this UPI ID. Never enter UPI PIN.
                </p>
              </div>

              {/* Currency & Language Row */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                    Preferred Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5EAF1] bg-[#F4F7FB] text-xs font-medium text-[#172B4D] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1685D4]"
                  >
                    <option value="INR (₹)">Indian Rupee (₹)</option>
                    <option value="USD ($)">US Dollar ($)</option>
                    <option value="EUR (€)">Euro (€)</option>
                    <option value="GBP (£)">British Pound (£)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                    Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5EAF1] bg-[#F4F7FB] text-xs font-medium text-[#172B4D] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1685D4]"
                  >
                    <option value="English">English</option>
                    <option value="Hindi">हिंदी (Hindi)</option>
                  </select>
                </div>
              </div>

              {/* Travel Interests (Inspired by Image 3) */}
              <div>
                <label className="block text-xs font-semibold text-[#172B4D] mb-1.5">
                  Travel Interests <span className="text-[10px] text-[#64748B] font-normal">(select what you love)</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {travelInterestOptions.map((interest) => {
                    const isSelected = selectedInterests.includes(interest);
                    return (
                      <button
                        key={interest}
                        type="button"
                        onClick={() => toggleInterest(interest)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                          isSelected
                            ? 'bg-[#173B70] text-white shadow-xs'
                            : 'bg-[#F4F7FB] text-[#64748B] hover:bg-slate-200'
                        }`}
                      >
                        {isSelected && '✓ '}
                        {interest}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Buttons */}
              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-xl bg-[#173B70] hover:bg-[#1685D4] text-white font-bold text-xs tracking-wide shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <span>{isSubmitting ? 'Saving Profile...' : 'Continue to Privacy & Permissions'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* ================= STEP 2: PERMISSIONS & PRIVACY CENTER (Screen 4 - Image 4) ================= */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="text-center pb-1">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1685D4] flex items-center justify-center mx-auto mb-2">
                  <ShieldCheck className="w-5 h-5 stroke-[2]" />
                </div>
                <h3 className="text-lg font-bold text-[#172B4D]">Permissions & Privacy Center</h3>
                <p className="text-xs text-[#64748B] mt-1 max-w-sm mx-auto">
                  TripSplit is built privacy-first. We explain why each permission is used before you grant it.
                </p>
              </div>

              {/* Permission Item Cards */}
              <div className="space-y-2.5">
                {/* 1. Camera */}
                <div className="p-3.5 rounded-xl border border-[#E5EAF1] bg-[#F4F7FB]/60 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                      <Camera className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#172B4D]">Camera & QR Scanner</h4>
                      <p className="text-[11px] text-[#64748B]">Scan merchant UPI QR codes and paper restaurant bills.</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={permissions.camera}
                    onChange={() => togglePermission('camera')}
                    className="w-4 h-4 accent-[#1685D4] rounded cursor-pointer"
                  />
                </div>

                {/* 2. Notifications */}
                <div className="p-3.5 rounded-xl border border-[#E5EAF1] bg-[#F4F7FB]/60 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#172B4D]">Trip Notifications</h4>
                      <p className="text-[11px] text-[#64748B]">Get notified when trip buddies add expenses or settle up.</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={permissions.notifications}
                    onChange={() => togglePermission('notifications')}
                    className="w-4 h-4 accent-[#1685D4] rounded cursor-pointer"
                  />
                </div>

                {/* 3. Photos & Documents */}
                <div className="p-3.5 rounded-xl border border-[#E5EAF1] bg-[#F4F7FB]/60 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#172B4D]">Photos & Vouchers</h4>
                      <p className="text-[11px] text-[#64748B]">Upload receipt images, flight tickets, and hotel bookings.</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={permissions.photos}
                    onChange={() => togglePermission('photos')}
                    className="w-4 h-4 accent-[#1685D4] rounded cursor-pointer"
                  />
                </div>

                {/* 4. Contacts */}
                <div className="p-3.5 rounded-xl border border-[#E5EAF1] bg-[#F4F7FB]/60 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#172B4D]">Contacts Invite (Optional)</h4>
                      <p className="text-[11px] text-[#64748B]">Easily select buddies to invite. Manual link sharing always works.</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={permissions.contacts}
                    onChange={() => togglePermission('contacts')}
                    className="w-4 h-4 accent-[#1685D4] rounded cursor-pointer"
                  />
                </div>

                {/* 5. Location */}
                <div className="p-3.5 rounded-xl border border-[#E5EAF1] bg-[#F4F7FB]/60 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#172B4D]">Location Assistance (Optional)</h4>
                      <p className="text-[11px] text-[#64748B]">Suggest nearby cafes, viewpoints, and itinerary pins.</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={permissions.location}
                    onChange={() => togglePermission('location')}
                    className="w-4 h-4 accent-[#1685D4] rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={handlePermissionsSubmit}
                  className="flex-1 py-3 rounded-xl bg-[#173B70] hover:bg-[#1685D4] text-white font-bold text-xs tracking-wide shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <span>Save Privacy Preferences</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-4 py-3 rounded-xl border border-[#E5EAF1] text-xs font-semibold text-[#64748B] hover:text-[#172B4D] hover:bg-slate-100 transition-colors"
                >
                  Remind Me Later
                </button>
              </div>
            </div>
          )}

          {/* ================= STEP 3: PERSONALIZED WELCOME (Screen 5) ================= */}
          {step === 3 && (
            <div className="space-y-5 text-center py-2">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-8 h-8 stroke-[2]" />
              </div>

              <div>
                <h3 className="text-xl font-extrabold text-[#172B4D]">
                  Welcome to TripSplit, {displayName.split(' ')[0] || 'Traveler'}! 🎉
                </h3>
                <p className="text-xs text-[#64748B] mt-1.5 max-w-sm mx-auto">
                  Your profile and privacy preferences are configured. Ready to start planning and splitting your next journey?
                </p>
              </div>

              {/* 2 Primary Actions Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-left">
                <button
                  type="button"
                  onClick={() => handleFinishOnboarding('create')}
                  className="p-4 rounded-xl border-2 border-[#1685D4]/40 bg-[#EBF5FB]/40 hover:bg-[#EBF5FB] transition-all group flex flex-col justify-between"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#1685D4] text-white flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#172B4D]">Create Your First Outing</h4>
                    <p className="text-[11px] text-[#64748B] mt-0.5">
                      Set destination, invite friends, and start adding plans.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleFinishOnboarding('join')}
                  className="p-4 rounded-xl border border-[#E5EAF1] bg-[#F4F7FB]/60 hover:bg-[#F4F7FB] transition-all group flex flex-col justify-between"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#173B70] text-white flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#172B4D]">Join An Existing Trip</h4>
                    <p className="text-[11px] text-[#64748B] mt-0.5">
                      Enter a 6-digit trip code or invite link from a friend.
                    </p>
                  </div>
                </button>
              </div>

              {/* Direct to Dashboard Button */}
              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => handleFinishOnboarding()}
                  className="w-full py-3 rounded-xl bg-[#172B4D] hover:bg-[#173B70] text-white font-bold text-xs tracking-wide shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <span>Go to My Travel Dashboard</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
