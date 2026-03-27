"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';
import type { User, Session } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  isConfigured: boolean;
  signInWithGoogle: () => Promise<void>;
  signInAsGuest: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  session: null,
  loading: true,
  isConfigured: false,
  signInWithGoogle: async () => {},
  signInAsGuest: async () => ({ error: null }),
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const GUEST_NICKNAME = '訪客';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  // Fetch profile from profiles table
  const fetchProfile = async (userId: string) => {
    if (!isSupabaseConfigured) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) setProfile(data as Profile);
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Get initial session with timeout
    const timeout = setTimeout(() => {
      console.warn('Supabase auth timeout — showing login');
      setLoading(false);
    }, 5000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timeout);
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    }).catch((err) => {
      clearTimeout(timeout);
      console.error('Supabase auth error:', err);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // ── Google OAuth 登入 ──
  const signInWithGoogle = async () => {
    if (!isSupabaseConfigured) return;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  };

  // ── 訪客登入（Supabase anonymous sign-in） ──
  const signInAsGuest = async () => {
    if (!isSupabaseConfigured) return { error: 'Supabase 尚未設定' };

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      // 匿名登入未啟用時回傳友善錯誤
      return { error: `訪客登入失敗: ${error.message}。請到 Supabase Dashboard 啟用 Anonymous Sign-ins。` };
    }

    // 設定訪客暱稱
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        display_name: GUEST_NICKNAME,
      });
    }
    return { error: null };
  };

  // ── 登出 ──
  const signOut = async () => {
    try {
      if (isSupabaseConfigured) {
        await supabase.auth.signOut();
      }
    } catch (e) {
      console.error('Sign out error:', e);
    }
    setUser(null);
    setProfile(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{
      user, profile, session, loading,
      isConfigured: isSupabaseConfigured,
      signInWithGoogle, signInAsGuest, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
