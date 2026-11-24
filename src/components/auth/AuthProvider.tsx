'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { createClient, isSupabaseConfigured } from '../../lib/supabase/client';
import { DbProfile } from '../../types/trip';
import { currentUser as mockUser } from '../../data/mockData';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  profile: DbProfile | null;
  isLoading: boolean;
  isConfigured: boolean;
  showOnboarding: boolean;
  setShowOnboarding: (show: boolean) => void;
  signOut: () => Promise<void>;
  updateProfile: (data: { displayName: string; upiId: string }) => Promise<boolean>;
  signInAsDemo: (demoData?: { name?: string; email?: string; upiId?: string }) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isLoading: true,
  isConfigured: false,
  showOnboarding: false,
  setShowOnboarding: () => {},
  signOut: async () => {},
  updateProfile: async () => false,
  signInAsDemo: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<DbProfile | null>(() => {
    if (!isSupabaseConfigured) {
      if (typeof window !== 'undefined' && sessionStorage.getItem('tripsplit_preview_signed_out') === 'true') {
        return null;
      }
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('tripsplit_demo_user');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            return {
              id: parsed.id || mockUser.id,
              display_name: parsed.name || mockUser.name,
              upi_id: parsed.upiId || mockUser.upiId,
              avatar_url: parsed.avatar || mockUser.avatar,
            };
          } catch {
            // fallback
          }
        }
      }
      return {
        id: mockUser.id,
        display_name: mockUser.name,
        upi_id: mockUser.upiId,
        avatar_url: mockUser.avatar,
      };
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => isSupabaseConfigured);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const router = useRouter();

  const supabase = useMemo(() => createClient(), []);

  const fetchProfile = useCallback(
    async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.warn('Error fetching profile:', error.message);
        }

        if (data) {
          setProfile(data);
          if (!data.upi_id) {
            setShowOnboarding(true);
          }
        } else {
          setShowOnboarding(true);
        }
      } catch {
        setShowOnboarding(true);
      }
    },
    [supabase]
  );

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    const checkUser = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  const signInAsDemo = (demoData?: { name?: string; email?: string; upiId?: string }) => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('tripsplit_preview_signed_out');
      const demoObj = {
        id: 'usr_guest',
        name: demoData?.name || mockUser.name,
        email: demoData?.email || mockUser.email,
        avatar: mockUser.avatar,
        upiId: demoData?.upiId || mockUser.upiId,
      };
      localStorage.setItem('tripsplit_demo_user', JSON.stringify(demoObj));
      setProfile({
        id: demoObj.id,
        display_name: demoObj.name,
        upi_id: demoObj.upiId,
        avatar_url: demoObj.avatar,
      });
      setShowOnboarding(false);
    }
  };

  const signOut = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('tripsplit_preview_signed_out', 'true');
      localStorage.removeItem('tripsplit_demo_user');
    }
    setUser(null);
    setProfile(null);
    router.push('/login');
  };

  const updateProfile = async (data: { displayName: string; upiId: string }): Promise<boolean> => {
    if (!isSupabaseConfigured) {
      setProfile((prev) => ({
        id: prev?.id || 'demo_user',
        display_name: data.displayName,
        upi_id: data.upiId,
        avatar_url: prev?.avatar_url || mockUser.avatar,
      }));
      setShowOnboarding(false);
      return true;
    }

    if (!user) return false;

    try {
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        display_name: data.displayName,
        upi_id: data.upiId,
        avatar_url: user.user_metadata?.avatar_url || null,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error('Failed to update profile:', error.message);
        return false;
      }

      setProfile({
        id: user.id,
        display_name: data.displayName,
        upi_id: data.upiId,
        avatar_url: user.user_metadata?.avatar_url || null,
      });
      setShowOnboarding(false);
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isLoading,
        isConfigured: isSupabaseConfigured,
        showOnboarding,
        setShowOnboarding,
        signOut,
        updateProfile,
        signInAsDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
