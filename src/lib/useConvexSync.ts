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
  const [isEditing, setIsEditing] = useState(false);

  // Save mutation
  const saveTrip = useMutation(api.functions.saveTrip);

  // Initialize from Convex ONLY once
  const hasInitiallyLoaded = useRef(false);

  // Get trip ID from URL or localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlTripId = params.get('trip');
      const storedTripId = localStorage.getItem(TRIP_ID_KEY);
      const finalTripId = urlTripId || storedTripId || null;
      if (finalTripId) {
        setTripId(finalTripId);
        localStorage.setItem(TRIP_ID_KEY, finalTripId);
      }
    }
  }, []);

  // Query from Convex
  const tripData = useQuery(api.functions.getOrCreateTrip, { tripId: tripId || undefined });

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

  // Save to Convex
  const saveToConvex = useCallback(async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    
    try {
      const result = await saveTrip({
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
      
      if (result && !tripId) {
        setTripId(result);
        localStorage.setItem(TRIP_ID_KEY, result);
      }
      
      console.log('Saved to Convex');
      setIsEditing(false);
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
    isEditing,
    tripName,
    setTripName: updateTripName,
    days,
    setDays: updateDays,
    tripLinks,
    setTripLinks: updateTripLinks,
    selectedDayId,
    setSelectedDayId,
    tripId,
    enterEditMode,
    saveToConvex,
    cancelEdit,
  };
}
