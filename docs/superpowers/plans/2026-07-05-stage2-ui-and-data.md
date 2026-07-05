# Stage 2: Design System, Catalog UI and Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the bare Stage 1 site into a modern, app-like product: a design system, a places catalog with instant client-side filters and a Leaflet map, place detail pages, curated collections, a `generate-places` agent skill, and ~60–80 real places with Wikimedia photos.

**Architecture:** Astro static site. All data (JSON in `data/`) is baked in at build time and also emitted as one client JSON bundle so filtering/search/map run instantly in the browser with zero backend. Presentation is a small design-token CSS layer plus focused, reusable `.astro` components. Pure logic (filtering, collection resolution, photo fallback) lives in tested TypeScript modules under `site/lib/`.

**Tech Stack:** Astro 5, TypeScript, zod, vitest, Leaflet 1.9 (self-hosted via npm, no API key), OpenStreetMap tiles.

**Spec:** `docs/superpowers/specs/2026-07-05-portugal-events-design.md`
**Design direction:** clean minimalism / app-like — map + list, quick filter chips, tidy cards. Photos from Wikimedia Commons with a colored icon fallback. Light and dark mode both required.

**Conventions for all tasks (read every time):**
- Work from repo root `/Users/m.ivanov/portugal-events` on the branch the controller checked out. Commit; never push (the controller merges).
- End every commit message with a `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` trailer.
- Data content is Russian; code identifiers English. Sentence case in UI copy. No emoji.
- TS imports use the `.ts` extension (project has `allowImportingTsExtensions`).
- Never commit `node_modules/` or `dist/`.
- After any change, `npm run build` and `npm test` must both pass before you commit.
- Existing exports you can rely on: `schema/index.ts` → `PlaceSchema`, `EventSchema`, `SourceSchema`, `CitySchema`, `PLACE_TYPES`, `EVENT_TYPES`, types `Place`/`Event`/`Source`/`City`. `site/lib/dates.ts` → `nextWeekend`, `overlapsDay`. `site/lib/data.ts` → `allPlaces`, `approvedPlaces`, `upcomingEvents`.

---

### Task 1: Extend the Place schema with photo and collections

**Files:**
- Modify: `schema/index.ts`
- Modify: `schema/index.test.ts`
- Create: `data/collections.json`
- Modify: `pipeline/validate.ts`
- Modify: `pipeline/validate.test.ts`

- [ ] **Step 1: Add failing schema tests** — append to `schema/index.test.ts` inside the `PlaceSchema` describe block:

```ts
  test('accepts an optional photo', () => {
    const withPhoto = {
      ...validPlace,
      photo: {
        url: 'https://upload.wikimedia.org/x.jpg',
        author: 'Jane Doe',
        license: 'CC BY-SA 4.0',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:x.jpg',
      },
    };
    expect(PlaceSchema.safeParse(withPhoto).success).toBe(true);
  });
  test('accepts a place with no photo', () => {
    expect(PlaceSchema.safeParse(validPlace).success).toBe(true);
  });
  test('rejects a photo missing its license', () => {
    const bad = { ...validPlace, photo: { url: 'https://x/y.jpg', author: 'A', sourceUrl: 'https://x' } };
    expect(PlaceSchema.safeParse(bad).success).toBe(false);
  });
  test('accepts collections as slug array', () => {
    expect(PlaceSchema.safeParse({ ...validPlace, collections: ['beaches-day-trip'] }).success).toBe(true);
  });
```

Add a new describe block for the collection schema:

```ts
import { CollectionSchema } from './index.ts';

describe('CollectionSchema', () => {
  test('accepts a valid collection', () => {
    const c = {
      id: 'beaches-day-trip',
      title: 'Пляжи на день из Лиссабона',
      description: 'Океанские пляжи в пределах часа езды.',
      placeIds: ['praia-da-ursa', 'praia-do-guincho'],
    };
    expect(CollectionSchema.safeParse(c).success).toBe(true);
  });
  test('rejects a non-slug id', () => {
    expect(CollectionSchema.safeParse({ id: 'Beaches', title: 'x', description: 'y', placeIds: [] }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests, verify the new ones fail** — `npm test`. Expected: the four new PlaceSchema tests plus CollectionSchema tests fail to import/parse; existing tests pass.

- [ ] **Step 3: Implement in `schema/index.ts`** — add a `PhotoSchema`, extend `PlaceSchema`, add `CollectionSchema`. Insert the photo schema before `PlaceSchema` and add the two fields:

```ts
export const PhotoSchema = z.object({
  url: z.string().url(),
  author: z.string().min(1),
  license: z.string().min(1),
  sourceUrl: z.string().url(),
});
export type Photo = z.infer<typeof PhotoSchema>;
```

Inside the `PlaceSchema` object, after `links`, add:

```ts
  photo: PhotoSchema.optional(),
  collections: z.array(slug).default([]),
```

At the end of the file add:

```ts
export const CollectionSchema = z.object({
  id: slug,
  title: z.string().min(1),
  description: z.string().min(1),
  placeIds: z.array(slug),
});
export type Collection = z.infer<typeof CollectionSchema>;
```

- [ ] **Step 4: Create `data/collections.json`** (references existing seed place ids so it validates today):

```json
[
  {
    "id": "beaches-day-trip",
    "title": "Пляжи на день из Лиссабона",
    "description": "Океанские пляжи в пределах часа езды — можно успеть туда и обратно за день.",
    "placeIds": ["praia-da-ursa", "praia-do-guincho", "praia-dos-galapinhos"]
  },
  {
    "id": "castles-and-palaces",
    "title": "Замки и дворцы",
    "description": "Крепости и исторические места с видами.",
    "placeIds": ["castelo-dos-mouros", "obidos"]
  }
]
```

- [ ] **Step 5: Add collection validation.** In `pipeline/validate.ts`, import `CollectionSchema`, and after the places loop add a block that (a) validates `data/collections.json` against `z.array(CollectionSchema)` and (b) checks every `placeId` referenced by a collection exists in `placeIds` map. Add near the other checks:

```ts
import { CitySchema, CollectionSchema, EventSchema, PlaceSchema, SourceSchema } from '../schema/index.ts';
```

After the places loop (which fills `placeIds`), before the events loop, add:

```ts
  const collections = check(join(dataDir, 'collections.json'), z.array(CollectionSchema));
  for (const c of collections ?? []) {
    for (const pid of c.placeIds) {
      if (!placeIds.has(pid)) {
        errors.push(`collections.json: collection "${c.id}" references unknown place "${pid}"`);
      }
    }
  }
```

- [ ] **Step 6: Add a failing-then-passing validate test** — append to `pipeline/validate.test.ts`:

```ts
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
```

- [ ] **Step 7: Run everything** — `npm test && npm run validate`. Expected: all tests pass (new ones green), `All data files are valid.`

- [ ] **Step 8: Commit** — `git add schema/ pipeline/ data/collections.json && git commit -m "feat: add photo and collections to place schema"`

---

### Task 2: Design tokens and global stylesheet

**Files:**
- Create: `site/styles/tokens.css`
- Create: `site/styles/base.css`

- [ ] **Step 1: Create `site/styles/tokens.css`** — a light/dark token layer. Define CSS custom properties on `:root` for light mode and override under `:root[data-theme="dark"]` and `@media (prefers-color-scheme: dark)` (when no explicit theme). Include:
  - Surfaces: `--surface-0` (page), `--surface-1` (raised), `--surface-2` (card/white).
  - Text: `--text-primary`, `--text-secondary`, `--text-muted`.
  - Border: `--border`, `--border-strong`.
  - Accent: `--accent`, `--accent-bg`, `--accent-text`.
  - Type-color tints for the 8 place types (`--type-beach`, `--type-hike`, `--type-castle`, `--type-lake`, `--type-viewpoint`, `--type-town`, `--type-nature`, `--type-other`) — soft background tints used as card cover fallbacks. Pick calm, distinct hues that work in both modes.
  - Radius `--radius: 10px`, `--radius-pill: 100px`; spacing scale `--space-1..6`; font stack `--font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
  - Light values: page `#faf9f7`, card `#ffffff`, primary text `#1a1a18`, secondary `#5f5e5a`, border `rgba(0,0,0,0.1)`, accent `#185fa5`. Dark values: page `#1a1a18`, card `#26261f`→ use `#242320`, text `#f1efe8`, secondary `#b4b2a9`, border `rgba(255,255,255,0.12)`, accent `#85b7eb`. Choose type tints accordingly (lighter in light mode, muted in dark).

- [ ] **Step 2: Create `site/styles/base.css`** — global resets and primitives used across pages: box-sizing reset; `body` uses `--font`, `--surface-0` bg, `--text-primary`, `line-height:1.6`, no margin; links inherit color; container `.container { max-width: 1100px; margin: 0 auto; padding: 0 var(--space-4); }`; utility classes for the filter chip (`.chip`), pill badge (`.badge`), button (`.btn`), and card (`.card`) matching the mockup (0.5px borders, `--radius`, card padding). Keep it lean — no component-specific rules that belong in `.astro` files.

- [ ] **Step 3: Verify CSS parses** — `npx lightningcss site/styles/tokens.css -o /dev/null 2>/dev/null || node -e "const fs=require('fs');['site/styles/tokens.css','site/styles/base.css'].forEach(f=>{const c=fs.readFileSync(f,'utf8');const o=(c.match(/{/g)||[]).length,cl=(c.match(/}/g)||[]).length;if(o!==cl)throw new Error(f+': unbalanced braces '+o+'/'+cl);console.log(f+' ok')})"`. Expected: both files report ok (balanced braces).

- [ ] **Step 4: Commit** — `git add site/styles/ && git commit -m "feat: add design tokens and global stylesheet"`

---

### Task 3: Client data bundle and filter logic (TDD)

**Files:**
- Create: `site/lib/filters.ts`
- Test: `site/lib/filters.test.ts`
- Create: `site/lib/collections.ts`
- Test: `site/lib/collections.test.ts`
- Modify: `site/lib/data.ts`

- [ ] **Step 1: Write `site/lib/filters.test.ts`**

```ts
import { describe, expect, test } from 'vitest';
import { filterPlaces, type PlaceFilter } from './filters.ts';
import type { Place } from '../../schema/index.ts';

const make = (over: Partial<Place>): Place => ({
  id: over.id ?? 'x', name: over.name ?? 'Место', type: over.type ?? 'beach',
  region: over.region ?? 'Лиссабон и Синтра',
  coords: { lat: 38, lon: -9 }, description: 'd',
  driveMinutesFromLisbon: over.driveMinutesFromLisbon ?? 45,
  visitDurationHours: 2, bestSeason: 'лето', tags: over.tags ?? [], links: [],
  collections: [], status: 'approved', ...over,
});

const beach = make({ id: 'b', type: 'beach', name: 'Урса', driveMinutesFromLisbon: 45, tags: ['закат'] });
const castle = make({ id: 'c', type: 'castle', name: 'Замок', region: 'Оэште', driveMinutesFromLisbon: 90 });

describe('filterPlaces', () => {
  const all = [beach, castle];
  test('empty filter returns all', () => {
    expect(filterPlaces(all, {} as PlaceFilter)).toHaveLength(2);
  });
  test('filters by type', () => {
    expect(filterPlaces(all, { types: ['beach'] })).toEqual([beach]);
  });
  test('filters by region', () => {
    expect(filterPlaces(all, { regions: ['Оэште'] })).toEqual([castle]);
  });
  test('filters by max drive minutes', () => {
    expect(filterPlaces(all, { maxDriveMinutes: 60 })).toEqual([beach]);
  });
  test('filters by tag', () => {
    expect(filterPlaces(all, { tags: ['закат'] })).toEqual([beach]);
  });
  test('search matches name case-insensitively', () => {
    expect(filterPlaces(all, { query: 'урс' })).toEqual([beach]);
  });
  test('combines filters with AND', () => {
    expect(filterPlaces(all, { types: ['beach'], maxDriveMinutes: 30 })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, verify fail** — `npm test`. Expected: cannot resolve `./filters.ts`.

- [ ] **Step 3: Write `site/lib/filters.ts`**

```ts
import type { Place } from '../../schema/index.ts';

export interface PlaceFilter {
  types?: string[];
  regions?: string[];
  tags?: string[];
  maxDriveMinutes?: number;
  query?: string;
}

export function filterPlaces(places: Place[], f: PlaceFilter): Place[] {
  const q = f.query?.trim().toLowerCase();
  return places.filter((p) => {
    if (f.types?.length && !f.types.includes(p.type)) return false;
    if (f.regions?.length && !f.regions.includes(p.region)) return false;
    if (f.tags?.length && !f.tags.some((t) => p.tags.includes(t))) return false;
    if (f.maxDriveMinutes != null && p.driveMinutesFromLisbon > f.maxDriveMinutes) return false;
    if (q && !(`${p.name} ${p.region}`.toLowerCase().includes(q))) return false;
    return true;
  });
}
```

- [ ] **Step 4: Write `site/lib/collections.test.ts`**

```ts
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
```

- [ ] **Step 5: Write `site/lib/collections.ts`**

```ts
import type { Collection, Place } from '../../schema/index.ts';

export function resolveCollection(collection: Collection, places: Place[]): Place[] {
  const byId = new Map(places.map((p) => [p.id, p]));
  return collection.placeIds.map((id) => byId.get(id)).filter((p): p is Place => p != null);
}
```

- [ ] **Step 6: Extend `site/lib/data.ts`** — add collection loading and derived lists used by pages. Append:

```ts
import { CollectionSchema, type Collection } from '../../schema/index.ts';

const collectionFiles = import.meta.glob('../../data/collections.json', {
  eager: true,
  import: 'default',
});
export const collections: Collection[] = Object.values(collectionFiles).flatMap((v) =>
  z.array(CollectionSchema).parse(v),
);

export const regions: string[] = [...new Set(approvedPlaces.map((p) => p.region))].sort();
export const allTags: string[] = [...new Set(approvedPlaces.flatMap((p) => p.tags))].sort();
```

- [ ] **Step 7: Run everything** — `npm test && npm run build`. Expected: all tests pass (filters + collections added), build succeeds.

- [ ] **Step 8: Commit** — `git add site/lib/ && git commit -m "feat: add filter logic, collection resolution and client data lists"`

---

### Task 4: Layout shell and shared UI components

**Files:**
- Modify: `site/layouts/Base.astro`
- Create: `site/components/Header.astro`
- Create: `site/components/PlaceCard.astro`
- Create: `site/components/TypeBadge.astro`

Design constraints: use only the CSS variables from `tokens.css`; 0.5px borders; `--radius`; sentence case; no emoji; Tabler-style intent but use inline SVG or unicode-free text labels (do NOT depend on an icon webfont — this is a real site, so either add the `@tabler/icons` package if you use icons, or use simple inline SVG). Prefer inline SVG icons kept in a tiny `site/components/Icon.astro` if needed; if it grows past ~10 icons, report DONE_WITH_CONCERNS.

- [ ] **Step 1: Rewrite `site/layouts/Base.astro`** — import `../styles/tokens.css` and `../styles/base.css` (Astro bundles them). Render `<html lang="ru">` with `<head>` (charset, viewport, `<title>{title}</title>`, meta description from a `description` prop with a default) and a `data-theme` bootstrap inline script that reads `localStorage.theme` and sets `document.documentElement.dataset.theme` before paint (avoid FOUC). Body renders `<Header />` then `<main class="container"><slot/></main>` then a minimal footer with the OpenStreetMap/Wikimedia attribution note. Keep the `href()` base-path helper from Stage 1 and pass it to Header.

- [ ] **Step 2: Create `site/components/Header.astro`** — sticky top bar: site name linking home, nav links (Выходные / Места / Афиша / Подборки), and a theme toggle button (light/dark) that flips `document.documentElement.dataset.theme` and persists to `localStorage`. Nav uses the base-path-aware `href`. Highlight the active link using `Astro.url.pathname`.

- [ ] **Step 3: Create `site/components/TypeBadge.astro`** — props `{ type: string }`. Renders a pill badge with the Russian label for the type and the matching `--type-*` tint background. Include a `TYPE_LABELS` map (`beach`→«Пляж», `hike`→«Хайкинг», `castle`→«Замок», `lake`→«Озеро», `viewpoint`→«Вид», `town`→«Городок», `nature`→«Природа», `other`→«Другое»). Export `TYPE_LABELS` so other files reuse it (put it in `site/lib/labels.ts` and import here — create that file).

- [ ] **Step 4: Create `site/lib/labels.ts`**

```ts
export const TYPE_LABELS: Record<string, string> = {
  beach: 'Пляж', hike: 'Хайкинг', castle: 'Замок', lake: 'Озеро',
  viewpoint: 'Вид', town: 'Городок', nature: 'Природа', other: 'Другое',
};
export const EVENT_TYPE_LABELS: Record<string, string> = {
  concert: 'Концерт', festival: 'Фестиваль', exhibition: 'Выставка',
  market: 'Ярмарка', sport: 'Спорт', other: 'Событие',
};
```

- [ ] **Step 5: Create `site/components/PlaceCard.astro`** — props `{ place: Place, href: string }`. Matches the mockup: a cover area (if `place.photo` render `<img src loading="lazy" alt={place.name}>`, else a solid `--type-*` tinted block) with a `TypeBadge` overlaid; body with name (`h3`), one-line truncated description, and a meta row (`{drive} мин`, `~{hours} ч`, `{bestSeason}`). Whole card links to `href`. Photo cover uses `aspect-ratio: 16/10; object-fit: cover`. Include a small photo attribution (`© {author}`) as a `title`/tooltip when a photo exists. Component-scoped `<style>` only.

- [ ] **Step 6: Build check** — the components aren't on a page yet, so add nothing to pages; just ensure `npm run build` still succeeds and `npm test` passes. Expected: build ok.

- [ ] **Step 7: Commit** — `git add site/ && git commit -m "feat: add layout shell, header, place card and type badge"`

---

### Task 5: Places catalog page with filters and list/map toggle

**Files:**
- Modify: `site/pages/places.astro` (full rewrite)
- Create: `site/components/FilterBar.astro`
- Create: `site/components/PlacesExplorer.astro`
- Add dependency: `leaflet` + `@types/leaflet`

- [ ] **Step 1: Install Leaflet** — `npm install leaflet@^1.9.4 && npm install -D @types/leaflet`. Verify it appears in `package.json`.

- [ ] **Step 2: Create `site/components/FilterBar.astro`** — renders the search input, type chips (from `TYPE_LABELS`), a region `<select>`, a max-drive `<input type="range" min="20" max="240" step="10">` with a live readout, and a tags dropdown/summary. It renders markup + `data-*` hooks only; it does NOT contain logic. All interactivity is wired by `PlacesExplorer`'s script. Props: `{ regions: string[], tags: string[] }`.

- [ ] **Step 3: Create `site/components/PlacesExplorer.astro`** — the interactive island. Props: `{ places: Place[], regions: string[], tags: string[], hrefBase: string }`.
  - Server-render: the `FilterBar`, a view toggle (Список / Карта), a results count, a grid of `PlaceCard`s (all places, server-rendered for SEO/no-JS), and an empty `<div id="map">` (hidden until Карта selected).
  - Serialize places to JSON in a `<script type="application/json" id="places-data">` tag.
  - A client `<script>` (module) that: imports `filterPlaces` from `../lib/filters.ts` and `leaflet`; reads the JSON; on any filter change recomputes the visible set, toggles card visibility (by `data-id`), updates the count, and updates map markers; wires the list/map toggle (lazy-inits the Leaflet map with OSM tiles on first switch, `L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' })`, fits bounds to visible markers, marker popups link to the place page). Import Leaflet CSS via `import 'leaflet/dist/leaflet.css'`.
  - Keep the script focused; if it exceeds ~150 lines, extract pure helpers into `site/lib/` (tested) and report the split.

- [ ] **Step 4: Rewrite `site/pages/places.astro`** — import `approvedPlaces`, `regions`, `allTags` from `../lib/data.ts`; render `<Base title="Места — Португалия">` with a page `h1` and `<PlacesExplorer places={approvedPlaces} regions={regions} tags={allTags} hrefBase={...} />`.

- [ ] **Step 5: Build and verify** — `npm run build`. Expected: build succeeds; `dist/places/index.html` contains all place names (server-rendered) and a `#map` element. Run `npm test` (still green). Manually confirm the built HTML includes `leaflet` assets. Note: if Astro complains about Leaflet CSS import location, import it inside the client script instead — record the exact change.

- [ ] **Step 6: Commit** — `git add site/ package.json package-lock.json && git commit -m "feat: add places catalog with filters and Leaflet map"`

---

### Task 6: Place detail pages

**Files:**
- Create: `site/pages/places/[id].astro`
- Create: `site/components/MiniMap.astro`

- [ ] **Step 1: Create `site/components/MiniMap.astro`** — props `{ lat: number, lon: number, name: string }`. A small non-interactive (or lightly interactive) Leaflet map centered on the point with a single marker; client script inits it. Fixed height ~260px, rounded corners, border.

- [ ] **Step 2: Create `site/pages/places/[id].astro`** — use `getStaticPaths()` to emit one page per approved place (`approvedPlaces.map((p) => ({ params: { id: p.id }, props: { place: p } }))`). Render `<Base title={place.name}>`:
  - Hero: photo (or `--type-*` tinted block) with `TypeBadge`.
  - `h1` name; region and meta row (drive minutes, visit hours, best season).
  - Description paragraph(s).
  - Tag pills — each links to `/places/?tag=<tag>` (the catalog reads the query param to pre-apply — add that read in PlacesExplorer's init if not already; if you add it, note it).
  - Action buttons: «Маршрут в Google Maps» → `https://www.google.com/maps/dir/?api=1&destination={lat},{lon}` (target=_blank, rel=noopener); «В избранное» (a button with a `data-fav-id={place.id}` hook — actual persistence lands in Stage 4, so it may be a no-op placeholder that toggles visual state via localStorage if trivial; if not trivial, render it disabled with a "скоро" title and report the decision).
  - `<MiniMap>`.
  - Photo attribution line when a photo exists: «Фото: {author}, {license}» linking to `sourceUrl`.

- [ ] **Step 3: Build and verify** — `npm run build`. Expected: `dist/places/praia-da-ursa/index.html` (and others) exist and contain the name, the Google Maps directions URL, and a mini-map element. `npm test` green.

- [ ] **Step 4: Commit** — `git add site/ && git commit -m "feat: add place detail pages with mini-map and directions"`

---

### Task 7: Collections page

**Files:**
- Create: `site/pages/collections.astro`
- Create: `site/pages/collections/[id].astro`

- [ ] **Step 1: Create `site/pages/collections.astro`** — import `collections` and `approvedPlaces`. Render a grid of collection cards: each shows title, description, place count, and up to 3 thumbnail covers (reuse the cover logic — a small inline snippet or a `CollectionCard.astro` if cleaner). Each links to `/collections/{id}/`.

- [ ] **Step 2: Create `site/pages/collections/[id].astro`** — `getStaticPaths()` over `collections`; props include the collection. Resolve places with `resolveCollection(collection, approvedPlaces)` and render the title, description, and a grid of `PlaceCard`s in collection order.

- [ ] **Step 3: Build and verify** — `npm run build`. Expected: `dist/collections/index.html` and `dist/collections/beaches-day-trip/index.html` exist and list the right places. `npm test` green.

- [ ] **Step 4: Commit** — `git add site/ && git commit -m "feat: add collections index and detail pages"`

---

### Task 8: Redesign home and events pages to match

**Files:**
- Modify: `site/pages/index.astro`
- Modify: `site/pages/events.astro`
- Create: `site/components/EventCard.astro`

- [ ] **Step 1: Create `site/components/EventCard.astro`** — props `{ event: Event }`. A card showing the event type badge (using `EVENT_TYPE_LABELS`), title, date range (single date if start==end), city + venue, price, and an external link «Подробнее» to `event.url`. Same visual language as `PlaceCard`.

- [ ] **Step 2: Rewrite `site/pages/index.astro`** (the «Выходные» home) using the new components: a hero line with the weekend dates; a «События на выходных» section rendering `EventCard`s (or an empty state «На эти выходные событий пока нет.»); a «Куда поехать» section rendering 3–6 `PlaceCard`s (seasonally reasonable — keep the simple `slice` for now, note weather integration is Stage 4); a «Подборки» strip linking to 2–3 collections. Reuse `nextWeekend`, `overlapsDay`, `approvedPlaces`, `upcomingEvents`, `collections`.

- [ ] **Step 3: Rewrite `site/pages/events.astro`** — page `h1`, and events grouped by month (or a simple sorted grid) of `EventCard`s, with an empty state. Keep it consistent with the catalog's spacing.

- [ ] **Step 4: Build and verify** — `npm run build`. Expected: all pages build; home shows weekend dates, place cards, and a collections strip; `npm test` green. Confirm no leftover Stage 1 bare `<ul>` list markup remains on these pages.

- [ ] **Step 5: Commit** — `git add site/ && git commit -m "feat: redesign home and events pages with cards"`

---

### Task 9: `generate-places` agent skill

**Files:**
- Create: `.claude/skills/generate-places/SKILL.md`
- Create: `docs/place-generation.md`

This task writes documentation/instructions, not code. No tests; verify by review.

- [ ] **Step 1: Create `.claude/skills/generate-places/SKILL.md`** with frontmatter (`name: generate-places`, `description:` covering "generate Portugal place candidates with Wikimedia photos into data/places/*.json"). Body instructs the agent to:
  - Read `schema/index.ts` for the current `Place` shape and `data/places/*.json` for existing ids (never duplicate an id).
  - Work through a category × region matrix focused on a 2–3h driving radius from Lisbon; target ~60–80 places total across runs.
  - For each place: use web search to confirm it exists and gather a 2–3 sentence Russian description, approximate coords, realistic `driveMinutesFromLisbon`, `visitDurationHours`, `bestSeason`, and 2–4 tags from a controlled vocabulary (list it: `закат`, `бесплатно`, `с детьми`, `купание`, `виды`, `история`, `вино`, `сёрфинг`, `природа`, `фото`, `ресторан`).
  - Fetch a freely-licensed photo from Wikimedia Commons (via the Commons API); store `photo` with `url`, `author`, `license`, `sourceUrl`. If no suitable free photo, omit `photo`.
  - Set `status: "candidate"` for everything it generates.
  - Write places grouped into the existing region files (append, don't overwrite) or new region files as needed.
  - MANDATORY before finishing: run `npm run validate` and `npm test`; fix any file the validator names; never weaken the schema. Do not commit — leave changes for the user to review.

- [ ] **Step 2: Create `docs/place-generation.md`** — a short human runbook: how to launch the skill in an interactive Claude Code session, how to review candidates (a suggested `data/places/` diff review flow), and how to promote `candidate` → `approved` (bulk edit). Mention that only `approved` places appear on the site.

- [ ] **Step 3: Self-check** — re-read both files: no contradictions with the real schema (photo fields exact: `url`/`author`/`license`/`sourceUrl`; place requires `collections` default handled by schema). Confirm the tag vocabulary matches what the UI/filters expect.

- [ ] **Step 4: Commit** — `git add .claude/ docs/place-generation.md && git commit -m "docs: add generate-places skill and runbook"`

---

### Task 10: Generate real place data (batch 1 — Lisbon radius & coast)

**Files:**
- Modify/Create: `data/places/*.json` (append candidates; may add region files)

This task exercises the Task 9 skill to produce real content so the UI looks full. The implementer has web search + fetch.

- [ ] **Step 1: Read** `.claude/skills/generate-places/SKILL.md`, `schema/index.ts`, and every existing `data/places/*.json` (collect existing ids).

- [ ] **Step 2: Generate ~30 new places** within ~2h of Lisbon: beaches (Costa da Caparica, Comporta, Ericeira area, Arrábida coves), hikes (Sintra trails, Serra da Arrábida, Cascais coast), castles/palaces (Pena, Regaleira, Mafra, Palmela), viewpoints, towns (Sesimbra, Ericeira, Setúbal). Real coords, honest drive times, Russian descriptions (2–3 sentences), controlled-vocabulary tags, Wikimedia photo where a free one exists. `status: "candidate"`. Do not duplicate existing ids.

- [ ] **Step 3: Validate** — `npm run validate && npm test`. Fix any named file. Expected: `All data files are valid.`

- [ ] **Step 4: Report counts** — how many places added per file, how many got photos. Do NOT set anything to `approved` (the user curates). Commit: `git add data/places/ && git commit -m "data: add ~30 candidate places within 2h of Lisbon"`

---

### Task 11: Generate real place data (batch 2 — wider radius)

**Files:**
- Modify/Create: `data/places/*.json`

- [ ] **Step 1: Read** the skill, schema, and all existing place files (including batch 1) to collect ids.

- [ ] **Step 2: Generate ~30 new places** in the 2–3h ring: Óbidos/Nazaré/Peniche (Oeste), Évora and Alentejo wine country, Coimbra, Tomar (Convento de Cristo), Aveiro, Serra da Estrela foothills, Alentejo coast (Comporta south, Melides). Same rules as batch 1. No duplicate ids. `status: "candidate"`.

- [ ] **Step 3: Validate** — `npm run validate && npm test`. Fix any named file.

- [ ] **Step 4: Report and commit** — `git add data/places/ && git commit -m "data: add ~30 candidate places in the 2-3h ring"`

---

### Task 12: Set canonical site URL to the custom domain

**Files:**
- Modify: `astro.config.mjs`

- [ ] **Step 1: Change `site`** from `'https://maxim4to.github.io'` to `'https://mi-crafts.com'` (the confirmed custom domain; `base: '/portugal-events'` stays). This fixes canonical URLs and sitemap/OG absolute URLs.

- [ ] **Step 2: Build** — `npm run build`. Expected: success; internal links still use `/portugal-events/...`.

- [ ] **Step 3: Commit** — `git add astro.config.mjs && git commit -m "chore: set canonical site URL to mi-crafts.com"`

---

## Self-review notes

- Spec coverage: catalog+map (Tasks 5), filters (3,5), detail+directions (6), collections (1,7), place generation with photos (9–11), design system (2,4), redesigned home/events (8). Routes as day-trip chaining are deferred beyond directions button (spec calls it a nice-to-have) — not in this plan; single-destination directions are covered.
- Type consistency: `filterPlaces`/`PlaceFilter`, `resolveCollection`, `TYPE_LABELS`/`EVENT_TYPE_LABELS`, `PhotoSchema`/`CollectionSchema`, exports `collections`/`regions`/`allTags` are used consistently across tasks.
- Data-before-UI ordering: schema (1) precedes data generation (10–11) and UI (4–8); collections.json created in Task 1 so Task 7 has data even before generation.
- Favorites persistence is intentionally deferred to Stage 4; Task 6 keeps it a minimal localStorage toggle or a disabled placeholder, explicitly flagged.
