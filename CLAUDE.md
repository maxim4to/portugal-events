# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A personal Astro site for planning car trips around Portugal from Lisbon: a catalog of
static **places** (beaches, hikes, castles, museums, ...) and a dynamic **events**
listing ("afisha"), both stored as JSON in git — there is no server or database. Design
doc: [docs/superpowers/specs/2026-07-05-portugal-events-design.md](docs/superpowers/specs/2026-07-05-portugal-events-design.md)
(in Russian).

## Commands

```bash
npm run dev        # Astro dev server
npm run build      # production build to dist/
npm run preview    # serve the production build
npm run validate   # zod-validate everything under data/ (pipeline/validate.ts)
npm test           # vitest run (all *.test.ts)
npx vitest run site/lib/dates.test.ts   # single test file
```

CI (`.github/workflows/deploy.yml`) runs `validate` → `test` → `build` on every push to
`main` and deploys `dist/` to GitHub Pages. A red `validate` or `test` blocks the deploy,
so bad data never reaches the site.

## Architecture

**Data is the backend.** Everything under `data/` is the database; `schema/index.ts`
(zod) is the single source of truth for shape — pipeline checks and the site build both
parse through it, and invalid JSON fails both. Never loosen the schema to make bad data
pass; fix the data.

- `data/places/*.json` — one file per region, array of `Place`. Every place in
  these files is rendered on the site — there is no draft/approval state, so only
  add places that are real and correct.
- `data/events/<YYYY-MM>.json` — one file per month, array of `Event`. Past events move
  to `data/events/archive/` (not shown on the site, kept for history).
- `data/sources.json` / `data/geo/cities.json` — event-source registry and a city →
  coordinates lookup used to place events on the map.

`site/lib/data.ts` uses `import.meta.glob(..., { eager: true })` to slurp every JSON file
under `data/` at build time, parses it through the zod schemas, and exports plain arrays
(`allPlaces`, `upcomingEvents`, `regions`, `allTags`).
Pages and components consume these exports directly — there's no runtime data fetching
for site content.

**Content pipelines are agent skills, not app code.** New places and events aren't
produced by scripts you run — they're produced by Claude Code sessions following
`.claude/skills/generate-places/SKILL.md` and `.claude/skills/ingest-events/SKILL.md`
(usage notes in [docs/place-generation.md](docs/place-generation.md) and
[docs/event-ingestion.md](docs/event-ingestion.md)). `generate-places` writes
places with web-sourced descriptions and Wikimedia Commons photos (only
free-licensed, `upload.wikimedia.org` URLs), which appear on the site as soon as
they land in `data/`. `ingest-events` reads `sources.json`, gathers events, dedupes,
and must pass `npm run validate && npm test` before committing.

**Frontend is Astro with vanilla-TS islands, no UI framework.** Pages are `.astro`
files; interactivity is plain `<script>` blocks operating on `data-*` attributes (see
`PlacesExplorer.astro` for the filter/map pattern, `PhotoGallery.astro` for a
no-dependency touch/trackpad-swipe carousel). Filtering logic lives in
`site/lib/placeMatch.ts`/`filters.ts` and is unit-tested against fixtures rather than
tested through the DOM.

**"Visited" and "favorites" are per-user state behind Google sign-in.** Auth is
Firebase Authentication (Google provider); both features store data in Firebase Realtime
Database under `users/<uid>/visited/<placeId>` and `users/<uid>/favorites/<placeId>`.
Shared foundation: `site/lib/firebase.ts` (lazy app/db singleton), `site/lib/auth.ts`
(sign-in/out + `onAuthChange`), and `site/lib/userData.ts` (per-user boolean sets that
re-point at the current uid on every auth change). `site/lib/visited.ts` and
`site/lib/favorites.ts` are thin wrappers; `VisitedController`/`FavoriteController` reflect
the sets onto buttons/cards and prompt Google sign-in on a click while signed out (the
toggle replays after login). Signed-out visitors browse freely but can't mark anything;
the catalog visited/favorites filters appear only while signed in. With a placeholder
Firebase config every module is inert (no network calls, empty results) so the rest of the
site works unaffected — preserve that degrade-gracefully behavior when touching it. The
catalog sorts visited places below a divider, but only off a snapshot frozen on load
(`data-order-visited`), never live toggles, so marking a place doesn't reshuffle the list
mid-session. Firebase console setup (enable Google, authorized domains, DB rules) is in
[docs/auth-setup.md](docs/auth-setup.md); the security rules live in `database.rules.json`.

`astro.config.mjs` sets `base: '/portugal-events'` — internal links must go through
`hrefBase`/`Astro.url` plumbing already used in components, not hardcoded absolute paths.

## Conventions

- Commit prefixes used in history: `feat`, `fix`, `data`, `chore`, `refactor`, `docs`
  (e.g. `data: add museums in Alentejo`, `feat: support trackpad swipe on gallery`).
- Tags on places are a closed vocabulary (see `place-generation.md`): `закат, бесплатно,
  с детьми, купание, виды, история, вино, сёрфинг, природа, фото, ресторан`. Don't
  invent new ones ad hoc.
