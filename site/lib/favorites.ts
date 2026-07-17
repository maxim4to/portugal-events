// Client-only "favorites / shortlist" feature, scoped to the signed-in user.
//
// Data lives in Firebase Realtime Database at users/<uid>/favorites/<placeId>.
// Thin wrapper over the shared per-user core (userData.ts) — mirrors visited.ts.
//
// Framework-free plain TS; only referenced from client <script> bundles.

import { isAuthConfigured } from './auth';
import { subscribeUserSet, setUserFlag } from './userData';

/** True when the feature can work at all (Firebase configured). */
export function isConfigured(): boolean {
  return isAuthConfigured();
}

/** Subscribe to the current user's favorites set. Empty while signed out. */
export function subscribeFavorites(cb: (ids: Set<string>) => void): () => void {
  return subscribeUserSet('favorites', cb);
}

/** Add a place to favorites (`on = true`) or remove it. No-op when signed out. */
export function setFavorite(placeId: string, on: boolean): Promise<void> {
  return setUserFlag('favorites', placeId, on);
}
