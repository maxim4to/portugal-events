import { describe, expect, it } from 'vitest';
import { formatDriveMinutes, shortSeason, capitalize, isInLisbon } from './format.ts';

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

describe('capitalize', () => {
  it('upper-cases the first letter only', () => {
    expect(capitalize('с детьми')).toBe('С детьми');
    expect(capitalize('ёлки')).toBe('Ёлки');
    expect(capitalize('')).toBe('');
  });
});

describe('isInLisbon', () => {
  const at = (region: string, lat: number, lon: number) => ({ region, coords: { lat, lon } });
  it('is true for central Lisbon places', () => {
    expect(isInLisbon(at('Лиссабон и Синтра', 38.7139, -9.1335))).toBe(true); // São Jorge
    expect(isInLisbon(at('Лиссабон и Синтра', 38.6916, -9.2160))).toBe(true); // Belém
  });
  it('is false across the river or outside the city', () => {
    expect(isInLisbon(at('Сетубал и Аррабида', 38.6786, -9.1711))).toBe(false); // Cristo Rei
    expect(isInLisbon(at('Лиссабон и Синтра', 38.7876, -9.3906))).toBe(false); // Sintra
  });
});
