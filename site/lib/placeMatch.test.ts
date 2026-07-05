import { describe, it, expect } from 'vitest';
import { matchesFilter, type PlaceCardData, type ExplorerFilterState } from './placeMatch.ts';

const base: PlaceCardData = {
  type: 'beach',
  region: 'Setúbal',
  drive: 60,
  tags: ['семейный', 'песок'],
  name: 'Praia do Creiro',
};

const emptyState: ExplorerFilterState = {
  types: [],
  region: '',
  tags: [],
  maxDrive: 240,
  query: '',
  visited: 'all',
};

describe('matchesFilter', () => {
  it('matches when no filters are active', () => {
    expect(matchesFilter(base, emptyState)).toBe(true);
  });

  it('filters by type (OR within selected types)', () => {
    expect(matchesFilter(base, { ...emptyState, types: ['hike'] })).toBe(false);
    expect(matchesFilter(base, { ...emptyState, types: ['beach', 'hike'] })).toBe(true);
  });

  it('filters by region', () => {
    expect(matchesFilter(base, { ...emptyState, region: 'Oeste' })).toBe(false);
    expect(matchesFilter(base, { ...emptyState, region: 'Setúbal' })).toBe(true);
  });

  it('filters by tags (OR within selected tags)', () => {
    expect(matchesFilter(base, { ...emptyState, tags: ['горы'] })).toBe(false);
    expect(matchesFilter(base, { ...emptyState, tags: ['песок', 'горы'] })).toBe(true);
  });

  it('filters by max drive time', () => {
    expect(matchesFilter(base, { ...emptyState, maxDrive: 40 })).toBe(false);
    expect(matchesFilter(base, { ...emptyState, maxDrive: 60 })).toBe(true);
  });

  it('filters by query across name and region, case-insensitive', () => {
    expect(matchesFilter(base, { ...emptyState, query: 'creiro' })).toBe(true);
    expect(matchesFilter(base, { ...emptyState, query: 'setúbal' })).toBe(true);
    expect(matchesFilter(base, { ...emptyState, query: 'sintra' })).toBe(false);
  });

  it('filters by visited state (tri-state)', () => {
    const visited = { ...base, visited: true };
    const unvisited = { ...base, visited: false };
    // "all" ignores visited entirely.
    expect(matchesFilter(visited, { ...emptyState, visited: 'all' })).toBe(true);
    expect(matchesFilter(unvisited, { ...emptyState, visited: 'all' })).toBe(true);
    // "visited" keeps only visited places.
    expect(matchesFilter(visited, { ...emptyState, visited: 'visited' })).toBe(true);
    expect(matchesFilter(unvisited, { ...emptyState, visited: 'visited' })).toBe(false);
    // "unvisited" keeps only not-visited places.
    expect(matchesFilter(visited, { ...emptyState, visited: 'unvisited' })).toBe(false);
    expect(matchesFilter(unvisited, { ...emptyState, visited: 'unvisited' })).toBe(true);
    // Missing visited flag counts as not-visited.
    expect(matchesFilter(base, { ...emptyState, visited: 'visited' })).toBe(false);
    expect(matchesFilter(base, { ...emptyState, visited: 'unvisited' })).toBe(true);
  });

  it('combines filters with AND', () => {
    expect(matchesFilter(base, { ...emptyState, types: ['beach'], maxDrive: 30 })).toBe(false);
    expect(matchesFilter(base, { ...emptyState, types: ['beach'], maxDrive: 90 })).toBe(true);
  });
});
