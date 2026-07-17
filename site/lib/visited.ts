// Client-only "visited places" feature, now scoped to the signed-in user.
//
// Data lives in Firebase Realtime Database at users/<uid>/visited/<placeId>.
// It is a thin wrapper over the shared per-user core (userData.ts); the auth
// gating, per-user pathing, and graceful degradation all live there.
//
// Framework-free plain TS; only referenced from client <script> bundles.

import { isAuthConfigured } from './auth';
import { subscribeUserSet, setUserFlag } from './userData';

/**
 * True when the feature can work at all (Firebase configured). Sign-in state is
 * handled separately — see auth.ts / VisitedController.
 */
export function isConfigured(): boolean {
  return isAuthConfigured();
}

/** Subscribe to the current user's visited set. Empty while signed out. */
export function subscribeVisited(cb: (ids: Set<string>) => void): () => void {
  return subscribeUserSet('visited', cb);
}

/** Mark a place visited (`on = true`) or clear it. No-op when signed out. */
export function setVisited(placeId: string, on: boolean): Promise<void> {
  return setUserFlag('visited', placeId, on);
}
