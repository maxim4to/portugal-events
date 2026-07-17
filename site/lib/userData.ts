// Per-user boolean sets stored in Firebase Realtime Database at
//   users/<uid>/<kind>/<id> = true
// where <kind> is 'visited' or 'favorites'. Both features share this core.
//
// A subscription follows the signed-in user: it re-points at the current uid on
// every sign-in / sign-out (reporting an empty set while signed out), so the UI
// clears on logout and repopulates on login without the caller re-subscribing.
//
// Inert when Firebase isn't configured: subscriptions report an empty set once
// and writes are no-ops.

import { getDb, isFirebaseConfigured } from './firebase';
import { getUid, onAuthChange } from './auth';

export type UserSetKind = 'visited' | 'favorites';

/**
 * Subscribe to the current user's set for `kind`. Calls `cb` with a Set of ids
 * marked truthy, and again on every change (including auth changes). Returns an
 * unsubscribe function.
 */
export function subscribeUserSet(
  kind: UserSetKind,
  cb: (ids: Set<string>) => void,
): () => void {
  if (!isFirebaseConfigured()) {
    cb(new Set());
    return () => {};
  }

  let cancelled = false;
  let curUid: string | null = null;
  let dbUnsub: (() => void) | null = null;

  const detach = () => {
    if (dbUnsub) {
      dbUnsub();
      dbUnsub = null;
    }
  };

  const authUnsub = onAuthChange((user) => {
    const uid = user?.uid ?? null;
    if (uid === curUid) return; // no actual change
    curUid = uid;
    detach();

    if (!uid) {
      cb(new Set()); // signed out — clear the UI
      return;
    }

    void (async () => {
      const db = await getDb();
      // Bail if we were torn down or the user changed again while awaiting.
      if (!db || cancelled || curUid !== uid) return;
      try {
        const { ref, onValue } = await import('firebase/database');
        const setRef = ref(db, `users/${uid}/${kind}`);
        dbUnsub = onValue(
          setRef,
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
            console.warn(`[${kind}] subscription error.`, err);
            cb(new Set());
          },
        );
      } catch (err) {
        console.warn(`[${kind}] subscribe failed.`, err);
        cb(new Set());
      }
    })();
  });

  return () => {
    cancelled = true;
    detach();
    authUnsub();
  };
}

/**
 * Set (`on = true`) or clear (`on = false`) one id in the current user's set.
 * No-op if not configured or signed out. Never throws.
 */
export async function setUserFlag(
  kind: UserSetKind,
  id: string,
  on: boolean,
): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const uid = getUid();
  if (!uid) return;
  try {
    const db = await getDb();
    if (!db) return;
    const { ref, set, remove } = await import('firebase/database');
    const itemRef = ref(db, `users/${uid}/${kind}/${id}`);
    if (on) await set(itemRef, true);
    else await remove(itemRef);
  } catch (err) {
    console.warn(`[${kind}] write failed.`, err);
  }
}
