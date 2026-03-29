import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

// Get or create trip with all related data
export const getOrCreateTrip = query({
  args: { tripId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let trip = null;
    
    // Try to get existing trip
    if (args.tripId) {
      // Normalize the string ID to a Convex Id
      const normalizedId = ctx.db.normalizeId('trips', args.tripId);
      if (normalizedId) {
        trip = await ctx.db.get(normalizedId);
      }
    }
    
    // If no trip found, get the first trip (for anonymous users)
    if (!trip) {
      const trips = await ctx.db
        .query('trips')
        .order('desc')
        .take(1);
      trip = trips[0] || null;
    }
    
    if (!trip) {
      return { trip: null, days: [], tripLinks: [] };
    }
    
    // Get days for this trip
    const days = await ctx.db
      .query('tripDays')
      .withIndex('tripId', (q) => q.eq('tripId', trip._id))
      .order('asc')
      .collect();
    
    // Get events for each day
    const daysWithEvents = await Promise.all(
      days.map(async (day) => {
        const events = await ctx.db
          .query('dayEvents')
          .withIndex('dayId', (q) => q.eq('dayId', day._id))
          .order('asc')
          .collect();
        return { ...day, events };
      })
    );
    
    // Get trip links
    const tripLinks = await ctx.db
      .query('tripLinks')
      .withIndex('tripId', (q) => q.eq('tripId', trip._id))
      .collect();
    
    return {
      trip,
      days: daysWithEvents,
      tripLinks,
    };
  },
});

// Get trip by ID
export const getTrip = query({
  args: { tripId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.tripId) return null;
    const normalizedId = ctx.db.normalizeId('trips', args.tripId);
    if (!normalizedId) return null;
    return await ctx.db.get(normalizedId);
  },
});

// Get all days for a trip
export const getTripDays = query({
  args: { tripId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('tripDays')
      .withIndex('tripId', (q) => q.eq('tripId', args.tripId))
      .collect();
  },
});

// Get all events for a trip
export const getTripEvents = query({
  args: { tripId: v.string() },
  handler: async (ctx, args) => {
    const days = await ctx.db
      .query('tripDays')
      .withIndex('tripId', (q) => q.eq('tripId', args.tripId))
      .collect();
    
    const allEvents = [];
    for (const day of days) {
      const events = await ctx.db
        .query('dayEvents')
        .withIndex('dayId', (q) => q.eq('dayId', day._id))
        .collect();
      allEvents.push(...events.map(e => ({ ...e, dayId: day._id })));
    }
    return allEvents;
  },
});

// Get all links for a trip
export const getTripLinks = query({
  args: { tripId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('tripLinks')
      .withIndex('tripId', (q) => q.eq('tripId', args.tripId))
      .collect();
  },
});

// Save entire trip
export const saveTrip = mutation({
  args: {
    tripId: v.optional(v.string()),
    name: v.string(),
    days: v.array(v.object({
      id: v.string(),
      date: v.string(),
      title: v.string(),
      notes: v.string(),
      sortOrder: v.number(),
      events: v.array(v.object({
        id: v.string(),
        time: v.string(),
        locationName: v.string(),
        coordinates: v.any(),
        description: v.string(),
        eventType: v.optional(v.string()),
        transportToNext: v.optional(v.any()),
        links: v.optional(v.array(v.any())),
        sortOrder: v.number(),
      })),
    })),
    tripLinks: v.array(v.object({
      id: v.string(),
      title: v.string(),
      url: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    let tripId = args.tripId;

    // Create trip if not exists
    if (!tripId) {
      tripId = await ctx.db.insert('trips', {
        name: args.name,
        ownerId: 'anonymous',
        createdAt: Date.now(),
      });
    } else {
      // Update existing trip name
      const normalizedTripId = ctx.db.normalizeId('trips', tripId);
      if (normalizedTripId) {
        await ctx.db.patch(normalizedTripId, { name: args.name });
      }
    }

    // Only update days/links if provided (not empty arrays)
    if (args.days && args.days.length > 0) {
      const oldDays = await ctx.db
        .query('tripDays')
        .withIndex('tripId', (q) => q.eq('tripId', tripId))
        .collect();
      
      for (const day of oldDays) {
        const events = await ctx.db
          .query('dayEvents')
          .withIndex('dayId', (q) => q.eq('dayId', day._id))
          .collect();
        for (const e of events) await ctx.db.delete(e._id);
        await ctx.db.delete(day._id);
      }

      // Delete old links
      const oldLinks = await ctx.db
        .query('tripLinks')
        .withIndex('tripId', (q) => q.eq('tripId', tripId))
        .collect();
      for (const l of oldLinks) await ctx.db.delete(l._id);

      // Insert new days
      for (const day of args.days) {
        const dayId = await ctx.db.insert('tripDays', {
          tripId: tripId,
          date: day.date,
          title: day.title,
          notes: day.notes,
          sortOrder: day.sortOrder,
        });

        // Insert events
        for (const event of day.events) {
          await ctx.db.insert('dayEvents', {
            dayId,
            time: event.time,
            locationName: event.locationName,
            coordinates: event.coordinates,
            description: event.description,
            eventType: event.eventType || 'default',
            transportToNext: event.transportToNext,
            links: event.links || [],
            sortOrder: event.sortOrder,
          });
        }
      }

      // Insert links
      for (const link of args.tripLinks) {
        await ctx.db.insert('tripLinks', {
          tripId,
          title: link.title,
          url: link.url,
        });
      }
    }

    return tripId;
  },
});
