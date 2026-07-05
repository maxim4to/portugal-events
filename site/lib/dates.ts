function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * The weekend containing `from` if it is Sat/Sun, otherwise the upcoming one.
 * Uses UTC day boundaries — fine for Portugal (UTC/UTC+1).
 */
export function nextWeekend(from: Date): { sat: string; sun: string } {
  const day = from.getUTCDay();
  const offsetToSat = day === 0 ? -1 : 6 - day;
  const sat = new Date(from);
  sat.setUTCDate(from.getUTCDate() + offsetToSat);
  const sun = new Date(sat);
  sun.setUTCDate(sat.getUTCDate() + 1);
  return { sat: toISODate(sat), sun: toISODate(sun) };
}

export function overlapsDay(
  event: { dateStart: string; dateEnd: string },
  dayISO: string,
): boolean {
  return event.dateStart <= dayISO && dayISO <= event.dateEnd;
}

const MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

/**
 * Format an ISO `YYYY-MM-DD` date into a short Russian form, e.g. «11 июля».
 * Uses the genitive month name (as read alongside a day number).
 */
export function formatDateRu(iso: string): string {
  const [, month, day] = iso.split('-');
  const monthName = MONTHS_GENITIVE[Number(month) - 1] ?? month;
  return `${Number(day)} ${monthName}`;
}
