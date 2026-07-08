// Client-only module for the shared "visited places" feature.
//
// Shared state lives in Firebase Realtime Database at
//   spaces/<spaceId>/visited/<placeId> = true
// There is no user auth. By default everyone shares ONE public space
// (DEFAULT_SPACE) so the visited history is global to all site visitors — no
// link or secret needed. A `?space=…` (query or hash) link still overrides it
// with a private space, persisted to localStorage.
//
// Everything degrades gracefully: with a placeholder Firebase config the
// feature is INERT — no network calls, callbacks resolve empty, writes are
// no-ops — so the rest of the site keeps working.
//
// Framework-free plain TS; only referenced from client <script> bundles.

import type { Database } from 'firebase/database';
import config from './firebase-config.json';

const SPACE_KEY = 'pe-space';
// Shared, keyless space every visitor lands in by default.
const DEFAULT_SPACE = 'public';

/**
 * Resolve the active spaceId.
 * - If the URL carries `space=…` (query or hash), persist it to localStorage
 *   and strip it from the address bar so it isn't left lying around.
 * - Otherwise fall back to the persisted override, or the shared DEFAULT_SPACE.
 * Only null during SSR (no `window`).
 */
export function getSpaceId(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const fromUrl = readSpaceFromUrl();
    if (fromUrl) {
      localStorage.setItem(SPACE_KEY, fromUrl);
      cleanSpaceFromUrl();
      return fromUrl;
    }
    return localStorage.getItem(SPACE_KEY) ?? DEFAULT_SPACE;
  } catch {
    // localStorage can throw (private mode, disabled storage) — still usable
    // via the shared space, just without a persisted override.
    return DEFAULT_SPACE;
  }
}

function readSpaceFromUrl(): string | null {
  const fromQuery = new URLSearchParams(location.search).get('space');
  if (fromQuery) return fromQuery.trim() || null;

  // Hash may be `#space=abc` or `#foo&space=abc`.
  const rawHash = location.hash.replace(/^#/, '');
  if (rawHash) {
    const fromHash = new URLSearchParams(rawHash).get('space');
    if (fromHash) return fromHash.trim() || null;
  }
  return null;
}

function cleanSpaceFromUrl(): void {
  try {
    const url = new URL(location.href);
    url.searchParams.delete('space');

    if (url.hash) {
      const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
      hashParams.delete('space');
      const rest = hashParams.toString();
      url.hash = rest ? `#${rest}` : '';
    }

    history.replaceState(null, '', url.pathname + url.search + url.hash);
  } catch {
    // Non-fatal — leaving the code in the URL is cosmetic only.
  }
}

/**
 * True only when the Firebase config has been filled in AND a spaceId is known.
 * Every other export no-ops when this is false.
 */
export function isConfigured(): boolean {
  return config.apiKey !== 'REPLACE_ME' && getSpaceId() !== null;
}

// Lazy Firebase singleton — initialised at most once, only when configured.
let db: Database | null = null;
let initTried = false;

async function getDb(): Promise<Database | null> {
  if (db) return db;
  if (initTried) return db;
  initTried = true;
  if (!isConfigured()) return null;
  try {
    const { initializeApp } = await import('firebase/app');
    const { getDatabase } = await import('firebase/database');
    const app = initializeApp(config);
    db = getDatabase(app);
    return db;
  } catch (err) {
    console.warn('[visited] Firebase init failed; feature disabled.', err);
    return null;
  }
}

/**
 * Subscribe to the visited set for the current space.
 * Calls `cb` with a Set of place ids that are marked truthy, and again on every
 * change. Returns an unsubscribe function. When not configured, calls `cb` once
 * with an empty Set and returns a no-op.
 */
export function subscribeVisited(cb: (ids: Set<string>) => void): () => void {
  if (!isConfigured()) {
    cb(new Set());
    return () => {};
  }

  const spaceId = getSpaceId();
  let unsub: (() => void) | null = null;
  let cancelled = false;

  (async () => {
    const database = await getDb();
    if (!database || cancelled) {
      cb(new Set());
      return;
    }
    try {
      const { ref, onValue } = await import('firebase/database');
      const visitedRef = ref(database, `spaces/${spaceId}/visited`);
      unsub = onValue(
        visitedRef,
        (snapshot) => {
          const ids = new Set<string>();
          const val = snapshot.val() as Record<string, unknown> | null;
          if (val) {
            for (const [id, on] of Object.entries(val)) {
              if (on) ids.add(id);
            }
          }
          cb(ids);
        },
        (err) => {
          console.warn('[visited] subscription error.', err);
          cb(new Set());
        },
      );
    } catch (err) {
      console.warn('[visited] subscribe failed.', err);
      cb(new Set());
    }
  })();

  return () => {
    cancelled = true;
    if (unsub) unsub();
  };
}

/**
 * Mark a place visited (`on = true`) or clear the mark (`on = false`).
 * No-op if not configured. Never throws — errors are caught and logged.
 */
export async function setVisited(placeId: string, on: boolean): Promise<void> {
  if (!isConfigured()) return;
  const spaceId = getSpaceId();
  try {
    const database = await getDb();
    if (!database) return;
    const { ref, set, remove } = await import('firebase/database');
    const placeRef = ref(database, `spaces/${spaceId}/visited/${placeId}`);
    if (on) await set(placeRef, true);
    else await remove(placeRef);
  } catch (err) {
    console.warn('[visited] write failed.', err);
  }
}
