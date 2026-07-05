import type { Collection, Place } from '../../schema/index.ts';

export function resolveCollection(collection: Collection, places: Place[]): Place[] {
  const byId = new Map(places.map((p) => [p.id, p]));
  return collection.placeIds.map((id) => byId.get(id)).filter((p): p is Place => p != null);
}
