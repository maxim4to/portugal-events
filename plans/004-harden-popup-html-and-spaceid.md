# Plan 004: Escape the Leaflet popup HTML and validate the visited-space id

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 4b0f531..HEAD -- site/components/PlacesExplorer.astro site/lib/visited.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `4b0f531`, 2026-07-05

## Why this matters

Two small defense-in-depth gaps, both one-function fixes:

1. **Map popup HTML injection.** `PlacesExplorer.astro` builds Leaflet marker popups by
   string-interpolating the place `name` into HTML. Leaflet's `bindPopup(string)`
   renders raw HTML. Place data in this repo is *not* hand-written — it is produced by
   web-research agent sessions (`generate-places` skill) that copy names/descriptions
   from arbitrary web pages. A scraped name containing markup would execute in every
   visitor's browser when the marker popup opens. Building the popup as a DOM node with
   `textContent` closes the sink regardless of data provenance.

2. **Unvalidated spaceId in Firebase paths.** The shared "visited" feature takes a
   `spaceId` from the URL (`?space=`/`#space=`) with only `.trim()` and embeds it into a
   Firebase Realtime Database path (`spaces/<spaceId>/visited/...`). A crafted value
   containing `/` re-shapes the path the client reads/writes. Server-side rules are the
   real boundary, but the client should refuse malformed ids outright — the legitimate
   ids are short URL-safe tokens.

Additionally — **not fixable in code, report to the operator**: per project notes, the
Firebase RTDB rules may still be in wide-open test mode; scoped rules
(`spaces/$space` read+write only) must be applied in the Firebase console. This plan
cannot verify that; flag it in your completion report.

## Current state

- `site/components/PlacesExplorer.astro:265-277` — `refreshMarkers()` in the client
  `<script>`; the injection point:

  ```ts
  L.marker(latlng, { icon: pinIcon, title: p.name })
    .bindPopup(`<a href="${hrefBase}/places/${p.id}/">${p.name}</a>`)
    .addTo(markerLayer);
  ```

  `p.id` is safe (zod slug: `/^[a-z0-9-]+$/`, `schema/index.ts:3`); `p.name` is an
  arbitrary `z.string().min(1)`. `hrefBase` comes from the site's own config.

- `site/lib/visited.ts:26-54` — `getSpaceId()` returns the trimmed URL/localStorage
  value with no format check:

  ```ts
  export function getSpaceId(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      const fromUrl = readSpaceFromUrl();
      if (fromUrl) {
        localStorage.setItem(SPACE_KEY, fromUrl);
        cleanSpaceFromUrl();
        return fromUrl;
      }
      return localStorage.getItem(SPACE_KEY);
    } catch {
      return null;
    }
  }
  ```

  The id is used at `visited.ts:127` (`ref(database, \`spaces/${spaceId}/visited\`)`)
  and `visited.ts:168`. Real space ids follow the shape `pe-` + lowercase hex, i.e.
  they match `[a-z0-9-]+`; choose the validation pattern below to comfortably include
  that shape without hardcoding any real id.

- Repo conventions: `visited.ts` is framework-free plain TS with graceful degradation —
  invalid input must make the feature **inert**, never throw. Tests are plain vitest
  files next to the module (see `site/lib/dates.test.ts` for the style); no jsdom setup
  exists, so only test pure functions (no `window` access).

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|---------------------|---------------------|
| Tests     | `npm test`          | all pass, exit 0    |
| Build     | `npm run build`     | exit 0              |
| Typecheck | `npx tsc --noEmit`  | exit 0 (only if plan 002 landed; otherwise expect only the 5 pre-existing errors listed in plan 002) |

## Scope

**In scope**:
- `site/components/PlacesExplorer.astro` (the `refreshMarkers` popup construction only)
- `site/lib/visited.ts` (spaceId validation only)
- `site/lib/visited.test.ts` (create — pure-function tests only)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `site/lib/firebase-config.json` — the committed web config is deliberate and standard
  for Firebase web apps; not a secret, do not remove or "fix" it.
- Firebase security rules — console-side, not in this repo. Report, don't attempt.
- The overall no-auth/shared-secret design of the visited feature — documented decision.
- `VisitedButton.astro` / `VisitedController.astro` — they consume `visited.ts`
  unchanged.

## Git workflow

- Branch: `advisor/004-popup-spaceid-hardening`
- Commit message style: repo prefixes `feat|fix|data|chore|refactor|docs`. Use:
  `fix: escape map popup name and validate space id`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Build the popup as a DOM node instead of an HTML string

In `site/components/PlacesExplorer.astro`, inside `refreshMarkers()`, replace the
`bindPopup` template string with an element (Leaflet accepts `HTMLElement`):

```ts
const link = document.createElement('a');
link.href = `${hrefBase}/places/${p.id}/`;
link.textContent = p.name;
L.marker(latlng, { icon: pinIcon, title: p.name })
  .bindPopup(link)
  .addTo(markerLayer);
```

Keep everything else in the function identical.

**Verify**: `npm run build` → exit 0. Then
`grep -n 'bindPopup(`' site/components/PlacesExplorer.astro` → no matches.

### Step 2: Validate spaceId format in visited.ts

In `site/lib/visited.ts`, add near the top (after `const SPACE_KEY`):

```ts
// Legit space ids are short URL-safe tokens (e.g. "pe-" + hex). Anything else —
// especially values containing "/" or "." — must not reach a database path.
const SPACE_ID_RE = /^[a-zA-Z0-9_-]{4,64}$/;
export function isValidSpaceId(id: string): boolean {
  return SPACE_ID_RE.test(id);
}
```

Then in `getSpaceId()`: only accept URL values that pass `isValidSpaceId` (an invalid
URL value is ignored — do not persist it, but still strip it from the address bar), and
validate the localStorage fallback too (if the stored value is invalid, return null).
The comment style should match the module's existing explanatory comments.

**Verify**: `npm run build` → exit 0.

### Step 3: Unit-test the validator

Create `site/lib/visited.test.ts` (plain vitest, model after
`site/lib/dates.test.ts` — no DOM):

- accepts: `pe-a1b2c3d4e5f6`, `abcd`, `A_Z-09` style tokens (4–64 chars)
- rejects: empty string, 3 chars, 65 chars, `has/slash`, `has.dot`, `has space`,
  `../up`, a string with `#` or `?`

Import only `isValidSpaceId` (importing the whole module is fine — it guards on
`typeof window === 'undefined'` and `firebase-config.json` resolves via the tsconfig
default `resolveJsonModule` in Astro's base config; if the JSON import breaks under
vitest, see STOP conditions).

**Verify**: `npm test` → all pass, including the new file.

## Test plan

- New: `site/lib/visited.test.ts` covering the validator accept/reject matrix above.
- Existing: full suite must stay green (`npm test`).
- Manual (optional, if a dev server is available): open the places page → map view →
  click a marker → popup link still navigates to the place detail page.

## Done criteria

- [ ] `grep -c "textContent = p.name" site/components/PlacesExplorer.astro` → 1
- [ ] No template-string `bindPopup(\`` remains in `PlacesExplorer.astro`
- [ ] `getSpaceId()` never returns a value failing `SPACE_ID_RE`
- [ ] `npm test` exits 0 with the new validator tests
- [ ] `npm run build` exits 0
- [ ] Completion report reminds the operator to verify/apply scoped Firebase RTDB rules
      in the console (client code cannot check this)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `refreshMarkers()` no longer matches the "Current state" excerpt (drifted).
- Importing `visited.ts` from a vitest file fails on the `firebase-config.json` import
  or the `firebase/database` type import — do not restructure the module to make the
  test work; report the exact error instead.
- The fix appears to require touching `VisitedController.astro` or the Firebase config.

## Maintenance notes

- Any future popup content (e.g. adding the drive time to the popup) must keep using
  DOM construction / `textContent`, never HTML strings with data values.
- If the space-id format ever changes (longer tokens, new prefix), update
  `SPACE_ID_RE` and its tests together; a too-strict regex silently makes the visited
  feature inert (that's the intended failure mode, but confusing if unexpected).
- Reviewer checklist: confirm the popup still renders as a link in both list→map toggle
  orders, and that a URL with an invalid `space=` value no longer persists anything to
  localStorage.
