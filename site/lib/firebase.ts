// Shared, lazy Firebase singleton used by both `auth.ts` and `userData.ts`.
//
// Nothing here runs on the server or during SSR — it is only pulled into client
// <script> bundles. With a placeholder config (apiKey === 'REPLACE_ME') every
// getter returns null so the whole feature stays INERT: no network, no errors.

import type { FirebaseApp } from 'firebase/app';
import type { Database } from 'firebase/database';
import config from './firebase-config.json';

/** True only once the real Firebase config has been filled in. */
export function isFirebaseConfigured(): boolean {
  return config.apiKey !== 'REPLACE_ME';
}

let app: FirebaseApp | null = null;
let appInitTried = false;

/** Initialise (at most once) and return the shared FirebaseApp, or null. */
export async function getApp(): Promise<FirebaseApp | null> {
  if (app) return app;
  if (appInitTried) return app;
  appInitTried = true;
  if (!isFirebaseConfigured()) return null;
  try {
    const { initializeApp, getApps } = await import('firebase/app');
    // Reuse an already-created app so auth + database never double-init it.
    app = getApps()[0] ?? initializeApp(config);
    return app;
  } catch (err) {
    console.warn('[firebase] init failed; feature disabled.', err);
    return null;
  }
}

let db: Database | null = null;

/** Lazily return the Realtime Database handle, or null when not configured. */
export async function getDb(): Promise<Database | null> {
  if (db) return db;
  const a = await getApp();
  if (!a) return null;
  try {
    const { getDatabase } = await import('firebase/database');
    db = getDatabase(a);
    return db;
  } catch (err) {
    console.warn('[firebase] database init failed.', err);
    return null;
  }
}
