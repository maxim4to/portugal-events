import { describe, expect, test } from 'vitest';
import { resolveCollection } from './collections.ts';
import type { Place, Collection } from '../../schema/index.ts';

const p = (id: string): Place => ({
  id, name: id, type: 'beach', region: 'r', coords: { lat: 38, lon: -9 },
  description: 'd', driveMinutesFromLisbon: 40, visitDurationHours: 2,
  bestSeason: 'лето', tags: [], links: [], collections: [], status: 'approved',
});

describe('resolveCollection', () => {
  const places = [p('a'), p('b'), p('c')];
  const col: Collection = { id: 'x', title: 't', description: 'd', placeIds: ['b', 'a'] };
  test('returns places in the collection order', () => {
    expect(resolveCollection(col, places).map((x) => x.id)).toEqual(['b', 'a']);
  });
  test('skips ids with no matching place', () => {
    const c2: Collection = { ...col, placeIds: ['a', 'missing'] };
    expect(resolveCollection(c2, places).map((x) => x.id)).toEqual(['a']);
  });
});
