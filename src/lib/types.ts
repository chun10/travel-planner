export type TransportMode = 'WALKING' | 'TRANSIT' | 'DRIVING';

export type EventType = 'default' | 'hotel' | 'flight' | 'transit' | 'attraction';

export interface EventLink {
  id: string;
  title: string;
  url: string;
  type: 'flight' | 'hotel' | 'booking' | 'other';
}

export interface DayEvent {
  id: string;
  time: string;
  locationName: string;
  coordinates: { lat: number; lng: number };
  description: string;
  eventType?: EventType;
  transportToNext?: {
    mode: TransportMode;
    duration: string;
    instructions?: string;
  };
  links?: EventLink[];
}

export interface ItineraryDay {
  id: string;
  date: string;
  title: string;
  events: DayEvent[];
  notes?: string;
}
