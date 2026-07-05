# Plan 002: Make `tsc --noEmit` pass and add a typecheck gate to scripts + CI

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 4b0f531..HEAD -- tsconfig.json package.json site/lib/collections.test.ts site/lib/filters.test.ts site/env.d.ts .github/workflows/deploy.yml`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `4b0f531`, 2026-07-05

## Why this matters

The repo has no typecheck command anywhere — not in `package.json`, not in CI — and the
codebase does not currently pass a baseline `npx tsc --noEmit` (5 errors). Type errors in
test fixtures are silently tolerated because vitest doesn't check types, and
`import.meta.glob` in `site/lib/data.ts` has no type declaration because the project
lacks an `env.d.ts` with Astro's client types. This means a schema refactor can leave
tests type-unsound with no signal until something breaks at runtime. The fix is small:
one triple-slash reference file, two-line fixture fixes, a `typecheck` script, and a CI
step.

## Current state

- `tsconfig.json` — extends Astro's strict config, includes `site/**/*`, `schema/**/*`,
  `pipeline/**/*`; `noEmit: true`. No `env.d.ts` exists anywhere in the repo, so
  `import.meta.glob` (a Vite/Astro extension) is untyped.

- Running `npx tsc --noEmit` at commit `4b0f531` produces exactly these errors:
  1. `site/lib/data.ts(11,32)`, `(20,32)`, `(30,37)`: `Property 'glob' does not exist on
     type 'ImportMeta'` — fixed by adding Astro client types.
  2. `site/lib/collections.test.ts(5,35)`: `Property 'photos' is missing` — the `Place`
     fixture factory omits `photos`, which the zod-inferred `Place` type requires
     (`schema/index.ts:46` — `photos: z.array(PhotoSchema).default([])` makes it
     required on the *output* type).
  3. `site/lib/filters.test.ts(5,48)`: same root cause via the spread of
     `Partial<Place>` — `photos` can end up `undefined`.

- `site/lib/collections.test.ts:5-9` fixture as it exists today:

  ```ts
  const p = (id: string): Place => ({
    id, name: id, type: 'beach', region: 'r', coords: { lat: 38, lon: -9 },
    description: 'd', driveMinutesFromLisbon: 40, visitDurationHours: 2,
    bestSeason: 'лето', tags: [], links: [], collections: [], status: 'approved',
  });
  ```

- `site/lib/filters.test.ts:5-12` fixture as it exists today:

  ```ts
  const make = (over: Partial<Place>): Place => ({
    id: over.id ?? 'x', name: over.name ?? 'Место', type: over.type ?? 'beach',
    region: over.region ?? 'Лиссабон и Синтра',
    coords: { lat: 38, lon: -9 }, description: 'd',
    driveMinutesFromLisbon: over.driveMinutesFromLisbon ?? 45,
    visitDurationHours: 2, bestSeason: 'лето', tags: over.tags ?? [], links: [],
    collections: [], status: 'approved', ...over,
  });
  ```

- `package.json:5-11` scripts: `dev`, `build`, `preview`, `test`, `validate` — no
  `typecheck`.

- `.github/workflows/deploy.yml` build job steps (lines 22-27): `npm ci` →
  `npm run validate` → `npm test` → `npm run build`.

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|---------------------|---------------------|
| Typecheck | `npx tsc --noEmit`  | exit 0, no output   |
| Tests     | `npm test`          | all pass, exit 0    |
| Build     | `npm run build`     | exit 0              |

## Scope

**In scope** (the only files you should modify/create):
- `site/env.d.ts` (create)
- `site/lib/collections.test.ts` (fixture only)
- `site/lib/filters.test.ts` (fixture only)
- `package.json` (add one script)
- `.github/workflows/deploy.yml` (add one step)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):
- `schema/index.ts` — do not loosen the schema (e.g. making `photos` optional) to make
  fixtures pass; the repo rule is "never loosen the schema to make bad data pass".
- `tsconfig.json` — no compiler-option changes should be needed; if they seem needed,
  that's a STOP condition.
- Do not add the `@astrojs/check` dependency or an `astro check` script — plain `tsc`
  is sufficient here and adds no dependency.
- `site/lib/filters.ts` itself — plan 003 deletes it; only fix the fixture types here
  so the gate passes regardless of plan order.

## Git workflow

- Branch: `advisor/002-typecheck-gate`
- Commit message style: repo prefixes `feat|fix|data|chore|refactor|docs`. Use:
  `chore: add tsc typecheck gate and fix fixture types`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add Astro client types

Create `site/env.d.ts` with exactly:

```ts
/// <reference types="astro/client" />
```

(`tsconfig.json` includes `site/**/*`, so it is picked up automatically.)

**Verify**: `npx tsc --noEmit 2>&1 | grep data.ts` → no output (the three
`import.meta.glob` errors are gone; fixture errors may remain until Step 2).

### Step 2: Fix the two test fixtures

In `site/lib/collections.test.ts`, add `photos: [],` to the object returned by `p(...)`
(e.g. after `tags: [], links: [],`).

In `site/lib/filters.test.ts`, ensure `photos` is always a concrete array even after the
spread: add `photos: [],` before `...over`, and change the trailing spread so `photos`
can't be reintroduced as `undefined` — the simplest correct shape is:

```ts
const make = (over: Partial<Place>): Place => ({
  id: over.id ?? 'x', name: over.name ?? 'Место', type: over.type ?? 'beach',
  region: over.region ?? 'Лиссабон и Синтра',
  coords: { lat: 38, lon: -9 }, description: 'd',
  driveMinutesFromLisbon: over.driveMinutesFromLisbon ?? 45,
  visitDurationHours: 2, bestSeason: 'лето', tags: over.tags ?? [], links: [],
  collections: [], status: 'approved', ...over, photos: over.photos ?? [],
});
```

**Verify**: `npx tsc --noEmit` → exit 0, no output. Then `npm test` → all pass.

### Step 3: Add the script and CI step

In `package.json` scripts, add: `"typecheck": "tsc --noEmit"`.

In `.github/workflows/deploy.yml`, in the `build` job, insert `- run: npm run typecheck`
between the `npm run validate` and `npm test` steps.

**Verify**: `npm run typecheck` → exit 0. And
`grep -n "npm run typecheck" .github/workflows/deploy.yml` → one match, on a line
between the validate and test steps.

## Test plan

No new tests — this plan makes the type gate real. Full check:
`npm run validate && npm run typecheck && npm test && npm run build` → all exit 0.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm test` exits 0 (no behavior change in tests)
- [ ] `package.json` has a `typecheck` script; CI runs it
- [ ] `git status` shows only in-scope files modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `npx tsc --noEmit` reports errors OTHER than the five listed in "Current state" —
  the codebase drifted and the fix set is different.
- Making the errors go away seems to require editing `schema/index.ts` or
  `tsconfig.json`.
- `npm test` fails after the fixture change (fixtures should be type-only changes).

## Maintenance notes

- Any future `.astro`-file type errors are NOT caught by `tsc` (it only checks `.ts`).
  If that coverage is ever wanted, add `@astrojs/check` + `astro check` as a follow-up;
  deliberately deferred to keep the dependency set lean.
- New test fixtures for `Place` must include `photos: []` — the zod `.default([])`
  makes the field required on the parsed/output type.
