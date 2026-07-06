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

const LISBON_NAME = 'lisboa';

/** Average road speed used to estimate driving time from straight-line distance. */
const AVG_ROAD_SPEED_KMH = 70;

function haversineKm(a: LatLon, b: LatLon): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function formatDriveMinutes(minutes: number): string {
  const rounded = Math.max(5, Math.round(minutes / 5) * 5);
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h === 0) return `${m} мин`;
  if (m === 0) return `${h} ч`;
  return `${h} ч ${m} мин`;
}

/**
 * Estimated driving time from Lisbon to the event's city, e.g. "~1 ч 20 мин от
 * Лиссабона". Returns null for events already in Lisbon or in an unknown city —
 * straight-line distance × average road speed is a rough estimate, not routing.
 */
export function driveTimeFromLisbon(event: Event, cityIndex: Map<string, City>): string | null {
  const cityName = event.city.trim().toLowerCase();
  if (cityName === LISBON_NAME) return null;
  const city = cityIndex.get(cityName);
  const lisbon = cityIndex.get(LISBON_NAME);
  if (!city || !lisbon) return null;
  const km = haversineKm(lisbon, city);
  const minutes = (km / AVG_ROAD_SPEED_KMH) * 60;
  return `~${formatDriveMinutes(minutes)} от Лиссабона`;
}
