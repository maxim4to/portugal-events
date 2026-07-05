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
