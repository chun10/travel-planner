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
    time: v.optional(v.string()),
    locationName: v.string(),
    coordinates: v.optional(v.any()),
    description: v.optional(v.string()),
    eventType: v.optional(v.string()),
    transportToNext: v.optional(v.any()),
    links: v.optional(v.any()),
    sortOrder: v.optional(v.number()),
  }).index('dayId', ['dayId']),

  tripLinks: defineTable({
    tripId: v.string(),
    title: v.string(),
    url: v.string(),
  }).index('tripId', ['tripId']),
});
