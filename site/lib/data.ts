import { z } from 'zod';
import {
  CitySchema,
  EventSchema,
  PlaceSchema,
  type City,
  type Event,
  type Place,
} from '../../schema/index.ts';

const placeFiles = import.meta.glob('../../data/places/*.json', {
  eager: true,
  import: 'default',
});
export const allPlaces: Place[] = Object.values(placeFiles).flatMap((v) =>
  z.array(PlaceSchema).parse(v),
);
export const approvedPlaces: Place[] = allPlaces.filter((p) => p.status === 'approved');

const eventFiles = import.meta.glob('../../data/events/*.json', {
  eager: true,
  import: 'default',
});
const todayISO = new Date().toISOString().slice(0, 10);
export const upcomingEvents: Event[] = Object.values(eventFiles)
  .flatMap((v) => z.array(EventSchema).parse(v))
  .filter((e) => e.dateEnd >= todayISO)
  .sort((a, b) => a.dateStart.localeCompare(b.dateStart));

const cityFiles = import.meta.glob('../../data/geo/cities.json', {
  eager: true,
  import: 'default',
});
export const cities: City[] = Object.values(cityFiles).flatMap((v) =>
  z.array(CitySchema).parse(v),
);

export const regions: string[] = [...new Set(approvedPlaces.map((p) => p.region))].sort();
export const allTags: string[] = [...new Set(approvedPlaces.flatMap((p) => p.tags))].sort();
