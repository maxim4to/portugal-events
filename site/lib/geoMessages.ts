/**
 * User-facing strings for the "Где я" map control. Kept apart from
 * `geolocate.ts` so the copy can be unit-tested without importing Leaflet
 * (which needs a DOM at import time).
 */

export const GEO_UNSUPPORTED = 'Геолокация не поддерживается этим браузером';

/** Human-readable (Russian) message for a GeolocationPositionError-ish object. */
export function geolocationErrorMessage(err: { code?: number } | null | undefined): string {
  switch (err?.code) {
    case 1: // PERMISSION_DENIED
      return 'Доступ к геолокации запрещён — разрешите его в настройках браузера';
    case 3: // TIMEOUT
      return 'Не удалось определить местоположение: слишком долго';
    default: // POSITION_UNAVAILABLE and anything unexpected
      return 'Не удалось определить местоположение';
  }
}
