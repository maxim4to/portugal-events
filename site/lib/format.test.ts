import { describe, expect, it } from 'vitest';
import { formatDriveMinutes, shortSeason } from './format.ts';

const sp = (s: string) => s.replace(/ /g, ' ');

describe('formatDriveMinutes', () => {
  it('keeps short trips in minutes', () => {
    expect(sp(formatDriveMinutes(45))).toBe('45 мин');
  });
  it('drops zero minutes on whole hours', () => {
    expect(sp(formatDriveMinutes(120))).toBe('2 ч');
  });
  it('splits hours and minutes', () => {
    expect(sp(formatDriveMinutes(165))).toBe('2 ч 45 мин');
  });
  it('rounds fractional input', () => {
    expect(sp(formatDriveMinutes(89.6))).toBe('1 ч 30 мин');
  });
  it('never contains a breaking space', () => {
    expect(formatDriveMinutes(105)).not.toMatch(/ /);
  });
});

describe('shortSeason', () => {
  it('abbreviates a month range and drops the note', () => {
    expect(shortSeason('сентябрь–июнь (летом жара)')).toBe('сен–июн');
  });
  it('normalises a hyphen to an en dash', () => {
    expect(shortSeason('апрель-октябрь')).toBe('апр–окт');
  });
  it('keeps non-month words', () => {
    expect(shortSeason('круглый год (весной цветут дубравы)')).toBe('весь год');
    expect(shortSeason('весна и осень')).toBe('весна и осень');
  });
  it('handles compound seasons', () => {
    expect(shortSeason('март-май, сентябрь-ноябрь')).toBe('мар–май, сен–ноя');
    expect(shortSeason('сентябрь–октябрь (сбор винограда) и весна')).toBe('сен–окт и весна');
  });
});
