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
