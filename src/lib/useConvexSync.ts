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
  
  // Edit mode - user can edit locally, then save to Convex manually
  const [isEditing, setIsEditing] = useState(false);

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
  
  // Query from Convex (only on initial load)
  const tripData = useQuery(api.functions.getOrCreateTrip, { tripId: currentTripId || undefined });

  // Initialize from Convex ONLY once
  const hasInitiallyLoaded = useRef(false);
  
  useEffect(() => {
    if (hasInitiallyLoaded.current || !tripData || !tripData.trip) return;
    
    hasInitiallyLoaded.current = true;
    setTripId(tripData.trip._id);
    localStorage.setItem(TRIP_ID_KEY, tripData.trip._id);
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
      setSelectedDayId(mappedDays[0]?.id || '');
    }
    
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

  // Save to Convex (for edit mode)
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
      setIsEditing(false); // Exit edit mode after save
    } catch (err) {
      console.error('Failed to save to Convex:', err);
    }
    
    setIsSaving(false);
  }, [tripId, tripName, days, tripLinks, saveTrip, isSaving]);

  // Enter edit mode
  const enterEditMode = useCallback(() => {
    setIsEditing(true);
  }, []);

  // Cancel edit mode (revert to saved state)
  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    // Reload from Convex - simple way is page refresh
    window.location.reload();
  }, []);

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
    isEditing,         // Edit mode state
    tripName,
    setTripName: updateTripName,
    days,
    setDays: updateDays,
    tripLinks,
    setTripLinks: updateTripLinks,
    selectedDayId,
    setSelectedDayId,
    tripId,
    enterEditMode,     // Click to enter edit mode
    saveToConvex,       // Click to save after editing
    cancelEdit,        // Click to cancel and reload
  };
}
