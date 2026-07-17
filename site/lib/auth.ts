// Client-only Google authentication on top of the shared Firebase app.
//
// State lives in Firebase Authentication. On sign-in the user's uid keys their
// private data under `users/<uid>/…` (see userData.ts). Everything degrades
// gracefully: with a placeholder Firebase config the module is inert — every
// call is a no-op and `onAuthChange` reports a signed-out user forever.
//
// Framework-free plain TS; only referenced from client <script> bundles.

import type { Auth, User } from 'firebase/auth';
import { getApp, isFirebaseConfigured } from './firebase';

/** True only when the real Firebase config has been filled in. */
export function isAuthConfigured(): boolean {
  return isFirebaseConfigured();
}

let auth: Auth | null = null;
let authInitTried = false;
let ready = false; // has the first auth-state callback fired?
let currentUser: User | null = null;
const listeners = new Set<(user: User | null) => void>();

// Warmed during ensureAuth so the click handler can open the popup with no
// preceding `await` — an intervening await drops the transient user activation
// and trips popup blockers (notably Safari). Since every page calls
// onAuthChange on load, these are ready well before any click.
type PopupSignIn = (auth: Auth, provider: unknown) => Promise<unknown>;
let popupSignIn: PopupSignIn | null = null;
let googleProvider: unknown = null;

/** Initialise Firebase Auth once and start streaming state to `listeners`. */
async function ensureAuth(): Promise<Auth | null> {
  if (auth) return auth;
  if (authInitTried) return auth;
  authInitTried = true;
  const app = await getApp();
  if (!app) {
    // Not configured: treat as permanently signed-out so subscribers settle.
    ready = true;
    listeners.forEach((cb) => cb(null));
    return null;
  }
  try {
    const { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } =
      await import('firebase/auth');
    auth = getAuth(app);
    popupSignIn = signInWithPopup as PopupSignIn;
    googleProvider = new GoogleAuthProvider();
    onAuthStateChanged(auth, (user) => {
      currentUser = user;
      ready = true;
      listeners.forEach((cb) => cb(user));
    });
    return auth;
  } catch (err) {
    console.warn('[auth] init failed; sign-in disabled.', err);
    ready = true;
    listeners.forEach((cb) => cb(null));
    return null;
  }
}

/**
 * Subscribe to auth-state changes. `cb` fires with the current user (or null)
 * as soon as it's known, and again on every sign-in / sign-out. Returns an
 * unsubscribe function.
 */
export function onAuthChange(cb: (user: User | null) => void): () => void {
  listeners.add(cb);
  if (ready) cb(currentUser); // replay the latest state to the new subscriber
  void ensureAuth(); // idempotent — kicks off the listener on first call
  return () => {
    listeners.delete(cb);
  };
}

/** The signed-in user's uid, or null. Populated once auth state is known. */
export function getUid(): string | null {
  return currentUser?.uid ?? null;
}

/** The signed-in user, or null. */
export function getUser(): User | null {
  return currentUser;
}

/**
 * Open the Google sign-in popup. No-op (logs) when not configured or on error.
 * Must be called directly from a click handler with no preceding `await`.
 */
export async function signInWithGoogle(): Promise<void> {
  // Fast path: auth is already warm (the common case — warmed on page load).
  // Invoke signInWithPopup synchronously so the user gesture is preserved.
  if (auth && popupSignIn && googleProvider) {
    try {
      await popupSignIn(auth, googleProvider);
    } catch (err) {
      // Popup closed / blocked / cancelled — non-fatal.
      console.warn('[auth] sign-in failed.', err);
    }
    return;
  }
  // Cold path: clicked before warm-up finished. The gesture may be lost here,
  // but this is rare (init is kicked off on load) and the user can click again.
  const a = await ensureAuth();
  if (!a || !popupSignIn || !googleProvider) return;
  try {
    await popupSignIn(a, googleProvider);
  } catch (err) {
    console.warn('[auth] sign-in failed.', err);
  }
}

/** Sign the current user out. No-op when not configured. */
export async function signOutUser(): Promise<void> {
  const a = await ensureAuth();
  if (!a) return;
  try {
    const { signOut } = await import('firebase/auth');
    await signOut(a);
  } catch (err) {
    console.warn('[auth] sign-out failed.', err);
  }
}
