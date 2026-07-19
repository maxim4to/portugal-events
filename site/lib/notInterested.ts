// Client-only "not interested" feature, scoped to the signed-in user.
//
// Data lives in Firebase Realtime Database at users/<uid>/notInterested/<placeId>.
// Thin wrapper over the shared per-user core (userData.ts) — mirrors visited.ts.
// Marked places sink to the very bottom of the catalog (below visited, in their
// own section) and their pins are dropped from the maps.
//
// Framework-free plain TS; only referenced from client <script> bundles.

import { isAuthConfigured } from './auth';
import { subscribeUserSet, setUserFlag } from './userData';

/** True when the feature can work at all (Firebase configured). */
export function isConfigured(): boolean {
  return isAuthConfigured();
}

/** Subscribe to the current user's "not interested" set. Empty while signed out. */
export function subscribeNotInterested(cb: (ids: Set<string>) => void): () => void {
  return subscribeUserSet('notInterested', cb);
}

/** Mark a place as not interested (`on = true`) or clear it. No-op when signed out. */
export function setNotInterested(placeId: string, on: boolean): Promise<void> {
  return setUserFlag('notInterested', placeId, on);
}
