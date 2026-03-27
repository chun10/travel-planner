"use client";

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'trip-planner-data';

interface TripLink {
  id: string;
  title: string;
  url: string;
}

interface StoredData {
  tripName: string;
  days: any[];
  tripLinks: TripLink[];
  selectedDayId: string;
}

export function useLocalStorage(initialDays: any[], initialTripLinks: TripLink[]) {
  const [isLoaded, setIsLoaded] = useState(false);

  const [tripName, setTripName] = useState('TripPlanner');
  const [days, setDays] = useState(initialDays);
  const [tripLinks, setTripLinks] = useState(initialTripLinks);
  const [selectedDayId, setSelectedDayId] = useState(initialDays[0]?.id || '');

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: StoredData = JSON.parse(raw);
        if (parsed.days && parsed.days.length > 0) {
          setTripName(parsed.tripName || 'TripPlanner');
          setDays(parsed.days);
          setTripLinks(parsed.tripLinks || initialTripLinks);
          setSelectedDayId(parsed.selectedDayId || parsed.days[0]?.id || '');
        }
      }
    } catch (e) {
      console.warn('Failed to load from localStorage', e);
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage whenever data changes
  useEffect(() => {
    if (!isLoaded) return;
    try {
      const data: StoredData = { tripName, days, tripLinks, selectedDayId };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save to localStorage', e);
    }
  }, [tripName, days, tripLinks, selectedDayId, isLoaded]);

  return {
    isLoaded,
    tripName, setTripName,
    days, setDays,
    tripLinks, setTripLinks,
    selectedDayId, setSelectedDayId,
  };
}
