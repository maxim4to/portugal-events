import { z } from 'zod';

const slug = z.string().regex(/^[a-z0-9-]+$/, 'id must be a lowercase slug');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD');

export const PLACE_TYPES = [
  'beach',
  'hike',
  'castle',
  'lake',
  'viewpoint',
  'town',
  'nature',
  'other',
] as const;

export const PlaceSchema = z.object({
  id: slug,
  name: z.string().min(1),
  type: z.enum(PLACE_TYPES),
  region: z.string().min(1),
  coords: z.object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  }),
  description: z.string().min(1),
  driveMinutesFromLisbon: z.number().int().positive(),
  visitDurationHours: z.number().positive(),
  bestSeason: z.string().min(1),
  tags: z.array(z.string()),
  links: z.array(z.object({ title: z.string().min(1), url: z.string().url() })),
  status: z.enum(['candidate', 'approved']),
});
export type Place = z.infer<typeof PlaceSchema>;

export const EVENT_TYPES = [
  'concert',
  'festival',
  'exhibition',
  'market',
  'sport',
  'other',
] as const;

export const EventSchema = z
  .object({
    id: slug,
    title: z.string().min(1),
    type: z.enum(EVENT_TYPES),
    dateStart: isoDate,
    dateEnd: isoDate,
    city: z.string().min(1),
    venue: z.string().min(1),
    price: z.string(),
    url: z.string().url(),
    description: z.string(),
    sourceId: z.string().min(1),
    dedupeHash: z.string().min(1),
  })
  .refine((e) => e.dateEnd >= e.dateStart, {
    message: 'dateEnd must be on or after dateStart',
    path: ['dateEnd'],
  });
export type Event = z.infer<typeof EventSchema>;

export const SourceSchema = z.object({
  id: slug,
  name: z.string().min(1),
  type: z.enum(['telegram', 'website', 'rss']),
  url: z.string().url(),
  hint: z.string(),
  enabled: z.boolean(),
});
export type Source = z.infer<typeof SourceSchema>;

export const CitySchema = z.object({
  name: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});
export type City = z.infer<typeof CitySchema>;
