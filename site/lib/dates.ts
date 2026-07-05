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
