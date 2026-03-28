import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  trips: defineTable({
    name: v.string(),
    ownerId: v.string(),
    createdAt: v.number(),
  }).index('ownerId', ['ownerId']),

  tripDays: defineTable({
    tripId: v.string(),
    date: v.string(),
    title: v.string(),
    notes: v.string(),
    sortOrder: v.number(),
  }).index('tripId', ['tripId']),

  dayEvents: defineTable({
    dayId: v.string(),
    time: v.string(),
    locationName: v.string(),
    coordinates: v.any(),
    description: v.string(),
    eventType: v.string(),
    transportToNext: v.any(),
    links: v.any(),
    sortOrder: v.number(),
  }).index('dayId', ['dayId']),

  tripLinks: defineTable({
    tripId: v.string(),
    title: v.string(),
    url: v.string(),
  }).index('tripId', ['tripId']),
});
