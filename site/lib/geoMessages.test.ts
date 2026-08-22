import { describe, expect, test } from 'vitest';
import { geolocationErrorMessage } from './geoMessages.ts';

describe('geolocationErrorMessage', () => {
  test('permission denied explains how to fix it', () => {
    expect(geolocationErrorMessage({ code: 1 })).toMatch(/запрещ/);
  });
  test('timeout gets its own message', () => {
    expect(geolocationErrorMessage({ code: 3 })).toMatch(/долго/);
  });
  test('position unavailable and unknown codes fall back', () => {
    const fallback = 'Не удалось определить местоположение';
    expect(geolocationErrorMessage({ code: 2 })).toBe(fallback);
    expect(geolocationErrorMessage({})).toBe(fallback);
    expect(geolocationErrorMessage(null)).toBe(fallback);
  });
});
