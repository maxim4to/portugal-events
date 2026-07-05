import { describe, expect, test } from 'vitest';
import { nextWeekend, overlapsDay } from './dates.ts';

describe('nextWeekend', () => {
  test('mid-week returns the upcoming weekend', () => {
    expect(nextWeekend(new Date('2026-07-01T12:00:00Z'))).toEqual({
      sat: '2026-07-04',
      sun: '2026-07-05',
    });
  });
  test('on Saturday returns the current weekend', () => {
    expect(nextWeekend(new Date('2026-07-04T12:00:00Z'))).toEqual({
      sat: '2026-07-04',
      sun: '2026-07-05',
    });
  });
  test('on Sunday still returns the current weekend', () => {
    expect(nextWeekend(new Date('2026-07-05T12:00:00Z'))).toEqual({
      sat: '2026-07-04',
      sun: '2026-07-05',
    });
  });
});

describe('overlapsDay', () => {
  const event = { dateStart: '2026-07-10', dateEnd: '2026-07-12' };
  test('true inside the range', () => {
    expect(overlapsDay(event, '2026-07-11')).toBe(true);
  });
  test('true on boundaries', () => {
    expect(overlapsDay(event, '2026-07-10')).toBe(true);
    expect(overlapsDay(event, '2026-07-12')).toBe(true);
  });
  test('false outside the range', () => {
    expect(overlapsDay(event, '2026-07-13')).toBe(false);
  });
});
