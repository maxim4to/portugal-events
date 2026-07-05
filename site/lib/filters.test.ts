import { describe, expect, test } from 'vitest';
import { filterPlaces, type PlaceFilter } from './filters.ts';
import type { Place } from '../../schema/index.ts';

const make = (over: Partial<Place>): Place => ({
  id: over.id ?? 'x', name: over.name ?? 'Место', type: over.type ?? 'beach',
  region: over.region ?? 'Лиссабон и Синтра',
  coords: { lat: 38, lon: -9 }, description: 'd',
  driveMinutesFromLisbon: over.driveMinutesFromLisbon ?? 45,
  visitDurationHours: 2, bestSeason: 'лето', tags: over.tags ?? [], links: [],
  collections: [], status: 'approved', ...over,
});

const beach = make({ id: 'b', type: 'beach', name: 'Урса', driveMinutesFromLisbon: 45, tags: ['закат'] });
const castle = make({ id: 'c', type: 'castle', name: 'Замок', region: 'Оэште', driveMinutesFromLisbon: 90 });
const museum = make({ id: 'm', type: 'museum', name: 'Музей', freeWithResidency: true });

describe('filterPlaces', () => {
  const all = [beach, castle];
  test('empty filter returns all', () => {
    expect(filterPlaces(all, {} as PlaceFilter)).toHaveLength(2);
  });
  test('filters by type', () => {
    expect(filterPlaces(all, { types: ['beach'] })).toEqual([beach]);
  });
  test('filters by region', () => {
    expect(filterPlaces(all, { regions: ['Оэште'] })).toEqual([castle]);
  });
  test('filters by max drive minutes', () => {
    expect(filterPlaces(all, { maxDriveMinutes: 60 })).toEqual([beach]);
  });
  test('filters by tag', () => {
    expect(filterPlaces(all, { tags: ['закат'] })).toEqual([beach]);
  });
  test('search matches name case-insensitively', () => {
    expect(filterPlaces(all, { query: 'урс' })).toEqual([beach]);
  });
  test('combines filters with AND', () => {
    expect(filterPlaces(all, { types: ['beach'], maxDriveMinutes: 30 })).toEqual([]);
  });
  test('filters by freeWithResidency', () => {
    expect(filterPlaces([beach, castle, museum], { freeWithResidency: true })).toEqual([museum]);
  });
});
