import { describe, expect, it } from 'vitest';
import { distanceKm, formatDistance, pluralRu } from './geo';

const PLACES: [string, string, string] = ['место', 'места', 'мест'];

describe('pluralRu', () => {
  it.each([
    [1, 'место'],
    [2, 'места'],
    [4, 'места'],
    [5, 'мест'],
    [11, 'мест'],
    [12, 'мест'],
    [14, 'мест'],
    [21, 'место'],
    [22, 'места'],
    [111, 'мест'],
    [234, 'места'],
    [0, 'мест'],
  ])('%i → %s', (n, form) => {
    expect(pluralRu(n, PLACES)).toBe(form);
  });
});

describe('distanceKm', () => {
  it('is zero for the same point', () => {
    expect(distanceKm(38.72, -9.14, 38.72, -9.14)).toBe(0);
  });
  it('Lisbon → Porto is ~274 km in a straight line', () => {
    const d = distanceKm(38.7223, -9.1393, 41.1579, -8.6291);
    expect(d).toBeGreaterThan(270);
    expect(d).toBeLessThan(280);
  });
});

describe('formatDistance', () => {
  it('uses metres below 1 km', () => {
    expect(formatDistance(0.347)).toBe('350 м');
    expect(formatDistance(0.001)).toBe('10 м');
  });
  it('one decimal with a comma below 10 km', () => {
    expect(formatDistance(4.24)).toBe('4,2 км');
  });
  it('whole km from 10 km', () => {
    expect(formatDistance(38.4)).toBe('38 км');
  });
});
