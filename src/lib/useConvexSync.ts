"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { ItineraryDay } from './types';

const STORAGE_KEY = 'trip-planner-data';
const TRIP_ID_KEY = 'trip-planner-trip-id';

interface TripLink {
  id: string;
  title: string;
  url: string;
}

export function useConvexSync(initialDays: ItineraryDay[], initialTripLinks: TripLink[]) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [tripName, setTripName] = useState('TripPlanner');
  const [days, setDays] = useState<ItineraryDay[]>(initialDays);
  const [tripLinks, setTripLinks] = useState<TripLink[]>(initialTripLinks);
  const [selectedDayId, setSelectedDayId] = useState(initialDays[0]?.id || '');
  const [tripId, setTripId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Get URL trip ID
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlTripId = params.get('trip');
      if (urlTripId) {
        localStorage.setItem(TRIP_ID_KEY, urlTripId);
      }
    }
  }, []);

  // Load from localStorage first (instant)
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.days && parsed.days.length > 0) {
          setTripName(parsed.tripName || 'TripPlanner');
          setDays(parsed.days);
          setTripLinks(parsed.tripLinks || initialTripLinks);
          setSelectedDayId(parsed.selectedDayId || parsed.days[0]?.id || '');
        }
      } catch {}
    }
    setIsLoaded(true);
  }, []);

  // Query trip from Convex - built-in real-time subscription!
  const storedTripId = typeof window !== 'undefined' ? localStorage.getItem(TRIP_ID_KEY) : null;
  const tripData = useQuery(api.functions.getOrCreateTrip, { tripId: storedTripId || undefined });

  // Initialize tripId from Convex data ONCE on initial load
  const hasSetTripId = useRef(false);
  useEffect(() => {
    if (tripData?.trip && !hasSetTripId.current) {
      hasSetTripId.current = true;
      setTripId(tripData.trip._id);
      
      // Load trip data into state (only on first load)
      if (tripData.days && tripData.days.length > 0) {
        const mappedDays = tripData.days.map((d: any) => ({
          id: d._id,
          date: d.date,
          title: d.title,
          notes: d.notes || '',
          events: (d.events || []).map((e: any) => ({
            id: e._id,
            time: e.time,
            locationName: e.locationName,
            coordinates: e.coordinates,
            description: e.description,
            eventType: e.eventType,
            transportToNext: e.transportToNext,
            links: e.links || [],
          })),
        }));
        
        // Only set if localStorage is empty (first visit)
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved || !JSON.parse(saved).days?.length) {
          setDays(mappedDays);
          setSelectedDayId(mappedDays[0]?.id || '');
        }
      }
      
      if (tripData.tripLinks) {
        setTripLinks(tripData.tripLinks.map((l: any) => ({
          id: l._id,
          title: l.title,
          url: l.url,
        })));
      }
    }
  }, [tripData]);

  // Save mutation
  const saveTrip = useMutation(api.functions.saveTrip);

  // Save to Convex with debounce
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveToConvex = useCallback(async (newDays: ItineraryDay[], newLinks: TripLink[], name?: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    setIsSaving(true);
    
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const result = await saveTrip({
          tripId: tripId || undefined,
          name: name || tripName,
          days: newDays.map(d => ({
            id: d.id,
            date: d.date,
            title: d.title,
            notes: d.notes || '',
            sortOrder: 0,
            events: d.events.map(e => ({
              id: e.id,
              time: e.time,
              locationName: e.locationName,
              coordinates: e.coordinates,
              description: e.description,
              eventType: e.eventType,
              transportToNext: e.transportToNext,
              links: e.links,
              sortOrder: 0,
            })),
          })),
          tripLinks: newLinks.map(l => ({
            id: l.id,
            title: l.title,
            url: l.url,
          })),
        });
        
        if (result && !tripId) {
          setTripId(result);
          localStorage.setItem(TRIP_ID_KEY, result);
        }
        
        console.log('Saved to Convex:', result);
      } catch (err) {
        console.error('Failed to save to Convex:', err);
      }
      setIsSaving(false);
    }, 1000);
  }, [tripId, tripName, saveTrip]);

  // Save to localStorage on every change
  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      tripName,
      days,
      tripLinks,
      selectedDayId,
    }));
  }, [tripName, days, tripLinks, selectedDayId, isLoaded]);

  // Wrapper for setDays that triggers save
  const updateDays = useCallback((updater: React.SetStateAction<ItineraryDay[]>) => {
    setDays(prev => {
      const next = typeof updater === 'function' ? (updater as (p: ItineraryDay[]) => ItineraryDay[])(prev) : updater;
      saveToConvex(next, tripLinks);
      return next;
    });
  }, [tripLinks, saveToConvex]);

  // Wrapper for setTripLinks that triggers save
  const updateTripLinks = useCallback((updater: React.SetStateAction<TripLink[]>) => {
    setTripLinks(prev => {
      const next = typeof updater === 'function' ? (updater as (p: TripLink[]) => TripLink[])(prev) : updater;
      saveToConvex(days, next);
      return next;
    });
  }, [days, saveToConvex]);

  // Wrapper for setTripName that triggers save
  const updateTripName = useCallback((name: string) => {
    setTripName(name);
    localStorage.setItem('tripNameEdited', 'true');
    // Also save the name change
    saveToConvex(days, tripLinks, name);
  }, [days, tripLinks, saveToConvex]);

  return {
    isLoaded,
    isSaving,
    tripName,
    setTripName: updateTripName,
    days,
    setDays: updateDays,
    tripLinks,
    setTripLinks: updateTripLinks,
    selectedDayId,
    setSelectedDayId,
    tripId,
  };
}
