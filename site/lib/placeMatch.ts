export interface PlaceCardData {
  type: string;
  region: string;
  drive: number;
  tags: string[];
  name: string;
  /** Shared "visited" mark; undefined when the feature is unconfigured. */
  visited?: boolean;
  /** Private "favorite" mark from localStorage. */
  favorite?: boolean;
  /** Whether entry is free for residency-permit holders. */
  freeWithResidency?: boolean;
}

/** Tri-state visited filter: any place / only visited / only not visited. */
export type VisitedFilter = 'all' | 'visited' | 'unvisited';

export interface ExplorerFilterState {
  types: string[];
  regions: string[];
  tags: string[];
  maxDrive: number;
  visited: VisitedFilter;
  /** When true, keep only favorited places. */
  onlyFavorites?: boolean;
  freeWithResidency?: boolean;
}

/**
 * Pure predicate mirroring the catalog filter, driven by the data-* attributes
 * baked onto each place-card wrapper. Kept separate from the DOM so it is unit
 * testable and reused by both the list filter and the map marker refresh.
 */
export function matchesFilter(place: PlaceCardData, state: ExplorerFilterState): boolean {
  if (state.types.length && !state.types.includes(place.type)) return false;
  if (state.regions.length && !state.regions.includes(place.region)) return false;
  if (state.tags.length && !state.tags.some((t) => place.tags.includes(t))) return false;
  if (place.drive > state.maxDrive) return false;
  if (state.visited === 'visited' && !place.visited) return false;
  if (state.visited === 'unvisited' && place.visited) return false;
  if (state.onlyFavorites && !place.favorite) return false;
  if (state.freeWithResidency && !place.freeWithResidency) return false;
  return true;
}
