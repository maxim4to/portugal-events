/** Shared value formatting, so a fact reads the same on cards, popups and
 *  detail pages. */

/** Drive time in minutes → "45 мин", "2 ч", "2 ч 45 мин". */
export function formatDriveMinutes(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest} мин`;
  return rest ? `${h} ч ${rest} мин` : `${h} ч`;
}
