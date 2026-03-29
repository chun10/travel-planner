"use client";

import React, { createContext, useContext } from 'react';

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
}

interface AuthContextType {
  user: any | null;
  profile: Profile | null;
  session: any | null;
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
  loading: false,
  isConfigured: true,
  signInWithGoogle: async () => {},
  signInAsGuest: async () => ({ error: null }),
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const GUEST_NICKNAME = '訪客';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Simplified auth - using Convex as backend only (no user auth required)
  const user = { id: 'guest-user' };
  const profile: Profile = {
    id: user.id,
    display_name: GUEST_NICKNAME,
    avatar_url: null,
    email: null,
  };

  const signInWithGoogle = async () => {
    console.log('Using Convex backend - no auth required');
    alert('使用 Convex 後端服務，無需登入');
  };

  const signInAsGuest = async () => {
    return { error: null };
  };

  const signOut = async () => {
    console.log('Sign out: Using Convex backend');
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      session: null,
      loading: false,
      isConfigured: true,
      signInWithGoogle,
      signInAsGuest,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
