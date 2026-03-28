"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';
import { useAuth } from './AuthContext';
import type { DayEvent, ItineraryDay, EventLink, TransportMode, EventType } from './types';

const STORAGE_KEY = 'trip-planner-data';
const TRIP_ID_KEY = 'trip-planner-trip-id';
const SYNC_TIMEOUT = 8000; // 8 seconds max for any Supabase call

/** Wrap any thenable with a timeout */
function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Supabase timeout')), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

interface TripLink {
  id: string;
  title: string;
  url: string;
}

interface StoredData {
  tripName: string;
  days: ItineraryDay[];
  tripLinks: TripLink[];
  selectedDayId: string;
}

// ── DB row types ──

interface TripRow {
  id: string;
  name: string;
  owner_id: string;
}

interface TripDayRow {
  id: string;
  trip_id: string;
  date: string;
  title: string;
  notes: string;
  sort_order: number;
}

interface DayEventRow {
  id: string;
  day_id: string;
  time: string;
  location_name: string;
  coordinates: { lat: number; lng: number };
  description: string;
  event_type: string;
  transport_to_next: { mode: string; duration: string; instructions?: string; fromStation?: string; toStation?: string } | null;
  links: EventLink[];
  sort_order: number;
}

interface TripLinkRow {
  id: string;
  trip_id: string;
  title: string;
  url: string;
}

// ── Mappers ──

function mapEventRow(row: DayEventRow): DayEvent {
  return {
    id: row.id,
    time: row.time,
    locationName: row.location_name,
    coordinates: row.coordinates,
    description: row.description,
    eventType: (row.event_type as EventType) || 'default',
    transportToNext: row.transport_to_next
      ? {
          mode: row.transport_to_next.mode as TransportMode,
          duration: row.transport_to_next.duration,
          instructions: row.transport_to_next.instructions,
          fromStation: row.transport_to_next.fromStation,
          toStation: row.transport_to_next.toStation,
        }
      : undefined,
    links: row.links || [],
  };
}

function mapDayRow(row: TripDayRow, events: DayEventRow[]): ItineraryDay {
  const dayEvents = events.filter((e) => e.day_id === row.id).sort((a, b) => a.sort_order - b.sort_order).map(mapEventRow);
  return { id: row.id, date: row.date, title: row.title, notes: row.notes || '', events: dayEvents };
}

// ── localStorage helpers ──

function loadFromLocalStorage(initialDays: any[], initialTripLinks: TripLink[]): StoredData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: StoredData = JSON.parse(raw);
      if (parsed.days && parsed.days.length > 0) {
        return {
          tripName: parsed.tripName || 'TripPlanner',
          days: parsed.days,
          tripLinks: parsed.tripLinks || initialTripLinks,
          selectedDayId: parsed.selectedDayId || parsed.days[0]?.id || '',
        };
      }
    }
  } catch (e) {
    console.warn('Failed to load from localStorage', e);
  }
  return {
    tripName: 'TripPlanner',
    days: initialDays,
    tripLinks: initialTripLinks,
    selectedDayId: initialDays[0]?.id || '',
  };
}

function saveToLocalStorage(data: StoredData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save to localStorage', e);
  }
}

// ── Main hook ──

export function useSupabaseSync(initialDays: any[], initialTripLinks: TripLink[]) {
  const { user } = useAuth();
  const [isLoaded, setIsLoaded] = useState(false);
  const [tripName, setTripName] = useState('TripPlanner');
  const [days, setDays] = useState<ItineraryDay[]>(initialDays);
  const [tripLinks, setTripLinks] = useState<TripLink[]>(initialTripLinks);
  const [selectedDayId, setSelectedDayId] = useState(initialDays[0]?.id || '');

  const tripIdRef = useRef<string | null>(null);
  const supabaseReady = isSupabaseConfigured && !!user;
  const syncedFromSupabase = useRef(false);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSyncRef = useRef<{ days?: ItineraryDay[]; links?: TripLink[] }>({});

  // ── Step 1: Always load from localStorage first (instant) ──
  useEffect(() => {
    const data = loadFromLocalStorage(initialDays, initialTripLinks);
    setTripName(data.tripName);
    setDays(data.days);
    setTripLinks(data.tripLinks);
    setSelectedDayId(data.selectedDayId);
    setIsLoaded(true);
  }, []);

  // ── Step 2: If Supabase is ready, sync from/to Supabase ──
  useEffect(() => {
    if (!supabaseReady || syncedFromSupabase.current) return;
    syncedFromSupabase.current = true;
    syncFromSupabase();
  }, [supabaseReady]);

  async function syncFromSupabase() {
    if (!user) return;
    try {
      // Check table exists (with timeout)
      const checkResult = await withTimeout(
        supabase.from('trips').select('id').limit(1),
        SYNC_TIMEOUT
      );
      const checkErr = (checkResult as any).error;
      if (checkErr) {
        console.warn('Trips table not accessible:', checkErr.message);
        return;
      }

      // Check URL for shared trip link (?trip=UUID)
      let urlTripId: string | null = null;
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        urlTripId = params.get('trip');
      }

      // ── KEY RULE: If localStorage has user data (not empty defaults), keep it ──
      const localRaw = localStorage.getItem(STORAGE_KEY);
      let localHasData = false;
      if (localRaw) {
        try {
          const parsed = JSON.parse(localRaw);
          localHasData = !!(parsed.days && parsed.days.length > 0);
        } catch {}
      }

      // Use trip ID from URL (share link) or localStorage
      // Anyone with the link can view and edit - no permission check needed
      let tripId = urlTripId || localStorage.getItem(TRIP_ID_KEY);
      let trip: TripRow | null = null;

      // If URL has trip ID, load that trip (don't check ownership)
      if (tripId) {
        try {
          const tripResult = await withTimeout(
            supabase.from('trips').select('*').eq('id', tripId).single(),
            SYNC_TIMEOUT
          );
          const data = (tripResult as any).data;
          if (data) {
            trip = data as TripRow;
            localStorage.setItem(TRIP_ID_KEY, trip.id);
          }
        } catch {
          console.warn('Trip lookup timed out');
        }
      }

      // Only check for owned trips if NO URL trip and NO local trip
      if (!trip && !urlTripId) {
        const { data: trips } = await supabase
          .from('trips').select('*').eq('owner_id', user.id)
          .order('created_at', { ascending: true }).limit(1);
        if (trips && trips.length > 0) {
          trip = trips[0] as TripRow;
          localStorage.setItem(TRIP_ID_KEY, trip.id);
        }
      }

      if (!trip) {
        // No trip in Supabase → create and sync localStorage data
        const { data: newTrip, error } = await supabase
          .from('trips').insert({ name: tripName, owner_id: user.id }).select().single();
        if (error || !newTrip) {
          console.error('Failed to create trip:', JSON.stringify(error));
          return;
        }
        trip = newTrip as TripRow;
        localStorage.setItem(TRIP_ID_KEY, trip.id);
        tripIdRef.current = trip.id;
        await syncAllToSupabase(trip.id);
        return;
      }

      // Trip exists in Supabase
      tripIdRef.current = trip.id;
      console.log('Loading trip from Supabase:', trip.id);

      // ── ALWAYS load from Supabase to ensure all devices see the same data ──
      // localStorage is only used as initial fallback / for offline
      const { data: dayRows, error: dayError } = await supabase
        .from('trip_days').select('*').eq('trip_id', trip.id).order('sort_order', { ascending: true });

      if (dayError) {
        console.error('Error loading days:', dayError);
      }

      const dayIds = (dayRows || []).map((d: any) => d.id);
      let eventRows: DayEventRow[] = [];
      if (dayIds.length > 0) {
        const { data: events } = await supabase
          .from('day_events').select('*').in('day_id', dayIds).order('sort_order', { ascending: true });
        eventRows = (events as DayEventRow[]) || [];
      }

      const { data: linkRows } = await supabase
        .from('trip_links').select('*').eq('trip_id', trip.id);

      const supaDays = (dayRows || []).map((row: TripDayRow) => mapDayRow(row, eventRows));
      const supaLinks = (linkRows as TripLinkRow[] || []).map((r) => ({ id: r.id, title: r.title, url: r.url }));

      console.log('Loaded from Supabase - days:', supaDays.length, 'events:', eventRows.length);

      // Always use Supabase data if it exists, otherwise sync current data to Supabase
      if (supaDays.length > 0) {
        setTripName(trip.name);
        setDays(supaDays);
        setTripLinks(supaLinks);
        setSelectedDayId(supaDays[0]?.id || '');
        saveToLocalStorage({ tripName: trip.name, days: supaDays, tripLinks: supaLinks, selectedDayId: supaDays[0]?.id || '' });
        console.log('Using Supabase data');
      } else {
        console.log('No days in Supabase, syncing local data...');
        await syncAllToSupabase(trip.id);
      }
    } catch (e) {
      console.error('Failed to sync from Supabase', e);
    }
  }

  // ── Sync all data to Supabase ──
  async function syncAllToSupabase(tripId: string) {
    console.log('syncAllToSupabase:', tripId, 'days:', days.length);
    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      const { data: dayRow, error: dayErr } = await supabase.from('trip_days').upsert({
        id: day.id, trip_id: tripId, date: day.date, title: day.title, notes: day.notes || '', sort_order: i,
      }, { onConflict: 'id' }).select().single();

      if (dayErr) console.error('Failed to sync day:', dayErr.message);

      if (dayRow) {
        for (let j = 0; j < day.events.length; j++) {
          const evt = day.events[j];
          const { error: evErr } = await supabase.from('day_events').upsert({
            id: evt.id, day_id: dayRow.id, time: evt.time, location_name: evt.locationName,
            coordinates: evt.coordinates, description: evt.description,
            event_type: evt.eventType || 'default', transport_to_next: evt.transportToNext || null,
            links: evt.links || [], sort_order: j,
          }, { onConflict: 'id' });
          if (evErr) console.error('Failed to sync event:', evErr.message);
        }
      }
    }
    for (const link of tripLinks) {
      await supabase.from('trip_links').upsert({ id: link.id, trip_id: tripId, title: link.title, url: link.url }, { onConflict: 'id' });
    }
    console.log('syncAllToSupabase done');
  }

  // ── Realtime subscriptions ──
  useEffect(() => {
    if (!supabaseReady || !tripIdRef.current) return;
    const tripId = tripIdRef.current;
    console.log('Setting up realtime subscriptions for trip:', tripId);

    const channel = supabase.channel(`trip-${tripId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips', filter: `id=eq.${tripId}` }, (p: any) => {
        if (p.eventType === 'UPDATE' && p.new) { setTripName(p.new.name); }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_days', filter: `trip_id=eq.${tripId}` }, () => reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_links', filter: `trip_id=eq.${tripId}` }, () => {
        console.log('Received realtime update for trip_links');
        reloadLinks();
      })
      .subscribe((status) => {
        console.log('Channel subscription status:', status);
      });

    const evChannel = supabase.channel(`events-${tripId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'day_events' }, () => reload())
      .subscribe();

    return () => { supabase.removeChannel(channel); supabase.removeChannel(evChannel); };
  }, [supabaseReady, isLoaded]);

  async function reload() {
    if (!tripIdRef.current) return;
    const { data: dayRows } = await supabase.from('trip_days').select('*').eq('trip_id', tripIdRef.current).order('sort_order', { ascending: true });
    const dayIds = (dayRows || []).map((d: any) => d.id);
    let eventRows: DayEventRow[] = [];
    if (dayIds.length > 0) {
      const { data: events } = await supabase.from('day_events').select('*').in('day_id', dayIds).order('sort_order', { ascending: true });
      eventRows = (events as DayEventRow[]) || [];
    }
    const mapped = (dayRows || []).map((r: TripDayRow) => mapDayRow(r, eventRows));
    setDays(mapped);
    saveToLocalStorage({ tripName, days: mapped, tripLinks, selectedDayId });
  }

  async function reloadLinks() {
    if (!tripIdRef.current) return;
    console.log('reloadLinks: reloading trip links from Supabase');
    const { data: rows, error } = await supabase.from('trip_links').select('*').eq('trip_id', tripIdRef.current);
    if (error) console.error('reloadLinks: error:', error);
    const mapped = (rows as TripLinkRow[] || []).map((r) => ({ id: r.id, title: r.title, url: r.url }));
    console.log('reloadLinks: loaded', mapped.length, 'links');
    setTripLinks(mapped);
    saveToLocalStorage({ tripName, days, tripLinks: mapped, selectedDayId });
  }

  // ── Auto-save to localStorage on every change ──
  useEffect(() => {
    if (!isLoaded) return;
    saveToLocalStorage({ tripName, days, tripLinks, selectedDayId });
  }, [tripName, days, tripLinks, selectedDayId, isLoaded]);

  // ── Wrappers that also sync to Supabase ──

  const updateTripName = useCallback((name: string) => {
    setTripName(name);
    if (tripIdRef.current) {
      supabase.from('trips').update({ name }).eq('id', tripIdRef.current);
    }
  }, []);

  const updateDays = useCallback((updater: React.SetStateAction<ItineraryDay[]>) => {
    setDays((prev) => {
      const next = typeof updater === 'function' ? (updater as (p: ItineraryDay[]) => ItineraryDay[])(prev) : updater;
      
      if (tripIdRef.current) {
        // Store pending sync data
        pendingSyncRef.current.days = next;
        
        // Debounce: clear existing timeout and set new one
        if (syncTimeoutRef.current) {
          clearTimeout(syncTimeoutRef.current);
        }
        syncTimeoutRef.current = setTimeout(() => {
          if (pendingSyncRef.current.days) {
            syncDays(pendingSyncRef.current.days)
              .then(() => console.log('Days synced to Supabase (debounced)'))
              .catch(err => console.error('Sync failed:', err));
          }
        }, 800); // 800ms debounce
      }
      return next;
    });
  }, []);

  const updateTripLinks = useCallback((updater: React.SetStateAction<TripLink[]>) => {
    setTripLinks((prev) => {
      const next = typeof updater === 'function' ? (updater as (p: TripLink[]) => TripLink[])(prev) : updater;
      
      if (tripIdRef.current) {
        // Store pending sync data
        pendingSyncRef.current.links = next;
        
        // Debounce: clear existing timeout and set new one
        if (syncTimeoutRef.current) {
          clearTimeout(syncTimeoutRef.current);
        }
        syncTimeoutRef.current = setTimeout(() => {
          if (pendingSyncRef.current.links) {
            syncLinks(pendingSyncRef.current.links)
              .then(() => console.log('Links synced to Supabase (debounced)'))
              .catch(err => console.error('Sync failed:', err));
          }
        }, 800); // 800ms debounce
      }
      return next;
    });
  }, []);

  async function syncDays(daysList: ItineraryDay[]) {
    if (!tripIdRef.current) return;
    const { data: existing } = await supabase.from('trip_days').select('id').eq('trip_id', tripIdRef.current);
    const existingIds = new Set((existing || []).map((d: any) => d.id));
    const newIds = new Set(daysList.map((d) => d.id));
    const toDelete = [...existingIds].filter((id) => !newIds.has(id));
    if (toDelete.length) await supabase.from('trip_days').delete().in('id', toDelete);

    for (let i = 0; i < daysList.length; i++) {
      const day = daysList[i];
      await supabase.from('trip_days').upsert({
        id: day.id, trip_id: tripIdRef.current!, date: day.date, title: day.title, notes: day.notes || '', sort_order: i,
      }, { onConflict: 'id' });

      const { data: existingEv } = await supabase.from('day_events').select('id').eq('day_id', day.id);
      const evIds = new Set((existingEv || []).map((e: any) => e.id));
      const newEvIds = new Set(day.events.map((e) => e.id));
      const delEv = [...evIds].filter((id) => !newEvIds.has(id));
      if (delEv.length) await supabase.from('day_events').delete().in('id', delEv);

      for (let j = 0; j < day.events.length; j++) {
        const evt = day.events[j];
        await supabase.from('day_events').upsert({
          id: evt.id, day_id: day.id, time: evt.time, location_name: evt.locationName,
          coordinates: evt.coordinates, description: evt.description,
          event_type: evt.eventType || 'default', transport_to_next: evt.transportToNext || null,
          links: evt.links || [], sort_order: j,
        }, { onConflict: 'id' });
      }
    }
  }

  async function syncLinks(links: TripLink[]) {
    if (!tripIdRef.current) {
      console.log('syncLinks: no tripIdRef.current, skipping');
      return;
    }
    console.log('syncLinks: syncing', links.length, 'links to trip', tripIdRef.current);
    
    const { data: existing } = await supabase.from('trip_links').select('id').eq('trip_id', tripIdRef.current);
    const existingIds = new Set((existing || []).map((l: any) => l.id));
    const newIds = new Set(links.map((l) => l.id));
    const toDelete = [...existingIds].filter((id) => !newIds.has(id));
    console.log('syncLinks: deleting', toDelete.length, 'old links');
    if (toDelete.length) await supabase.from('trip_links').delete().in('id', toDelete);
    
    for (const link of links) {
      console.log('syncLinks: upserting link:', link.title, link.url);
      const { error } = await supabase.from('trip_links').upsert({ id: link.id, trip_id: tripIdRef.current!, title: link.title, url: link.url }, { onConflict: 'id' });
      if (error) console.error('syncLinks: error:', error);
    }
    console.log('syncLinks: done');
  }

  return {
    isLoaded,
    tripName, setTripName: updateTripName,
    days, setDays: updateDays,
    tripLinks, setTripLinks: updateTripLinks,
    selectedDayId, setSelectedDayId,
    tripId: tripIdRef.current,
  };
}
