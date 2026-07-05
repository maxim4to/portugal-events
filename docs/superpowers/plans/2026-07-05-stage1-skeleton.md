# Stage 1: Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Working static site on GitHub Pages showing hand-seeded places and events, with zod-validated JSON data in git.

**Architecture:** Single-package repo. Data lives in `data/*.json`, validated by zod schemas in `schema/`. Astro site (source in `site/`, configured via `srcDir`) bakes data in at build time. One GitHub Actions workflow validates, tests, builds and deploys to GitHub Pages on push to main.

**Tech Stack:** Astro 5, TypeScript, zod 3, vitest, tsx. No frameworks, no client JS in this stage.

**Spec:** `docs/superpowers/specs/2026-07-05-portugal-events-design.md`

**Conventions for all tasks:**
- Run commands from the repo root `/Users/m.ivanov/portugal-events`.
- Commit messages in English, imperative (`feat: ...`, `test: ...`, `chore: ...`).
- Never commit `node_modules/` or `dist/`.
- Data content (names, descriptions) is in Russian; code identifiers in English.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `astro.config.mjs`
- Create: `.gitignore`
- Create: `site/pages/index.astro`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "portugal-events",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "test": "vitest run",
    "validate": "tsx pipeline/validate.ts"
  },
  "dependencies": {
    "astro": "^5.0.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": ["site/**/*", "schema/**/*", "pipeline/**/*"],
  "compilerOptions": {
    "allowImportingTsExtensions": true,
    "noEmit": true
  }
}
```

- [ ] **Step 3: Create `astro.config.mjs`**

The site will be served at `https://maxim4to.github.io/portugal-events/`, so `base` is required — without it all asset URLs break on Pages.

```js
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://maxim4to.github.io',
  base: '/portugal-events',
  srcDir: './site',
});
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
dist/
.astro/
```

- [ ] **Step 5: Create placeholder page `site/pages/index.astro`**

```astro
---
---
<html lang="ru">
  <body>
    <h1>Португалия: места и события</h1>
  </body>
</html>
```

- [ ] **Step 6: Install and verify build**

Run: `npm install && npm run build`
Expected: build completes, `dist/index.html` exists. Verify with `ls dist/index.html`.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json astro.config.mjs .gitignore site/
git commit -m "chore: scaffold Astro project"
```

---

### Task 2: Zod schemas

**Files:**
- Create: `schema/index.ts`
- Test: `schema/index.test.ts`

- [ ] **Step 1: Write the failing tests `schema/index.test.ts`**

```ts
import { describe, expect, test } from 'vitest';
import { PlaceSchema, EventSchema, SourceSchema, CitySchema } from './index.ts';

const validPlace = {
  id: 'praia-da-ursa',
  name: 'Прайя-да-Урса',
  type: 'beach',
  region: 'Лиссабон и Синтра',
  coords: { lat: 38.7954, lon: -9.4826 },
  description: 'Дикий пляж у мыса Рока.',
  driveMinutesFromLisbon: 45,
  visitDurationHours: 3,
  bestSeason: 'май–октябрь',
  tags: ['закат', 'бесплатно'],
  links: [{ title: 'Как добраться', url: 'https://example.com' }],
  status: 'approved',
};

const validEvent = {
  id: 'sample-festival-2026',
  title: 'Пример фестиваля',
  type: 'festival',
  dateStart: '2026-07-10',
  dateEnd: '2026-07-12',
  city: 'Lisboa',
  venue: 'Passeio Marítimo de Algés',
  price: 'от 70 €',
  url: 'https://example.com',
  description: 'Тестовое событие.',
  sourceId: 'manual',
  dedupeHash: 'sample-festival|2026-07-10|lisboa',
};

describe('PlaceSchema', () => {
  test('accepts a valid place', () => {
    expect(PlaceSchema.safeParse(validPlace).success).toBe(true);
  });
  test('rejects a non-slug id', () => {
    expect(PlaceSchema.safeParse({ ...validPlace, id: 'Praia da Ursa' }).success).toBe(false);
  });
  test('rejects latitude out of range', () => {
    expect(
      PlaceSchema.safeParse({ ...validPlace, coords: { lat: 138, lon: -9 } }).success,
    ).toBe(false);
  });
  test('rejects unknown status', () => {
    expect(PlaceSchema.safeParse({ ...validPlace, status: 'draft' }).success).toBe(false);
  });
});

describe('EventSchema', () => {
  test('accepts a valid event', () => {
    expect(EventSchema.safeParse(validEvent).success).toBe(true);
  });
  test('rejects dateEnd before dateStart', () => {
    expect(
      EventSchema.safeParse({ ...validEvent, dateEnd: '2026-07-01' }).success,
    ).toBe(false);
  });
  test('rejects non-ISO date', () => {
    expect(
      EventSchema.safeParse({ ...validEvent, dateStart: '10.07.2026' }).success,
    ).toBe(false);
  });
});

describe('SourceSchema', () => {
  test('accepts a valid source', () => {
    const source = {
      id: 'agenda-lx',
      name: 'Agenda LX',
      type: 'website',
      url: 'https://www.agendalx.pt',
      hint: 'раздел «эта неделя»',
      enabled: true,
    };
    expect(SourceSchema.safeParse(source).success).toBe(true);
  });
});

describe('CitySchema', () => {
  test('accepts a valid city', () => {
    expect(CitySchema.safeParse({ name: 'Lisboa', lat: 38.7223, lon: -9.1393 }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./index.ts`.

- [ ] **Step 3: Write `schema/index.ts`**

```ts
import { z } from 'zod';

const slug = z.string().regex(/^[a-z0-9-]+$/, 'id must be a lowercase slug');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD');

export const PLACE_TYPES = [
  'beach',
  'hike',
  'castle',
  'lake',
  'viewpoint',
  'town',
  'nature',
  'other',
] as const;

export const PlaceSchema = z.object({
  id: slug,
  name: z.string().min(1),
  type: z.enum(PLACE_TYPES),
  region: z.string().min(1),
  coords: z.object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  }),
  description: z.string().min(1),
  driveMinutesFromLisbon: z.number().int().positive(),
  visitDurationHours: z.number().positive(),
  bestSeason: z.string().min(1),
  tags: z.array(z.string()),
  links: z.array(z.object({ title: z.string().min(1), url: z.string().url() })),
  status: z.enum(['candidate', 'approved']),
});
export type Place = z.infer<typeof PlaceSchema>;

export const EVENT_TYPES = [
  'concert',
  'festival',
  'exhibition',
  'market',
  'sport',
  'other',
] as const;

export const EventSchema = z
  .object({
    id: slug,
    title: z.string().min(1),
    type: z.enum(EVENT_TYPES),
    dateStart: isoDate,
    dateEnd: isoDate,
    city: z.string().min(1),
    venue: z.string().min(1),
    price: z.string(),
    url: z.string().url(),
    description: z.string(),
    sourceId: z.string().min(1),
    dedupeHash: z.string().min(1),
  })
  .refine((e) => e.dateEnd >= e.dateStart, {
    message: 'dateEnd must be on or after dateStart',
    path: ['dateEnd'],
  });
export type Event = z.infer<typeof EventSchema>;

export const SourceSchema = z.object({
  id: slug,
  name: z.string().min(1),
  type: z.enum(['telegram', 'website', 'rss']),
  url: z.string().url(),
  hint: z.string(),
  enabled: z.boolean(),
});
export type Source = z.infer<typeof SourceSchema>;

export const CitySchema = z.object({
  name: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});
export type City = z.infer<typeof CitySchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add schema/
git commit -m "feat: add zod schemas for places, events, sources, cities"
```

---

### Task 3: Validation script

**Files:**
- Create: `pipeline/validate.ts`
- Test: `pipeline/validate.test.ts`

- [ ] **Step 1: Write the failing tests `pipeline/validate.test.ts`**

```ts
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./validate.ts`.

- [ ] **Step 3: Write `pipeline/validate.ts`**

```ts
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { CitySchema, EventSchema, PlaceSchema, SourceSchema } from '../schema/index.ts';

export function collectErrors(dataDir: string): string[] {
  const errors: string[] = [];

  const readJson = (file: string): unknown | undefined => {
    try {
      return JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      errors.push(`${file}: invalid JSON (${(e as Error).message})`);
      return undefined;
    }
  };

  const check = <T>(file: string, schema: z.ZodType<T>): T | undefined => {
    if (!existsSync(file)) return undefined;
    const parsed = readJson(file);
    if (parsed === undefined) return undefined;
    const result = schema.safeParse(parsed);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push(`${file}: ${issue.path.join('.')}: ${issue.message}`);
      }
      return undefined;
    }
    return result.data;
  };

  const listJson = (dir: string): string[] =>
    existsSync(dir)
      ? readdirSync(dir, { withFileTypes: true })
          .filter((f) => f.isFile() && f.name.endsWith('.json'))
          .map((f) => join(dir, f.name))
      : [];

  const placeIds = new Map<string, string>();
  for (const file of listJson(join(dataDir, 'places'))) {
    const places = check(file, z.array(PlaceSchema));
    for (const place of places ?? []) {
      const seenIn = placeIds.get(place.id);
      if (seenIn) errors.push(`${file}: duplicate place id "${place.id}" (also in ${seenIn})`);
      else placeIds.set(place.id, file);
    }
  }

  for (const file of listJson(join(dataDir, 'events'))) check(file, z.array(EventSchema));
  for (const file of listJson(join(dataDir, 'events', 'archive'))) check(file, z.array(EventSchema));
  check(join(dataDir, 'sources.json'), z.array(SourceSchema));
  check(join(dataDir, 'geo', 'cities.json'), z.array(CitySchema));

  return errors;
}

const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (isMain) {
  const errors = collectErrors(join(process.cwd(), 'data'));
  if (errors.length > 0) {
    console.error(`Validation failed with ${errors.length} error(s):`);
    for (const e of errors) console.error(`  ${e}`);
    process.exit(1);
  }
  console.log('All data files are valid.');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Run the CLI against the (not yet existing) data dir**

Run: `npm run validate`
Expected: `All data files are valid.` (no `data/` dir yet — nothing to check, exit 0).

- [ ] **Step 6: Commit**

```bash
git add pipeline/
git commit -m "feat: add data validation script"
```

---

### Task 4: Seed data

**Files:**
- Create: `data/geo/cities.json`
- Create: `data/places/lisboa-sintra.json`
- Create: `data/places/oeste.json`
- Create: `data/places/setubal.json`
- Create: `data/places/alentejo.json`
- Create: `data/events/2026-07.json`
- Create: `data/sources.json`

Descriptions below are short seeds; they will be enriched in Stage 2. Coordinates are approximate but real — good enough for maps.

- [ ] **Step 1: Create `data/geo/cities.json`**

```json
[
  { "name": "Lisboa", "lat": 38.7223, "lon": -9.1393 },
  { "name": "Porto", "lat": 41.1579, "lon": -8.6291 },
  { "name": "Sintra", "lat": 38.8029, "lon": -9.3817 },
  { "name": "Cascais", "lat": 38.6979, "lon": -9.4215 },
  { "name": "Setúbal", "lat": 38.5244, "lon": -8.8882 },
  { "name": "Évora", "lat": 38.5714, "lon": -7.9135 },
  { "name": "Óbidos", "lat": 39.3606, "lon": -9.1575 },
  { "name": "Nazaré", "lat": 39.6012, "lon": -9.0700 },
  { "name": "Coimbra", "lat": 40.2033, "lon": -8.4103 },
  { "name": "Faro", "lat": 37.0194, "lon": -7.9322 }
]
```

- [ ] **Step 2: Create `data/places/lisboa-sintra.json`**

```json
[
  {
    "id": "praia-da-ursa",
    "name": "Прайя-да-Урса",
    "type": "beach",
    "region": "Лиссабон и Синтра",
    "coords": { "lat": 38.7954, "lon": -9.4826 },
    "description": "Дикий пляж со скалами-останцами рядом с мысом Рока. Спуск крутой, зато людей мало даже летом.",
    "driveMinutesFromLisbon": 45,
    "visitDurationHours": 3,
    "bestSeason": "май–октябрь",
    "tags": ["закат", "бесплатно", "дикая природа"],
    "links": [],
    "status": "approved"
  },
  {
    "id": "cabo-da-roca",
    "name": "Мыс Рока",
    "type": "viewpoint",
    "region": "Лиссабон и Синтра",
    "coords": { "lat": 38.7803, "lon": -9.4989 },
    "description": "Самая западная точка континентальной Европы. Маяк, обрывы, океан до горизонта.",
    "driveMinutesFromLisbon": 40,
    "visitDurationHours": 1,
    "bestSeason": "круглый год",
    "tags": ["закат", "бесплатно"],
    "links": [],
    "status": "approved"
  },
  {
    "id": "castelo-dos-mouros",
    "name": "Замок мавров",
    "type": "castle",
    "region": "Лиссабон и Синтра",
    "coords": { "lat": 38.7926, "lon": -9.3893 },
    "description": "Крепостная стена IX века на гребне гор Синтры с видами на океан и дворец Пена.",
    "driveMinutesFromLisbon": 35,
    "visitDurationHours": 2,
    "bestSeason": "круглый год",
    "tags": ["история", "виды"],
    "links": [{ "title": "Билеты", "url": "https://www.parquesdesintra.pt" }],
    "status": "approved"
  },
  {
    "id": "praia-do-guincho",
    "name": "Прайя-ду-Гинчу",
    "type": "beach",
    "region": "Лиссабон и Синтра",
    "coords": { "lat": 38.7330, "lon": -9.4730 },
    "description": "Широкий океанский пляж между Кашкайшем и Синтрой, столица виндсёрфинга. Ветрено почти всегда.",
    "driveMinutesFromLisbon": 35,
    "visitDurationHours": 4,
    "bestSeason": "июнь–сентябрь",
    "tags": ["сёрфинг", "бесплатно"],
    "links": [],
    "status": "approved"
  },
  {
    "id": "azenhas-do-mar",
    "name": "Азеньяш-ду-Мар",
    "type": "town",
    "region": "Лиссабон и Синтра",
    "coords": { "lat": 38.8376, "lon": -9.4610 },
    "description": "Белая деревня, стекающая по скале к океану. Смотровая, природный бассейн и рыбный ресторан у воды.",
    "driveMinutesFromLisbon": 45,
    "visitDurationHours": 2,
    "bestSeason": "круглый год",
    "tags": ["фото", "ресторан"],
    "links": [],
    "status": "approved"
  }
]
```

- [ ] **Step 3: Create `data/places/oeste.json`**

```json
[
  {
    "id": "obidos",
    "name": "Обидуш",
    "type": "town",
    "region": "Оэште",
    "coords": { "lat": 39.3606, "lon": -9.1575 },
    "description": "Средневековый городок внутри крепостных стен, по которым можно пройти по кругу. Джинжинья в шоколадной рюмке обязательна.",
    "driveMinutesFromLisbon": 65,
    "visitDurationHours": 3,
    "bestSeason": "круглый год",
    "tags": ["история", "с детьми"],
    "links": [],
    "status": "approved"
  },
  {
    "id": "nazare-farol",
    "name": "Назаре: маяк и гигантские волны",
    "type": "viewpoint",
    "region": "Оэште",
    "coords": { "lat": 39.6045, "lon": -9.0852 },
    "description": "Форт Сан-Мигел и смотровая над каньоном Назаре. Зимой здесь катаются на волнах до 30 метров.",
    "driveMinutesFromLisbon": 90,
    "visitDurationHours": 3,
    "bestSeason": "октябрь–март (большие волны)",
    "tags": ["сёрфинг", "виды"],
    "links": [],
    "status": "approved"
  }
]
```

- [ ] **Step 4: Create `data/places/setubal.json`**

```json
[
  {
    "id": "praia-dos-galapinhos",
    "name": "Прайя-душ-Галапиньюш",
    "type": "beach",
    "region": "Сетубал и Аррабида",
    "coords": { "lat": 38.4870, "lon": -8.9930 },
    "description": "Бирюзовая вода и сосны парка Аррабида. Летом доступ на машине ограничен — ехать рано утром или на автобусе от Сетубала.",
    "driveMinutesFromLisbon": 50,
    "visitDurationHours": 4,
    "bestSeason": "июнь–сентябрь",
    "tags": ["купание", "природа"],
    "links": [],
    "status": "approved"
  },
  {
    "id": "cabo-espichel",
    "name": "Мыс Эшпишел",
    "type": "viewpoint",
    "region": "Сетубал и Аррабида",
    "coords": { "lat": 38.4147, "lon": -9.2158 },
    "description": "Пустынный мыс с маяком, заброшенным святилищем и следами динозавров на скалах.",
    "driveMinutesFromLisbon": 50,
    "visitDurationHours": 2,
    "bestSeason": "круглый год",
    "tags": ["закат", "бесплатно", "динозавры"],
    "links": [],
    "status": "approved"
  }
]
```

- [ ] **Step 5: Create `data/places/alentejo.json`**

```json
[
  {
    "id": "evora",
    "name": "Эвора",
    "type": "town",
    "region": "Алентежу",
    "coords": { "lat": 38.5714, "lon": -7.9135 },
    "description": "Римский храм, капелла из костей и целый город-музей под охраной ЮНЕСКО. Хорошо совмещается с винодельнями по дороге.",
    "driveMinutesFromLisbon": 90,
    "visitDurationHours": 5,
    "bestSeason": "сентябрь–июнь (летом жара)",
    "tags": ["история", "вино"],
    "links": [],
    "status": "approved"
  }
]
```

- [ ] **Step 6: Create `data/events/2026-07.json`**

One clearly-marked sample event so the UI has something to render; it will be replaced by the real pipeline in Stage 3.

```json
[
  {
    "id": "sample-open-air-lisboa",
    "title": "Пример: кино под открытым небом",
    "type": "other",
    "dateStart": "2026-07-11",
    "dateEnd": "2026-07-11",
    "city": "Lisboa",
    "venue": "Jardim da Estrela",
    "price": "бесплатно",
    "url": "https://example.com",
    "description": "Тестовое событие для проверки вёрстки. Удалить, когда заработает пайплайн.",
    "sourceId": "manual",
    "dedupeHash": "пример-кино|2026-07-11|lisboa"
  }
]
```

- [ ] **Step 7: Create `data/sources.json`**

```json
[
  {
    "id": "agenda-lx",
    "name": "Agenda LX (афиша Лиссабона)",
    "type": "website",
    "url": "https://www.agendalx.pt",
    "hint": "события на главной и в разделах по датам",
    "enabled": false
  }
]
```

- [ ] **Step 8: Validate and run tests**

Run: `npm run validate && npm test`
Expected: `All data files are valid.` and all tests PASS. If validation fails, fix the data file it names — do not weaken the schema.

- [ ] **Step 9: Commit**

```bash
git add data/
git commit -m "feat: seed places, cities, sample event and first source"
```

---

### Task 5: Date helpers

**Files:**
- Create: `site/lib/dates.ts`
- Test: `site/lib/dates.test.ts`

- [ ] **Step 1: Write the failing tests `site/lib/dates.test.ts`**

```ts
import { describe, expect, test } from 'vitest';
import { nextWeekend, overlapsDay } from './dates.ts';

describe('nextWeekend', () => {
  test('mid-week returns the upcoming weekend', () => {
    expect(nextWeekend(new Date('2026-07-01T12:00:00Z'))).toEqual({
      sat: '2026-07-04',
      sun: '2026-07-05',
    });
  });
  test('on Saturday returns the current weekend', () => {
    expect(nextWeekend(new Date('2026-07-04T12:00:00Z'))).toEqual({
      sat: '2026-07-04',
      sun: '2026-07-05',
    });
  });
  test('on Sunday still returns the current weekend', () => {
    expect(nextWeekend(new Date('2026-07-05T12:00:00Z'))).toEqual({
      sat: '2026-07-04',
      sun: '2026-07-05',
    });
  });
});

describe('overlapsDay', () => {
  const event = { dateStart: '2026-07-10', dateEnd: '2026-07-12' };
  test('true inside the range', () => {
    expect(overlapsDay(event, '2026-07-11')).toBe(true);
  });
  test('true on boundaries', () => {
    expect(overlapsDay(event, '2026-07-10')).toBe(true);
    expect(overlapsDay(event, '2026-07-12')).toBe(true);
  });
  test('false outside the range', () => {
    expect(overlapsDay(event, '2026-07-13')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./dates.ts`.

- [ ] **Step 3: Write `site/lib/dates.ts`**

```ts
function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * The weekend containing `from` if it is Sat/Sun, otherwise the upcoming one.
 * Uses UTC day boundaries — fine for Portugal (UTC/UTC+1).
 */
export function nextWeekend(from: Date): { sat: string; sun: string } {
  const day = from.getUTCDay();
  const offsetToSat = day === 0 ? -1 : 6 - day;
  const sat = new Date(from);
  sat.setUTCDate(from.getUTCDate() + offsetToSat);
  const sun = new Date(sat);
  sun.setUTCDate(sat.getUTCDate() + 1);
  return { sat: toISODate(sat), sun: toISODate(sun) };
}

export function overlapsDay(
  event: { dateStart: string; dateEnd: string },
  dayISO: string,
): boolean {
  return event.dateStart <= dayISO && dayISO <= event.dateEnd;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add site/lib/
git commit -m "feat: add weekend date helpers"
```

---

### Task 6: Data loading and pages

**Files:**
- Create: `site/lib/data.ts`
- Create: `site/layouts/Base.astro`
- Modify: `site/pages/index.astro` (replace placeholder entirely)
- Create: `site/pages/places.astro`
- Create: `site/pages/events.astro`

- [ ] **Step 1: Create `site/lib/data.ts`**

Build-time loading: every JSON file is parsed through zod again, so a bad file fails the build even if someone skipped `npm run validate`.

```ts
import { z } from 'zod';
import { EventSchema, PlaceSchema, type Event, type Place } from '../../schema/index.ts';

const placeFiles = import.meta.glob('../../data/places/*.json', {
  eager: true,
  import: 'default',
});
export const allPlaces: Place[] = Object.values(placeFiles).flatMap((v) =>
  z.array(PlaceSchema).parse(v),
);
export const approvedPlaces: Place[] = allPlaces.filter((p) => p.status === 'approved');

const eventFiles = import.meta.glob('../../data/events/*.json', {
  eager: true,
  import: 'default',
});
const todayISO = new Date().toISOString().slice(0, 10);
export const upcomingEvents: Event[] = Object.values(eventFiles)
  .flatMap((v) => z.array(EventSchema).parse(v))
  .filter((e) => e.dateEnd >= todayISO)
  .sort((a, b) => a.dateStart.localeCompare(b.dateStart));
```

- [ ] **Step 2: Create `site/layouts/Base.astro`**

`href()` strips the trailing slash from `BASE_URL` so links work regardless of Astro's trailing-slash normalization.

```astro
---
const { title } = Astro.props;
const href = (p: string) => import.meta.env.BASE_URL.replace(/\/$/, '') + p;
---
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 720px; margin: 0 auto; padding: 1rem; line-height: 1.6; }
      nav { display: flex; gap: 1rem; margin-bottom: 1.5rem; }
      li { margin-bottom: 0.5rem; }
    </style>
  </head>
  <body>
    <nav>
      <a href={href('/')}>Выходные</a>
      <a href={href('/places/')}>Места</a>
      <a href={href('/events/')}>Афиша</a>
    </nav>
    <main><slot /></main>
  </body>
</html>
```

- [ ] **Step 3: Replace `site/pages/index.astro`**

```astro
---
import Base from '../layouts/Base.astro';
import { approvedPlaces, upcomingEvents } from '../lib/data.ts';
import { nextWeekend, overlapsDay } from '../lib/dates.ts';

const { sat, sun } = nextWeekend(new Date());
const weekendEvents = upcomingEvents.filter(
  (e) => overlapsDay(e, sat) || overlapsDay(e, sun),
);
const ideas = approvedPlaces.slice(0, 4);
---
<Base title="Выходные в Португалии">
  <h1>Выходные {sat} — {sun}</h1>

  <h2>События</h2>
  {weekendEvents.length === 0 ? (
    <p>На эти выходные событий пока нет.</p>
  ) : (
    <ul>
      {weekendEvents.map((e) => (
        <li>
          <a href={e.url}>{e.title}</a> — {e.city}, {e.venue}
          {e.dateStart !== e.dateEnd ? ` (${e.dateStart} – ${e.dateEnd})` : ''}, {e.price}
        </li>
      ))}
    </ul>
  )}

  <h2>Куда поехать</h2>
  <ul>
    {ideas.map((p) => (
      <li>
        <strong>{p.name}</strong> ({p.region}) — {p.driveMinutesFromLisbon} мин на машине.
        {p.description}
      </li>
    ))}
  </ul>
</Base>
```

- [ ] **Step 4: Create `site/pages/places.astro`**

```astro
---
import Base from '../layouts/Base.astro';
import { approvedPlaces } from '../lib/data.ts';
import type { Place } from '../../schema/index.ts';

const byRegion = new Map<string, Place[]>();
for (const p of approvedPlaces) {
  const list = byRegion.get(p.region) ?? [];
  list.push(p);
  byRegion.set(p.region, list);
}
---
<Base title="Места — Португалия">
  <h1>Места</h1>
  {[...byRegion.entries()].map(([region, places]) => (
    <section>
      <h2>{region}</h2>
      <ul>
        {places.map((p) => (
          <li>
            <strong>{p.name}</strong> — {p.driveMinutesFromLisbon} мин, ~{p.visitDurationHours} ч на месте.
            {p.description} <em>Сезон: {p.bestSeason}.</em>
          </li>
        ))}
      </ul>
    </section>
  ))}
</Base>
```

- [ ] **Step 5: Create `site/pages/events.astro`**

```astro
---
import Base from '../layouts/Base.astro';
import { upcomingEvents } from '../lib/data.ts';
---
<Base title="Афиша — Португалия">
  <h1>Афиша</h1>
  {upcomingEvents.length === 0 ? (
    <p>Будущих событий нет.</p>
  ) : (
    <ul>
      {upcomingEvents.map((e) => (
        <li>
          {e.dateStart}{e.dateEnd !== e.dateStart ? ` – ${e.dateEnd}` : ''}:
          <a href={e.url}>{e.title}</a> — {e.city}, {e.venue}, {e.price}
        </li>
      ))}
    </ul>
  )}
</Base>
```

- [ ] **Step 6: Build and inspect**

Run: `npm run build`
Expected: build succeeds; `dist/index.html`, `dist/places/index.html`, `dist/events/index.html` exist.
Run: `grep -o 'Обидуш' dist/places/index.html | head -1`
Expected: `Обидуш` (data made it into the HTML).

- [ ] **Step 7: Commit**

```bash
git add site/
git commit -m "feat: add data loading, layout and list pages"
```

---

### Task 7: Deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create `.github/workflows/deploy.yml`**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run validate
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Commit and push**

```bash
git add .github/
git commit -m "ci: deploy to GitHub Pages on push to main"
git push
```

- [ ] **Step 3: Verify the workflow**

Run: `gh run watch --repo maxim4to/portugal-events --exit-status` (or `gh run list --repo maxim4to/portugal-events --limit 1`)
Expected: the `build` job succeeds. The `deploy` job FAILS until Pages is enabled — that is expected on first run.

**Manual step for the user:** in the repo settings → Pages → Source: **GitHub Actions**. Then re-run the workflow (`gh run rerun <id>` or push again). Site appears at `https://maxim4to.github.io/portugal-events/`.
