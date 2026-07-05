import { describe, it, expect } from 'vitest';
import type { City, Event } from '../../schema/index.ts';
import { buildCityIndex, eventLatLon, JITTER_LAT, JITTER_LON } from './eventGeo.ts';

const cities: City[] = [
  { name: 'Lisboa', lat: 38.7223, lon: -9.1393 },
  { name: 'Porto', lat: 41.1579, lon: -8.6291 },
];
const index = buildCityIndex(cities);

function ev(id: string, city: string): Event {
  return {
    id,
    title: 'x',
    type: 'concert',
    dateStart: '2026-08-01',
    dateEnd: '2026-08-01',
    city,
    venue: 'v',
    price: '',
    url: 'https://example.com',
    description: '',
    sourceId: 's',
    dedupeHash: 'h',
  };
}

describe('eventLatLon', () => {
  it('places an event near its city centre', () => {
    const p = eventLatLon(ev('a', 'Lisboa'), index)!;
    expect(p).not.toBeNull();
    expect(Math.abs(p.lat - 38.7223)).toBeLessThanOrEqual(JITTER_LAT);
    expect(Math.abs(p.lon - -9.1393)).toBeLessThanOrEqual(JITTER_LON);
  });

  it('matches city name case-insensitively', () => {
    expect(eventLatLon(ev('a', 'lisboa'), index)).not.toBeNull();
    expect(eventLatLon(ev('a', '  PORTO '), index)).not.toBeNull();
  });

  it('returns null for an unknown city', () => {
    expect(eventLatLon(ev('a', 'Atlantis'), index)).toBeNull();
  });

  it('is deterministic for the same id', () => {
    expect(eventLatLon(ev('same', 'Porto'), index)).toEqual(
      eventLatLon(ev('same', 'Porto'), index),
    );
  });

  it('separates different events in the same city', () => {
    const p1 = eventLatLon(ev('one', 'Lisboa'), index)!;
    const p2 = eventLatLon(ev('two', 'Lisboa'), index)!;
    expect(p1.lat !== p2.lat || p1.lon !== p2.lon).toBe(true);
  });
});
