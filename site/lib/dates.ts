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
export function formatDateRu(iso: string, withYear = false): string {
  const [year, month, day] = iso.split('-');
  const monthName = MONTHS_GENITIVE[Number(month) - 1] ?? month;
  return withYear ? `${Number(day)} ${monthName} ${year}` : `${Number(day)} ${monthName}`;
}

/**
 * Format an event's date span: «11 июля» for one day, the short form within
 * a year («11 июля – 2 августа»), and the year on both ends
 * when the span crosses a year («13 февраля 2026 – 10 января 2027»), so a
 * range never reads backwards.
 */
export function formatDateRangeRu(start: string, end: string): string {
  if (start === end) return formatDateRu(start);
  const crossesYear = start.slice(0, 4) !== end.slice(0, 4);
  return `${formatDateRu(start, crossesYear)} – ${formatDateRu(end, crossesYear)}`;
}
