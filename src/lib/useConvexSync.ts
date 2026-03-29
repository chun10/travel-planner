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

  // Get trip ID
  const getTripId = () => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const urlTripId = params.get('trip');
    if (urlTripId) {
      localStorage.setItem(TRIP_ID_KEY, urlTripId);
      return urlTripId;
    }
    return localStorage.getItem(TRIP_ID_KEY);
  };
  
  const currentTripId = getTripId();
  
  // Query from Convex (only on initial load, no auto-sync)
  const tripData = useQuery(api.functions.getOrCreateTrip, { tripId: currentTripId || undefined });

  // Initialize from Convex ONLY once on first load
  const hasInitiallyLoaded = useRef(false);
  
  useEffect(() => {
    if (hasInitiallyLoaded.current || !tripData || !tripData.trip) return;
    
    hasInitiallyLoaded.current = true;
    
    // Set trip ID
    setTripId(tripData.trip._id);
    localStorage.setItem(TRIP_ID_KEY, tripData.trip._id);
    
    // Set trip name
    setTripName(tripData.trip.name);
    
    // Set days
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
  }, [tripData]);

  // Save mutation
  const saveTrip = useMutation(api.functions.saveTrip);

  // Manual save to Convex (user triggers this)
  const saveToConvex = useCallback(async () => {
    if (!tripId || isSaving) return;
    
    setIsSaving(true);
    
    try {
      await saveTrip({
        tripId,
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
  }, [tripId, tripName, days, tripLinks, saveTrip, isSaving]);

  // Wrappers that trigger manual save
  const updateDays = useCallback((updater: React.SetStateAction<ItineraryDay[]>) => {
    setDays(updater);
  }, []);

  const updateTripLinks = useCallback((updater: React.SetStateAction<TripLink[]>) => {
    setTripLinks(updater);
  }, []);

  const updateTripName = useCallback((name: string) => {
    setTripName(name);
  }, []);

  // Manual refresh function - user can call this to sync from Convex
  const refreshFromConvex = useCallback(() => {
    // Reset the flag to allow re-loading from Convex
    hasInitiallyLoaded.current = false;
    // Force re-query by invalidating the query
    // This is a workaround - in practice user would refresh the page
    window.location.reload();
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
    saveToConvex,        // User must call this to save
    refreshFromConvex,   // User can call this to sync from Convex
  };
}
