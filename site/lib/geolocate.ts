// The visitor's own position, shared by every map on the page.
//
// One `watchPosition` feeds all subscribers. It starts only after an explicit
// request (the locate button / "Рядом"), and on later visits restarts silently
// if the browser already holds a grant — never prompting on page load. The
// watch pauses while the page is hidden to spare the battery. The last fix is
// cached briefly so a page change doesn't flash an empty map.

export interface Fix {
  lat: number;
  lon: number;
  accuracy: number; // metres
  at: number; // epoch ms
}

export type GeoError = 'denied' | 'unavailable' | 'unsupported';

type Listener = (fix: Fix) => void;
type ErrorListener = (err: GeoError) => void;

const ENABLED_KEY = 'geo:on';
const LAST_KEY = 'geo:last';
const LAST_MAX_AGE = 10 * 60 * 1000;

let watchId: number | null = null;
let wanted = false;
let current: Fix | null = readCached();
const listeners = new Set<Listener>();
const errorListeners = new Set<ErrorListener>();

function readCached(): Fix | null {
  try {
    const raw = sessionStorage.getItem(LAST_KEY);
    if (!raw) return null;
    const fix = JSON.parse(raw) as Fix;
    return Date.now() - fix.at < LAST_MAX_AGE ? fix : null;
  } catch {
    return null;
  }
}

function emit(fix: Fix) {
  current = fix;
  try {
    sessionStorage.setItem(LAST_KEY, JSON.stringify(fix));
  } catch {}
  listeners.forEach((cb) => cb(fix));
}

function fail(err: GeoError) {
  if (err === 'denied') {
    wanted = false;
    try {
      localStorage.removeItem(ENABLED_KEY);
    } catch {}
    stopWatch();
  }
  errorListeners.forEach((cb) => cb(err));
}

function startWatch() {
  if (watchId !== null) return;
  watchId = navigator.geolocation.watchPosition(
    (p) =>
      emit({
        lat: p.coords.latitude,
        lon: p.coords.longitude,
        accuracy: p.coords.accuracy,
        at: p.timestamp || Date.now(),
      }),
    (e) => fail(e.code === e.PERMISSION_DENIED ? 'denied' : 'unavailable'),
    { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
  );
}

function stopWatch() {
  if (watchId === null) return;
  navigator.geolocation.clearWatch(watchId);
  watchId = null;
}

export const geoSupported = () => typeof navigator !== 'undefined' && 'geolocation' in navigator;

/** The latest known fix (possibly cached from a moment ago), or null. */
export function getFix(): Fix | null {
  return current;
}

export function isActive(): boolean {
  return wanted;
}

/** Explicit user request: prompts for permission if needed. */
export function requestLocation(): void {
  if (!geoSupported()) {
    fail('unsupported');
    return;
  }
  wanted = true;
  try {
    localStorage.setItem(ENABLED_KEY, '1');
  } catch {}
  startWatch();
}

export function onFix(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function onGeoError(cb: ErrorListener): () => void {
  errorListeners.add(cb);
  return () => errorListeners.delete(cb);
}

/**
 * Resume location without a prompt when the visitor turned it on before and
 * the permission is still granted. Resolves true when it resumed.
 */
export async function resumeIfGranted(): Promise<boolean> {
  if (!geoSupported()) return false;
  try {
    if (localStorage.getItem(ENABLED_KEY) !== '1') return false;
  } catch {
    return false;
  }
  try {
    const status = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
    if (status && status.state !== 'granted') return false;
  } catch {
    // No Permissions API: the flag alone means a grant was given before.
  }
  wanted = true;
  startWatch();
  return true;
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!wanted) return;
    if (document.hidden) stopWatch();
    else startWatch();
  });
}
