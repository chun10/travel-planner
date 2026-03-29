"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { ItineraryDay } from './types';

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

  // 1. Get trip ID from URL first, then localStorage
  const getTripId = () => {
    if (typeof window === 'undefined') return null;
    
    // Check URL param first
    const params = new URLSearchParams(window.location.search);
    const urlTripId = params.get('trip');
    if (urlTripId) {
      localStorage.setItem(TRIP_ID_KEY, urlTripId);
      return urlTripId;
    }
    
    // Then check localStorage
    return localStorage.getItem(TRIP_ID_KEY);
  };
  
  const currentTripId = getTripId();
  
  // 2. Query from Convex - this is the SOLE source of truth
  const tripData = useQuery(api.functions.getOrCreateTrip, { tripId: currentTripId || undefined });

  // 3. When Convex returns data, use it (always prefer remote data)
  useEffect(() => {
    if (!tripData) return;
    
    if (tripData.trip) {
      // Set trip ID
      setTripId(tripData.trip._id);
      localStorage.setItem(TRIP_ID_KEY, tripData.trip._id);
      
      // Set trip name
      setTripName(tripData.trip.name);
      
      // Set days and selected day
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
        setSelectedDayId(mappedDays[0]?.id || '');
      }
      
      // Set trip links
      if (tripData.tripLinks) {
        setTripLinks(tripData.tripLinks.map((l: any) => ({
          id: l._id,
          title: l.title,
          url: l.url,
        })));
      }
      
      setIsLoaded(true);
    }
  }, [tripData]);

  // 4. Save mutation
  const saveTrip = useMutation(api.functions.saveTrip);

  // 5. Save to Convex when data changes (debounced)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveToConvex = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    setIsSaving(true);
    
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await saveTrip({
          tripId: tripId || undefined,
          name: tripName,
          days: days.map(d => ({
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
          tripLinks: tripLinks.map(l => ({
            id: l.id,
            title: l.title,
            url: l.url,
          })),
        });
        
        console.log('Saved to Convex');
      } catch (err) {
        console.error('Failed to save to Convex:', err);
      }
      setIsSaving(false);
    }, 500);
  }, [tripId, tripName, days, tripLinks, saveTrip]);

  // 6. Trigger save when user edits data (but not on initial load)
  const isInitialLoad = useRef(true);
  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
    saveToConvex();
  }, [tripName, days, tripLinks]);

  // Wrappers
  const updateDays = useCallback((updater: React.SetStateAction<ItineraryDay[]>) => {
    setDays(updater);
  }, []);

  const updateTripLinks = useCallback((updater: React.SetStateAction<TripLink[]>) => {
    setTripLinks(updater);
  }, []);

  const updateTripName = useCallback((name: string) => {
    setTripName(name);
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
