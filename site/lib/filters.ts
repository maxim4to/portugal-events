import type { Place } from '../../schema/index.ts';

export interface PlaceFilter {
  types?: string[];
  regions?: string[];
  tags?: string[];
  maxDriveMinutes?: number;
  query?: string;
  freeWithResidency?: boolean;
}

export function filterPlaces(places: Place[], f: PlaceFilter): Place[] {
  const q = f.query?.trim().toLowerCase();
  return places.filter((p) => {
    if (f.types?.length && !f.types.includes(p.type)) return false;
    if (f.regions?.length && !f.regions.includes(p.region)) return false;
    if (f.tags?.length && !f.tags.some((t) => p.tags.includes(t))) return false;
    if (f.maxDriveMinutes != null && p.driveMinutesFromLisbon > f.maxDriveMinutes) return false;
    if (f.freeWithResidency && p.freeWithResidency !== true) return false;
    if (q && !(`${p.name} ${p.region}`.toLowerCase().includes(q))) return false;
    return true;
  });
}
