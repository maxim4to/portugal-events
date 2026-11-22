/** Shared value formatting, so a fact reads the same on cards, popups and
 *  detail pages. */

const NBSP = ' ';

/** Drive time in minutes → "45 мин", "2 ч", "2 ч 45 мин" (non-breaking
 *  spaces, so the value never wraps mid-phrase). */
export function formatDriveMinutes(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  const parts = h === 0 ? [`${rest}${NBSP}мин`] : rest ? [`${h}${NBSP}ч`, `${rest}${NBSP}мин`] : [`${h}${NBSP}ч`];
  return parts.join(NBSP);
}

const MONTHS: Record<string, string> = {
  январь: 'янв',
  февраль: 'фев',
  март: 'мар',
  апрель: 'апр',
  май: 'май',
  июнь: 'июн',
  июль: 'июл',
  август: 'авг',
  сентябрь: 'сен',
  октябрь: 'окт',
  ноябрь: 'ноя',
  декабрь: 'дек',
};

/** Compact best-season for cards: drops parenthetical notes, abbreviates
 *  months and normalises ranges to an en dash.
 *  "сентябрь–июнь (летом жара)" → "сен–июн"; "круглый год (…)" → "весь год". */
export function shortSeason(season: string): string {
  return season
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/круглый год/gi, 'весь год')
    .replace(/(\p{L})\s*[-–—]\s*(\p{L})/gu, '$1–$2')
    .replace(/\p{L}+/gu, (w) => MONTHS[w.toLowerCase()] ?? w)
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Display form of a lowercase data label (tags): first letter upper-cased.
 *  The data and URLs keep the original lowercase value. */
export function capitalize(s: string): string {
  return s ? s.charAt(0).toLocaleUpperCase('ru') + s.slice(1) : s;
}

/** A place inside Lisbon itself, where "drive time from Lisbon" (10–20 min of
 *  city traffic) says nothing useful: shown as «В Лиссабоне» instead. Region +
 *  distance from the centre, so Almada (Cristo Rei) or Odivelas stay out. */
const LISBON = { lat: 38.7223, lon: -9.1393 };
export function isInLisbon(p: { region: string; coords: { lat: number; lon: number } }): boolean {
  if (!p.region.startsWith('Лиссабон')) return false;
  const kmLat = (p.coords.lat - LISBON.lat) * 111;
  const kmLon = (p.coords.lon - LISBON.lon) * 111 * Math.cos((LISBON.lat * Math.PI) / 180);
  return Math.hypot(kmLat, kmLon) < 9;
}
