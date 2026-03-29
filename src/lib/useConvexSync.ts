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
  // Use a timeout to debounce updates and avoid overwriting frequently
  const lastSyncRef = useRef<number>(0);
  
  // Helper: compare if days are effectively the same
  const areDaysEqual = (a: ItineraryDay[], b: ItineraryDay[]) => {
    if (a.length !== b.length) return false;
    return a.every((day, i) => 
      day.id === b[i]?.id && 
      day.title === b[i]?.title &&
      day.date === b[i]?.date &&
      day.events.length === b[i]?.events.length
    );
};
   
// Track if update came from remote Convex (to allow) vs local edit (to skip)
  // Default is true to allow remote updates
  const isRemoteUpdateRef = useRef(true);
  
  useEffect(() => {
    // Skip if this is not a remote update (local edit in progress)
    if (!isRemoteUpdateRef.current) return;
    
if (!tripData || !isLoaded) return;
    
    // If we just saved locally, skip this Convex update to prevent loop
    if (!isRemoteUpdateRef.current) {
      // We just did a local save - don't update from remote to prevent infinite loop
      // Reset to allow future remote updates after cooldown
      setTimeout(() => { isRemoteUpdateRef.current = true; }, 2000);
      return;
    }
    
    // Debounce: only sync if 1 second has passed since last sync
    const now = Date.now();
    if (now - lastSyncRef.current < 1000) return;
    lastSyncRef.current = now;
    
    if (tripData.trip) {
      setTripId(tripData.trip._id);
      
      // Only update tripName if user hasn't edited it locally
      // Preserve user's custom title
      const hasUserEditedTitle = localStorage.getItem('tripNameEdited') === 'true';
      if (!hasUserEditedTitle) {
        setTripName(tripData.trip.name);
      }
      
      if (tripData.days && tripData.days.length > 0) {
        const newMappedDays = tripData.days.map((d: any) => ({
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
        
        // Only update days if they've actually changed (prevent unnecessary re-renders)
        if (!areDaysEqual(days, newMappedDays)) {
          setDays(newMappedDays);
        }
        
        // Keep user's selected day if it exists in the loaded days
        const currentSelectedExists = newMappedDays.some(d => d.id === selectedDayId);
        if (!currentSelectedExists) {
          setSelectedDayId(newMappedDays[0]?.id || '');
        }
      }
      
      if (tripData.tripLinks) {
        const newTripLinks = tripData.tripLinks.map((l: any) => ({
          id: l._id,
          title: l.title,
          url: l.url,
        }));
        
        // Only update links if they've actually changed
        const isLinksChanged = tripLinks.length !== newTripLinks.length || 
          tripLinks.some((l, i) => l.id !== newTripLinks[i]?.id || l.title !== newTripLinks[i]?.title);
        
        if (isLinksChanged) {
          setTripLinks(newTripLinks);
        }
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
        // Mark as NOT a remote update (we initiated local edit)
        isRemoteUpdateRef.current = false;
        
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

  // Save tripName to Convex when it changes
  const saveTimeoutRefTripName = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tripNameRef = useRef(tripName);
  tripNameRef.current = tripName;
  
  useEffect(() => {
    if (!isLoaded || !tripId) return;
    
    // Debounce save tripName to Convex
    if (saveTimeoutRefTripName.current) {
      clearTimeout(saveTimeoutRefTripName.current);
    }
    
    saveTimeoutRefTripName.current = setTimeout(async () => {
      try {
        // Save with current days and tripLinks to avoid clearing them
        await saveTrip({
          tripId,
          name: tripNameRef.current,
          days: [],
          tripLinks: [],
        });
        console.log('Trip name saved to Convex:', tripNameRef.current);
      } catch (err) {
        console.error('Failed to save trip name:', err);
      }
    }, 1000);
  }, [tripName, tripId, isLoaded]);

  // Save to Convex when data changes
  useEffect(() => {
    if (!isLoaded) return;
    
    // Mark as NOT a remote update BEFORE saving (this is a local edit)
    isRemoteUpdateRef.current = false;
    
    saveToConvex(days, tripLinks);
  }, [days, tripLinks]);

  const updateDays = useCallback((updater: React.SetStateAction<ItineraryDay[]>) => {
    setDays(updater);
  }, []);

  const updateTripLinks = useCallback((updater: React.SetStateAction<TripLink[]>) => {
    setTripLinks(updater);
  }, []);

  const updateTripName = useCallback((name: string) => {
    setTripName(name);
    // Mark that user has edited the title
    localStorage.setItem('tripNameEdited', 'true');
  }, []);

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
