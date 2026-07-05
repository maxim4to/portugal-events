import { z } from 'zod';
import { EventSchema, PlaceSchema, type Event, type Place } from '../../schema/index.ts';

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
