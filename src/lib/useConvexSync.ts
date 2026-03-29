"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { ItineraryDay, DayEvent } from './types';

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

  // Query trip from Convex
  const tripData = useQuery(api.functions.getOrCreateTrip, { 
    tripId: (typeof window !== 'undefined' ? localStorage.getItem(TRIP_ID_KEY) : null) || undefined 
  });

  // When we get data from Convex, update local state
  // Only run once on initial load, not on every tripData change
  const hasInitiallyLoadedRef = useRef(false);
  
  useEffect(() => {
    if (!tripData || !isLoaded || hasInitiallyLoadedRef.current) return;
    
    if (tripData.trip) {
      hasInitiallyLoadedRef.current = true;
      
      setTripId(tripData.trip._id);
      setTripName(tripData.trip.name);
      
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
        setDays(mappedDays);
        // Keep user's selected day if it exists in the loaded days
        const currentSelectedExists = mappedDays.some(d => d.id === selectedDayId);
        if (currentSelectedExists) {
          // Keep current selection
        } else {
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

      // Save to localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        tripName: tripData.trip.name,
        days: tripData.days,
        tripLinks: tripData.tripLinks,
        selectedDayId: tripData.days?.[0]?._id,
      }));
    }
  }, [tripData, isLoaded, selectedDayId]);

  // Save mutation
  const saveTrip = useMutation(api.functions.saveTrip);

  // Auto-save to Convex (debounced)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveToConvex = useCallback(async (newDays: ItineraryDay[], newLinks: TripLink[]) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    setIsSaving(true);
    
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const result = await saveTrip({
          tripId: tripId || undefined,
          name: tripName,
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

  // Save to Convex when data changes
  useEffect(() => {
    if (!isLoaded) return;
    saveToConvex(days, tripLinks);
  }, [days, tripLinks]);

  const updateDays = useCallback((updater: React.SetStateAction<ItineraryDay[]>) => {
    setDays(updater);
  }, []);

  const updateTripLinks = useCallback((updater: React.SetStateAction<TripLink[]>) => {
    setTripLinks(updater);
  }, []);

  return {
    isLoaded,
    isSaving,
    tripName,
    setTripName,
    days,
    setDays: updateDays,
    tripLinks,
    setTripLinks: updateTripLinks,
    selectedDayId,
    setSelectedDayId,
    tripId,
  };
}
