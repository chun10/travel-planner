"use client";

import React, { useState, useRef, useEffect } from 'react';
import Timeline from '../components/Timeline';
import LoginScreen from '../components/LoginScreen';
import ShareModal from '../components/ShareModal';
import { initialItinerary } from '../lib/mockData';
import { DayEvent, ItineraryDay } from '../lib/types';
import { useSupabaseSync } from '../lib/useSupabaseSync';
import { useAuth } from '../lib/AuthContext';
import { MapPin, Users, Share2, Plus, Edit2, Check, X, LogOut, Cloud, CloudOff } from 'lucide-react';

const defaultTripLinks = [
  { id: 'link-vjw', title: 'Visit Japan Web', url: 'https://vjw-lp.digital.go.jp/zh-hant/' },
  { id: 'link-metro', title: '東京地鐵圖', url: 'https://www.tokyometro.jp/tcn/subwaymap/' },
  { id: 'link-suica', title: 'Suica 西瓜卡指南', url: 'https://www.jreast.co.jp/tc/pass/suica.html' }
];

export default function Home() {
  const { user, profile, loading, isConfigured, signOut } = useAuth();

  // If Supabase is configured, gate on auth
  if (isConfigured) {
    if (loading) {
      return (
        <div className="flex justify-center items-center w-full min-h-screen bg-slate-100 font-sans">
          <div className="flex flex-col items-center gap-3">
            <MapPin className="text-blue-600 animate-pulse" size={40} />
            <span className="text-slate-500 font-bold text-sm">載入中...</span>
          </div>
        </div>
      );
    }
    if (!user) {
      return <LoginScreen />;
    }
  }

  return (
    <MainApp
      user={user}
      displayName={profile?.display_name || user?.user_metadata?.full_name || user?.email || null}
      avatarUrl={profile?.avatar_url || user?.user_metadata?.avatar_url || null}
      isConfigured={isConfigured}
      onSignOut={signOut}
    />
  );
}

function MainApp({
  user,
  displayName,
  avatarUrl,
  isConfigured,
  onSignOut,
}: {
  user: any;
  displayName: string | null;
  avatarUrl: string | null;
  isConfigured: boolean;
  onSignOut: () => Promise<void>;
}) {
  const {
    isLoaded,
    tripName, setTripName,
    days, setDays,
    tripLinks, setTripLinks,
    selectedDayId, setSelectedDayId,
    tripId,
    forceSyncTripLinks,
  } = useSupabaseSync(initialItinerary, defaultTripLinks);

  const [isEditingTripName, setIsEditingTripName] = useState(false);
  const [tripNameInput, setTripNameInput] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');
  const tabsRef = useRef<HTMLDivElement>(null);
  const prevDaysLength = useRef(days.length);
  const hasInitialized = useRef(false);

  // Scroll to left on initial load (after DOM is fully ready)
  useEffect(() => {
    if (isLoaded && !hasInitialized.current) {
      hasInitialized.current = true;
      // Use requestAnimationFrame to ensure DOM is painted
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (tabsRef.current) {
            tabsRef.current.scrollLeft = 0;
          }
        });
      });
    }
  }, [isLoaded]);

  // Auto-scroll to right only when a NEW day is added (not on initial load)
  useEffect(() => {
    if (days.length > prevDaysLength.current && tabsRef.current) {
      tabsRef.current.scrollLeft = tabsRef.current.scrollWidth;
    }
    prevDaysLength.current = days.length;
  }, [days.length]);

  const selectedDay = days.find(d => d.id === selectedDayId) || days[0];

  const handleUpdateEvent = (eventId: string, updatedEvent: DayEvent) => {
    setDays((prevDays: ItineraryDay[]) => prevDays.map(day => {
      if (day.id === selectedDayId) {
        return {
          ...day,
          events: day.events.map(ev => ev.id === eventId ? updatedEvent : ev)
        };
      }
      return day;
    }));
  };

  const handleAddEvent = () => {
    const newEvent: DayEvent = {
      id: crypto.randomUUID(),
      time: '12:00',
      locationName: '新行程地點',
      coordinates: { lat: 25.0330, lng: 121.5654 },
      description: '點擊編輯按鈕來修改這個行程的詳細內容。',
    };

    setDays((prevDays: ItineraryDay[]) => prevDays.map(day => {
      if (day.id === selectedDayId) {
        return {
          ...day,
          events: [...day.events, newEvent].sort((a, b) => a.time.localeCompare(b.time))
        };
      }
      return day;
    }));
  };

  const handleDeleteEvent = (eventId: string) => {
    setDays((prevDays: ItineraryDay[]) => prevDays.map(day => {
      if (day.id === selectedDayId) {
        return {
          ...day,
          events: day.events.filter(ev => ev.id !== eventId)
        };
      }
      return day;
    }));
  };

  const handleUpdateDayTitle = (newTitle: string) => {
    setDays((prevDays: ItineraryDay[]) => prevDays.map(day => {
      if (day.id === selectedDayId) {
        return { ...day, title: newTitle };
      }
      return day;
    }));
  };

  const handleUpdateDayDate = (newDate: string) => {
    setDays((prevDays: ItineraryDay[]) => prevDays.map(day => {
      if (day.id === selectedDayId) {
        return { ...day, date: newDate };
      }
      return day;
    }));
  };

  const handleUpdateDayNotes = (newNotes: string) => {
    setDays((prevDays: ItineraryDay[]) => prevDays.map(day => {
      if (day.id === selectedDayId) {
        return { ...day, notes: newNotes };
      }
      return day;
    }));
  };

  const handleAddDay = () => {
    // Calculate next date based on last day
    let nextDate = '選擇日期';
    const lastDay = days[days.length - 1];
    if (lastDay && lastDay.date && /^\d{4}-\d{2}-\d{2}$/.test(lastDay.date)) {
      const d = new Date(lastDay.date + 'T00:00:00');
      d.setDate(d.getDate() + 1);
      nextDate = d.toISOString().slice(0, 10);
    }

    const newDayId = crypto.randomUUID();
    const newDay: ItineraryDay = {
      id: newDayId,
      date: nextDate,
      title: '自由活動',
      events: [],
      notes: ''
    };

    setDays((prevDays: ItineraryDay[]) => [...prevDays, newDay]);
    setSelectedDayId(newDayId);
  };

  const handleDeleteDay = (dayId: string) => {
    setDays((prevDays: ItineraryDay[]) => {
      const filtered = prevDays.filter(d => d.id !== dayId);
      if (filtered.length === 0) return prevDays; // prevent deleting last day
      return filtered;
    });
    if (selectedDayId === dayId) {
      setSelectedDayId(days.find(d => d.id !== dayId)?.id || days[0]?.id || '');
    }
  };

  const handleAddTripLink = () => {
    setTripLinks((prev: any[]) => [...prev, { id: crypto.randomUUID(), title: '', url: '' }]);
  };

  const handleUpdateTripLink = (id: string, field: 'title' | 'url', value: string) => {
    setTripLinks((prev: any[]) => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const handleDeleteTripLink = (id: string) => {
    setTripLinks((prev: any[]) => prev.filter(l => l.id !== id));
  };

  // Show loading screen while localStorage is being read
  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center w-full min-h-screen bg-slate-100 font-sans">
        <div className="flex flex-col items-center gap-3">
          <MapPin className="text-blue-600 animate-pulse" size={40} />
          <span className="text-slate-500 font-bold text-sm">載入行程中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center w-full min-h-screen bg-slate-100 font-sans sm:py-6 sm:px-4">
      <div className="flex flex-col w-full sm:max-w-[420px] bg-white h-[100dvh] sm:h-[850px] sm:rounded-[40px] shadow-2xl overflow-hidden relative border border-slate-200">
        
        {/* App Top Bar */}
        <div className="bg-white px-5 py-4 flex justify-between items-center shadow-sm z-20 shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <MapPin className="text-blue-600 shrink-0" size={24} />
            {isEditingTripName ? (
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <input
                  type="text"
                  value={tripNameInput}
                  onChange={(e) => setTripNameInput(e.target.value)}
                  className="font-extrabold text-xl text-slate-800 border-b-2 border-blue-500 focus:outline-none bg-transparent w-full min-w-0"
                  autoFocus
                />
                <button onClick={() => { setTripName(tripNameInput); setIsEditingTripName(false); }} className="text-green-600 p-1 hover:bg-green-50 rounded-full shrink-0"><Check size={18} /></button>
                <button onClick={() => { setIsEditingTripName(false); setTripNameInput(tripName); }} className="text-slate-400 p-1 hover:bg-slate-50 rounded-full shrink-0"><X size={18} /></button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 cursor-pointer group min-w-0" onClick={() => { setIsEditingTripName(true); setTripNameInput(tripName); }}>
                <h1 className="font-extrabold text-xl text-slate-800 tracking-tight truncate group-hover:text-blue-600 transition-colors">{tripName}</h1>
                <Edit2 size={14} className="text-slate-300 group-hover:text-blue-500 shrink-0" />
              </div>
            )}
          </div>
          <div className="flex gap-2 items-center shrink-0 ml-2">
            {isConfigured && (
              <span className="text-green-500" title="雲端同步中">
                <Cloud size={16} />
              </span>
            )}
            <button onClick={() => setShowShareModal(true)} className="hover:bg-slate-100 p-2 rounded-full transition-colors text-slate-500"><Users size={20} /></button>
            <button onClick={() => setShowShareModal(true)} className="hover:bg-slate-100 p-2 rounded-full transition-colors text-slate-500"><Share2 size={20} /></button>

            {/* User avatar / menu */}
            {isConfigured && user && (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold overflow-hidden ring-2 ring-white shadow-sm hover:ring-blue-200 transition-all"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (displayName || 'U')[0].toUpperCase()
                  )}
                </button>
                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-30 pointer-events-auto" onClick={() => setShowUserMenu(false)} />
                    <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 px-1 z-50 w-48 pointer-events-auto">
                      <div className="px-3 py-2 border-b border-slate-100 mb-1">
                        <p className="text-xs font-bold text-slate-700 truncate">{displayName || '使用者'}</p>
                        <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowUserMenu(false); onSignOut(); }}
                        className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm text-red-600 font-semibold hover:bg-red-50 rounded-xl transition-colors"
                      >
                        <LogOut size={14} />
                        登出
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Days Horizontal Tabs */}
        <div className="bg-white border-b border-slate-100 px-3 py-3 flex items-center gap-2 shrink-0 z-10 shadow-sm relative">
          <div ref={tabsRef} className="flex overflow-x-auto scroll-thin gap-2 flex-1" style={{ direction: 'ltr' }}>
            {days.map((day: ItineraryDay, index: number) => (
              <button
                key={day.id}
                onClick={() => setSelectedDayId(day.id)}
                className={`shrink-0 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
                  selectedDayId === day.id
                    ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-600 ring-offset-2'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Day {index + 1}
              </button>
            ))}
            <button
              onClick={handleAddDay}
              className="shrink-0 px-4 py-2.5 flex items-center justify-center rounded-full bg-blue-50 border-2 border-blue-200 text-blue-600 hover:bg-blue-100 hover:border-blue-400 transition-all font-semibold text-sm gap-1"
            >
              <Plus size={16} /> 新增
            </button>
          </div>
        </div>

        {/* Timeline Area */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
          {selectedDay ? (
            <Timeline 
              day={selectedDay} 
              onUpdateEvent={handleUpdateEvent}
              onAddEvent={handleAddEvent}
              onDeleteEvent={handleDeleteEvent}
              onDeleteDay={handleDeleteDay}
              onUpdateDayTitle={handleUpdateDayTitle}
              onUpdateDayDate={handleUpdateDayDate}
              onUpdateDayNotes={handleUpdateDayNotes}
              tripLinks={tripLinks}
              onAddTripLink={handleAddTripLink}
              onUpdateTripLink={handleUpdateTripLink}
              onDeleteTripLink={handleDeleteTripLink}
              onSaveTripLinks={() => {
                // Force immediate sync when editing is done
                forceSyncTripLinks(tripLinks);
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
              <p className="text-sm font-medium">尚無行程</p>
              <button onClick={handleAddDay} className="text-sm text-blue-600 font-bold underline">新增第一天</button>
            </div>
          )}
        </div>
        
        {/* Home Indicator */}
        <div className="h-1.5 w-1/3 bg-slate-300 rounded-full mx-auto mb-2 mt-2 shrink-0 hidden sm:block"></div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <ShareModal
          tripId={tripId}
          tripName={tripName}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}
