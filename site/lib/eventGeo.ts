import type { City, Event } from '../../schema/index.ts';

export interface LatLon {
  lat: number;
  lon: number;
}

/** Deterministic jitter radius applied around a city centre so several events in
 *  the same city separate into distinct pins (events have no street address). */
export const JITTER_LAT = 0.025;
export const JITTER_LON = 0.03;

/** Case-insensitive city name → City lookup. */
export function buildCityIndex(cities: City[]): Map<string, City> {
  const index = new Map<string, City>();
  for (const c of cities) index.set(c.name.trim().toLowerCase(), c);
  return index;
}

/** FNV-1a. Small, dependency-free, stable across runs — we only need a
 *  deterministic spread, not cryptographic quality. */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Coordinates for an event: its city's centre nudged by a deterministic,
 * per-event offset. Returns null when the city is unknown so the caller can
 * still list the event without placing a pin.
 */
export function eventLatLon(event: Event, cityIndex: Map<string, City>): LatLon | null {
  const city = cityIndex.get(event.city.trim().toLowerCase());
  if (!city) return null;
  const h = hashString(event.id);
  const u1 = ((h & 0xffff) / 0xffff) * 2 - 1;
  const u2 = (((h >>> 16) & 0xffff) / 0xffff) * 2 - 1;
  return {
    lat: city.lat + u1 * JITTER_LAT,
    lon: city.lon + u2 * JITTER_LON,
  };
}
