export interface PlaceCardData {
  type: string;
  region: string;
  drive: number;
  tags: string[];
  name: string;
}

export interface ExplorerFilterState {
  types: string[];
  region: string;
  tags: string[];
  maxDrive: number;
  query: string;
}

/**
 * Pure predicate mirroring the catalog filter, driven by the data-* attributes
 * baked onto each place-card wrapper. Kept separate from the DOM so it is unit
 * testable and reused by both the list filter and the map marker refresh.
 */
export function matchesFilter(place: PlaceCardData, state: ExplorerFilterState): boolean {
  if (state.types.length && !state.types.includes(place.type)) return false;
  if (state.region && place.region !== state.region) return false;
  if (state.tags.length && !state.tags.some((t) => place.tags.includes(t))) return false;
  if (place.drive > state.maxDrive) return false;
  const q = state.query.trim().toLowerCase();
  if (q && !`${place.name} ${place.region}`.toLowerCase().includes(q)) return false;
  return true;
}
