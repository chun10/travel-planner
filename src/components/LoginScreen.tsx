"use client";

import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { MapPin, WifiOff } from 'lucide-react';

interface LoginScreenProps {
  onGuestMode?: () => void;
}

export default function LoginScreen({ onGuestMode }: LoginScreenProps) {
  const { signInWithGoogle, signInAsGuest } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    setLoading(true);
    setError('');
    await signInWithGoogle();
    setLoading(false);
  };

  const handleGuest = async () => {
    setLoading(true);
    setError('');
    const { error } = await signInAsGuest();
    if (error) setError(error);
    setLoading(false);
  };

  const handleOffline = () => {
    // Trigger callback to skip auth and use localStorage only
    if (onGuestMode) {
      onGuestMode();
    } else {
      // Fallback: reload without auth
      window.location.reload();
    }
  };

  return (
    <div className="flex justify-center items-center w-full min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 font-sans p-4">
      <div className="w-full max-w-[400px] flex flex-col items-center">
        
        {/* Logo */}
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-blue-600 p-3 rounded-2xl shadow-lg">
            <MapPin className="text-white" size={28} />
          </div>
          <h1 className="font-black text-3xl text-slate-800 tracking-tight">TripPlanner</h1>
        </div>
        <p className="text-slate-500 text-sm mb-10 font-medium">多人協作旅遊行程規劃</p>

        {/* Card */}
        <div className="w-full bg-white rounded-3xl shadow-xl border border-slate-200 p-8">
          
          <div className="text-center mb-6">
            <p className="text-slate-700 font-bold text-lg">選擇登入方式</p>
          </div>

          {/* Google Login */}
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-200 text-slate-700 font-bold py-3.5 px-4 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all text-sm disabled:opacity-50 mb-3"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            使用 Google 登入
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-slate-200"></div>
            <span className="text-xs text-slate-400 font-medium">或</span>
            <div className="flex-1 h-px bg-slate-200"></div>
          </div>

          {/* Guest Button */}
          <button
            onClick={handleGuest}
            disabled={loading}
            className="w-full bg-slate-100 text-slate-600 font-bold py-3.5 rounded-xl hover:bg-slate-200 active:scale-[0.98] transition-all text-sm disabled:opacity-50 mb-3"
          >
            以訪客身分進入
          </button>

          {/* Offline Button */}
          <button
            onClick={handleOffline}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-orange-50 text-orange-600 font-bold py-3 rounded-xl hover:bg-orange-100 active:scale-[0.98] transition-all text-sm disabled:opacity-50 border border-orange-200"
          >
            <WifiOff size={16} />
            離線使用（單機模式）
          </button>

          {error && (
            <div className="bg-red-50 text-red-600 text-xs font-bold px-4 py-2.5 rounded-xl border border-red-200 mt-4">
              {error}
            </div>
          )}
        </div>

        <p className="text-slate-400 text-[11px] mt-6 text-center">
          Google 登入可多人共用編輯行程
        </p>
      </div>
    </div>
  );
}
