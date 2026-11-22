// Remembers an explorer's filters (as its URL query string) so opening the
// page again without a query restores them.
//
//  - Every device keeps a local copy (localStorage), per account: instant on
//    a cold start, and the only copy for signed-out visitors.
//  - Signed in, the query is also stored in Firebase under
//      users/<uid>/settings/filters/<scope>
//    so the same filters follow the account to other devices.
//
// Only the user's own changes are saved (the caller decides), so arriving via
// a link with explicit filters never overwrites what they had set up. Inert
// without a Firebase config except for the local copy.

import { getDb, isFirebaseConfigured } from './firebase';
import { getCachedUser, getUid, onAuthChange } from './auth';

const localKey = (scope: string, uid: string | null) => `filters:${scope}:${uid ?? 'anon'}`;

// Both copies carry the time of the change, so the newer one wins: a save
// that never reached the account (tab closed mid-write) can't be overridden
// by an older account copy on the next visit.
interface Stored {
  q: string;
  t: number;
}
const parse = (v: unknown): Stored | null => {
  if (typeof v === 'string') {
    try {
      const o = JSON.parse(v) as Stored;
      if (o && typeof o.q === 'string' && typeof o.t === 'number') return o;
    } catch {}
    return null;
  }
  const o = v as Stored | null;
  return o && typeof o.q === 'string' && typeof o.t === 'number' ? o : null;
};

function readLocal(scope: string, uid: string | null): Stored | null {
  try {
    return parse(localStorage.getItem(localKey(scope, uid)));
  } catch {
    return null;
  }
}
function writeLocal(scope: string, uid: string | null, v: Stored) {
  try {
    localStorage.setItem(localKey(scope, uid), JSON.stringify(v));
  } catch {}
}

async function remoteRef(scope: string, uid: string) {
  const db = await getDb();
  if (!db) return null;
  const { ref } = await import('firebase/database');
  return ref(db, `users/${uid}/settings/filters/${scope}`);
}

export interface SavedFilters {
  /** The query to start from when the URL has none (local copy), or null. */
  initial: string | null;
  /** Save the user's current query (debounced; local + account). */
  save(qs: string): void;
}

/**
 * `onRemote(qs)` is called once the account's stored query is known, if it
 * differs from what is on screen — the caller applies it unless the user has
 * already started changing filters in this visit.
 */
export function initSavedFilters(
  scope: string,
  onRemote: (qs: string) => void,
): SavedFilters {
  const cachedUid = getCachedUser()?.uid ?? null;
  const local = readLocal(scope, cachedUid);
  let timer = 0;
  let pending: Stored | null = null;

  const flush = () => {
    if (pending === null) return;
    const v = pending;
    pending = null;
    const uid = getUid();
    writeLocal(scope, uid, v);
    if (!uid || !isFirebaseConfigured()) return;
    void (async () => {
      try {
        const r = await remoteRef(scope, uid);
        if (!r) return;
        const { set } = await import('firebase/database');
        await set(r, v);
      } catch (err) {
        console.warn('[filters] save failed', err);
      }
    })();
  };
  addEventListener('pagehide', flush);

  if (isFirebaseConfigured()) {
    let seen: string | null | undefined;
    onAuthChange((user) => {
      const uid = user?.uid ?? null;
      if (uid === seen) return;
      seen = uid;
      if (!uid) return;
      void (async () => {
        try {
          const r = await remoteRef(scope, uid);
          if (!r) return;
          const { get } = await import('firebase/database');
          const snap = await get(r);
          const remote = parse(snap.val());
          if (!remote) return;
          const mine = readLocal(scope, uid);
          if (mine && mine.t >= remote.t) return; // ours is newer (or the same)
          writeLocal(scope, uid, remote);
          onRemote(remote.q);
        } catch (err) {
          console.warn('[filters] load failed', err);
        }
      })();
    });
  }

  return {
    initial: local?.q ?? null,
    save(qs: string) {
      pending = { q: qs, t: Date.now() };
      clearTimeout(timer);
      timer = window.setTimeout(flush, 500);
    },
  };
}
