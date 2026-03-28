import { defineSchema, defineTable } from 'convex/server';
import { authTables } from '@convex-dev/auth/server';

export default defineSchema({
  ...authTables,
  
  trips: defineTable({
    name: 'string',
    ownerId: 'string',
    createdAt: 'number',
  }).index('ownerId', ['ownerId']),

  tripDays: defineTable({
    tripId: 'string',
    date: 'string',
    title: 'string',
    notes: 'string',
    sortOrder: 'number',
  }).index('tripId', ['tripId']),

  dayEvents: defineTable({
    dayId: 'string',
    time: 'string',
    locationName: 'string',
    coordinates: 'any',
    description: 'string',
    eventType: 'string',
    transportToNext: 'any',
    links: 'any',
    sortOrder: 'number',
  }).index('dayId', ['dayId']),

  tripLinks: defineTable({
    tripId: 'string',
    title: 'string',
    url: 'string',
  }).index('tripId', ['tripId']),
});
