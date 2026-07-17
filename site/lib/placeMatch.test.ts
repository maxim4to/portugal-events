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
  regions: [],
  tags: [],
  maxDrive: 240,
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

  it('filters by region (OR within selected regions)', () => {
    expect(matchesFilter(base, { ...emptyState, regions: ['Oeste'] })).toBe(false);
    expect(matchesFilter(base, { ...emptyState, regions: ['Setúbal'] })).toBe(true);
    expect(matchesFilter(base, { ...emptyState, regions: ['Oeste', 'Setúbal'] })).toBe(true);
  });

  it('filters by tags (OR within selected tags)', () => {
    expect(matchesFilter(base, { ...emptyState, tags: ['горы'] })).toBe(false);
    expect(matchesFilter(base, { ...emptyState, tags: ['песок', 'горы'] })).toBe(true);
  });

  it('filters by max drive time', () => {
    expect(matchesFilter(base, { ...emptyState, maxDrive: 40 })).toBe(false);
    expect(matchesFilter(base, { ...emptyState, maxDrive: 60 })).toBe(true);
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

  it('filters by favorites when onlyFavorites is on', () => {
    const fav = { ...base, favorite: true };
    // Off: both match regardless of the card's favorite flag.
    expect(matchesFilter(base, emptyState)).toBe(true);
    expect(matchesFilter(fav, emptyState)).toBe(true);
    // On: only favorited cards match.
    expect(matchesFilter(fav, { ...emptyState, onlyFavorites: true })).toBe(true);
    expect(matchesFilter(base, { ...emptyState, onlyFavorites: true })).toBe(false);
  });

  it('filters by freeWithResidency when the flag is on', () => {
    const free = { ...base, freeWithResidency: true };
    // Flag off: both match regardless of the card's flag.
    expect(matchesFilter(base, emptyState)).toBe(true);
    expect(matchesFilter(free, emptyState)).toBe(true);
    // Flag on: only cards with freeWithResidency true match.
    expect(matchesFilter(free, { ...emptyState, freeWithResidency: true })).toBe(true);
    expect(matchesFilter(base, { ...emptyState, freeWithResidency: true })).toBe(false);
  });

  it('combines filters with AND', () => {
    expect(matchesFilter(base, { ...emptyState, types: ['beach'], maxDrive: 30 })).toBe(false);
    expect(matchesFilter(base, { ...emptyState, types: ['beach'], maxDrive: 90 })).toBe(true);
  });
});
