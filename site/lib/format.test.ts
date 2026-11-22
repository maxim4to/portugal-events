import { describe, expect, it } from 'vitest';
import { formatDriveMinutes } from './format.ts';

describe('formatDriveMinutes', () => {
  it('keeps short trips in minutes', () => {
    expect(formatDriveMinutes(45)).toBe('45 мин');
  });
  it('drops zero minutes on whole hours', () => {
    expect(formatDriveMinutes(120)).toBe('2 ч');
  });
  it('splits hours and minutes', () => {
    expect(formatDriveMinutes(165)).toBe('2 ч 45 мин');
  });
  it('rounds fractional input', () => {
    expect(formatDriveMinutes(89.6)).toBe('1 ч 30 мин');
  });
});
