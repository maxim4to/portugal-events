import { describe, expect, test } from 'vitest';
import { formatDateRu, overlapsDay } from './dates.ts';

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

describe('formatDateRu', () => {
  test('formats a July date with genitive month', () => {
    expect(formatDateRu('2026-07-11')).toBe('11 июля');
  });
  test('strips a leading zero from the day', () => {
    expect(formatDateRu('2026-01-05')).toBe('5 января');
  });
  test('formats December', () => {
    expect(formatDateRu('2026-12-31')).toBe('31 декабря');
  });
});
