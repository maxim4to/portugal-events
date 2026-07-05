import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { collectErrors } from './validate.ts';

function makeDataDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'pe-data-'));
  mkdirSync(join(dir, 'places'), { recursive: true });
  mkdirSync(join(dir, 'events'), { recursive: true });
  mkdirSync(join(dir, 'geo'), { recursive: true });
  return dir;
}

const validPlace = {
  id: 'obidos',
  name: 'Обидуш',
  type: 'town',
  region: 'Оэште',
  coords: { lat: 39.3606, lon: -9.1575 },
  description: 'Средневековый городок в крепостных стенах.',
  driveMinutesFromLisbon: 65,
  visitDurationHours: 3,
  bestSeason: 'круглый год',
  tags: [],
  links: [],
  status: 'approved',
};

describe('collectErrors', () => {
  test('returns no errors for a valid dataset', () => {
    const dir = makeDataDir();
    writeFileSync(join(dir, 'places', 'oeste.json'), JSON.stringify([validPlace]));
    writeFileSync(join(dir, 'sources.json'), '[]');
    writeFileSync(join(dir, 'geo', 'cities.json'), '[]');
    expect(collectErrors(dir)).toEqual([]);
  });

  test('reports schema violations with file path', () => {
    const dir = makeDataDir();
    const broken = { ...validPlace, name: '' };
    writeFileSync(join(dir, 'places', 'oeste.json'), JSON.stringify([broken]));
    const errors = collectErrors(dir);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('oeste.json');
    expect(errors[0]).toContain('name');
  });

  test('reports invalid JSON', () => {
    const dir = makeDataDir();
    writeFileSync(join(dir, 'places', 'oeste.json'), '{oops');
    const errors = collectErrors(dir);
    expect(errors[0]).toContain('invalid JSON');
  });

  test('reports duplicate place ids across files', () => {
    const dir = makeDataDir();
    writeFileSync(join(dir, 'places', 'a.json'), JSON.stringify([validPlace]));
    writeFileSync(join(dir, 'places', 'b.json'), JSON.stringify([validPlace]));
    const errors = collectErrors(dir);
    expect(errors.some((e) => e.includes('duplicate place id'))).toBe(true);
  });

  test('reports a collection referencing an unknown place', () => {
    const dir = makeDataDir();
    writeFileSync(join(dir, 'places', 'oeste.json'), JSON.stringify([validPlace]));
    writeFileSync(
      join(dir, 'collections.json'),
      JSON.stringify([{ id: 'x', title: 't', description: 'd', placeIds: ['does-not-exist'] }]),
    );
    const errors = collectErrors(dir);
    expect(errors.some((e) => e.includes('unknown place'))).toBe(true);
  });
});
