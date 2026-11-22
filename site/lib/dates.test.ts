import { describe, expect, test } from 'vitest';
import { formatDateRangeRu, formatDateRu, overlapsDay } from './dates.ts';

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

describe('formatDateRu with year', () => {
  test('appends the year when asked', () => {
    expect(formatDateRu('2027-01-10', true)).toBe('10 января 2027');
  });
});

describe('formatDateRangeRu', () => {
  test('single day shows one date', () => {
    expect(formatDateRangeRu('2026-07-11', '2026-07-11')).toBe('11 июля');
  });
  test('range within one year stays short', () => {
    expect(formatDateRangeRu('2026-07-18', '2026-12-30')).toBe('18 июля – 30 декабря');
  });
  test('range crossing a year shows the year on both ends', () => {
    expect(formatDateRangeRu('2026-02-13', '2027-01-10')).toBe(
      '13 февраля 2026 – 10 января 2027',
    );
    expect(formatDateRangeRu('2026-10-02', '2027-02-22')).toBe(
      '2 октября 2026 – 22 февраля 2027',
    );
  });
});
