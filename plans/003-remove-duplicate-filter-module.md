# Plan 003: Remove the dead duplicate filter module `site/lib/filters.ts`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 4b0f531..HEAD -- site/lib/filters.ts site/lib/filters.test.ts site/lib/placeMatch.ts site/lib/placeMatch.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (order-independent with 002; both touch `filters.test.ts` —
  if 002 already landed, deleting the file here is still fine)
- **Category**: tech-debt
- **Planned at**: commit `4b0f531`, 2026-07-05

## Why this matters

The repo contains two semantically equivalent place-filter predicates:
`filterPlaces` in `site/lib/filters.ts` and `matchesFilter` in `site/lib/placeMatch.ts`.
Only `matchesFilter` is used by the site (in `PlacesExplorer.astro`'s client script).
`filterPlaces` is imported **nowhere except its own test file** — verified by grep at
the planned-at commit. Two copies of the same rules mean any future filter change
(e.g. new filter field, case-sensitivity tweak) must be made twice or the copies
silently diverge. Deleting the dead copy removes that trap at zero functional cost.

## Current state

- `site/lib/filters.ts` (23 lines) — exports `PlaceFilter` and `filterPlaces(places, f)`;
  filters by types/regions/tags/maxDriveMinutes/query/freeWithResidency over full
  `Place` objects.
- `site/lib/filters.test.ts` (44 lines) — the only importer of `filters.ts`.
- `site/lib/placeMatch.ts` (42 lines) — exports `matchesFilter(place, state)` over the
  `PlaceCardData` projection (built from `data-*` attributes); this is the live
  implementation, used by `site/components/PlacesExplorer.astro:159` (script import)
  and unit-tested in `site/lib/placeMatch.test.ts` (83 lines).
- Grep evidence at `4b0f531`: `grep -rn "filterPlaces\|lib/filters" site pipeline
  --include='*.astro' --include='*.ts' | grep -v test` matches only the definition line
  in `filters.ts` itself.
- Behavioral differences worth knowing before deciding what test coverage to preserve:
  - `filterPlaces` accepts multiple `regions: string[]`; `matchesFilter` accepts a
    single `region: string`. The UI only offers a single-region select.
  - `filterPlaces` treats `maxDriveMinutes` as optional; `matchesFilter` requires
    `maxDrive` (the UI slider always has a value).
  - Everything else (types, tags-any-of, query over name+region lowercased,
    freeWithResidency) is equivalent, and `placeMatch.test.ts` already covers those
    cases for `matchesFilter`.

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|---------------------|---------------------|
| Tests     | `npm test`          | all pass, exit 0    |
| Build     | `npm run build`     | exit 0              |
| Typecheck | `npx tsc --noEmit`  | exit 0 (only if plan 002 already landed; otherwise skip) |

## Scope

**In scope**:
- `site/lib/filters.ts` (delete)
- `site/lib/filters.test.ts` (delete)
- `site/lib/placeMatch.test.ts` (optionally extend — see Step 2)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `site/lib/placeMatch.ts` — do not "consolidate" or rename; the live implementation
  and its call sites stay as they are.
- `site/components/PlacesExplorer.astro` — no changes needed; it never imported
  `filters.ts`.
- `site/lib/collections.ts` / `collections.test.ts` — unrelated despite the similar name.

## Git workflow

- Branch: `advisor/003-remove-dead-filters`
- Commit message style: repo prefixes `feat|fix|data|chore|refactor|docs`. Use:
  `refactor: remove unused duplicate filterPlaces module`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Re-verify the module is dead, then delete it

Run: `grep -rn "filterPlaces\|lib/filters" site pipeline schema --include='*.astro' --include='*.ts' | grep -v 'filters.test\|filters.ts:'`
Expected: no output. (If anything imports it now, STOP.)

Delete `site/lib/filters.ts` and `site/lib/filters.test.ts`.

**Verify**: `npm test` → all remaining suites pass; `npm run build` → exit 0.

### Step 2: Preserve any unique test intent in placeMatch.test.ts

Read the deleted `filters.test.ts` cases (from git: `git show 4b0f531:site/lib/filters.test.ts`).
For any behavior it tested that `site/lib/placeMatch.test.ts` does not already cover
for `matchesFilter` (check: query matching against region, freeWithResidency
filtering, tag any-of semantics), add an equivalent case to
`site/lib/placeMatch.test.ts`, modeled on its existing test style (plain vitest
`describe`/`test`, fixture factory at top of file). If everything is already covered,
add nothing and note that in the commit message.

**Verify**: `npm test` → all pass, including any newly added cases.

## Test plan

Covered by Step 2: `placeMatch.test.ts` remains the single test home for filter
semantics. Final check: `npm run validate && npm test && npm run build` → all exit 0.

## Done criteria

- [ ] `site/lib/filters.ts` and `site/lib/filters.test.ts` no longer exist
- [ ] `grep -rn "filterPlaces" site pipeline schema` returns no matches
- [ ] `npm test` exits 0
- [ ] `npm run build` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The Step 1 grep finds a real importer of `filters.ts` outside its test — the module
  is no longer dead and this plan's premise is wrong.
- Any documentation file (`docs/*.md`, `.claude/skills/**`) instructs agents to use
  `filterPlaces` (check: `grep -rn "filterPlaces" docs .claude`) — report instead of
  editing docs, which are out of scope.

## Maintenance notes

- `matchesFilter`/`placeMatch.ts` is now the single filter implementation. The
  `PlaceCardData` projection it consumes is built from `data-*` attributes in
  `PlacesExplorer.astro:40-47` — a new filterable field must be added in three places
  (schema/data attribute, `PlaceCardData`, `matchesFilter`) and tested in
  `placeMatch.test.ts`.
