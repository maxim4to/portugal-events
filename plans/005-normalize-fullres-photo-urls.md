# Plan 005: Normalize the 49 full-resolution Wikimedia photo URLs to 1280px thumbnails

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 4b0f531..HEAD -- data/places pipeline`
> If the data files changed since this plan was written, re-run the count command in
> "Current state" — the plan still applies as long as full-res originals exist; only
> the count differs.

## Status

- **Priority**: P2
- **Effort**: S–M
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `4b0f531`, 2026-07-05

## Why this matters

Place photos are hot-linked from Wikimedia Commons. Most URLs (332 of 381 at the
planned-at commit) correctly use the `/thumb/.../1280px-*` form, but **49 are direct
originals** (`https://upload.wikimedia.org/wikipedia/commons/<h1>/<h2>/<File>`), which
for Commons photos are often 4000–6000px, multi-megabyte files. These load inside
~300px place cards and the detail gallery — wasted bandwidth, slow first paint on
mobile, and unnecessary load on Wikimedia's servers. The generation skill already asks
for ~1024px thumbnails (`.claude/skills/generate-places/SKILL.md:86-87`); these 49
slipped through. Fix the data once with a script, and keep the script for future
batches.

## Current state

- Count of offenders at `4b0f531` (re-run this — it's your ground truth):

  ```bash
  python3 -c "
  import json,glob
  n=0
  for f in glob.glob('data/places/*.json'):
      for p in json.load(open(f)):
          for ph in p.get('photos',[]):
              u=ph['url']
              if u.startswith('https://upload.wikimedia.org/') and '/thumb/' not in u: n+=1
  print(n)"
  ```

  → prints `49`.

- Wikimedia thumbnail URL construction: an original
  `https://upload.wikimedia.org/wikipedia/commons/<h1>/<h2>/<FileName>`
  has its 1280px thumbnail at
  `https://upload.wikimedia.org/wikipedia/commons/thumb/<h1>/<h2>/<FileName>/1280px-<FileName>`.
  Caveats that make verification mandatory per-URL:
  - If the original is **narrower than 1280px**, the thumb request can fail (404) for
    some formats — keep the original URL in that case.
  - Non-JPEG/PNG formats (SVG, TIFF, WebP originals) have different thumb-name rules —
    treat any non-200 as "keep the original".

- `data/places/*.json` — 12 region/category files, each an array of `Place`; photos at
  `place.photos[].url` (schema: `schema/index.ts:23-28`; only `url` changes, `author`/
  `license`/`sourceUrl` stay).

- `pipeline/` — houses `validate.ts` (run via `tsx`); put the new script here, matching
  its style: plain TS, node `fs` APIs, run with `npx tsx pipeline/<name>.ts`.

- Example of the correct target form, from `data/places/lisboa-sintra.json:16`:

  ```
  https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Praia_da_Ursa_-_Parque_Natural_Sintra-Cascais.jpg/1280px-Praia_da_Ursa_-_Parque_Natural_Sintra-Cascais.jpg
  ```

## Commands you will need

| Purpose  | Command            | Expected on success |
|----------|--------------------|---------------------|
| Validate | `npm run validate` | "All data files are valid.", exit 0 |
| Tests    | `npm test`         | all pass, exit 0    |
| Build    | `npm run build`    | exit 0              |
| Run script | `npx tsx pipeline/normalize-photo-urls.ts` | summary printed, exit 0 |

## Scope

**In scope**:
- `pipeline/normalize-photo-urls.ts` (create)
- `data/places/*.json` (URL rewrites only — no other field changes)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `schema/index.ts` — no schema change (no srcset/widths fields; a responsive-images
  redesign was considered and deferred, see Maintenance notes).
- `site/components/PhotoGallery.astro`, `PlaceCard.astro` — no rendering changes.
- `.claude/skills/generate-places/SKILL.md` — it already instructs thumbnails; leave it.
- `data/events/`, `data/collections.json` — event images are a different pipeline.

## Git workflow

- Branch: `advisor/005-normalize-photo-urls`
- Commit message style: repo prefixes `feat|fix|data|chore|refactor|docs`. Use:
  `data: replace full-res Wikimedia photo URLs with 1280px thumbnails` (and a separate
  `chore:`-prefixed commit for the script is fine, or one commit for both).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write `pipeline/normalize-photo-urls.ts`

Behavior:
1. For every `data/places/*.json`, parse the array, walk `photos[].url`.
2. Select URLs matching `^https://upload\.wikimedia\.org/wikipedia/commons/(?!thumb/)([0-9a-f])/([0-9a-f]{2})/(.+)$` (i.e. originals, not already `/thumb/`).
3. Build the candidate `.../thumb/<h1>/<h1h2>/<File>/1280px-<File>` URL.
4. **Verify each candidate with an HTTP HEAD request** (node 22 global `fetch`, method
   `HEAD`): status 200 → rewrite; anything else → keep the original and log it.
   Throttle politely (sequential requests are fine for ~49 URLs; set a
   `User-Agent` header like `portugal-events-tools/1.0` — Wikimedia rejects blank UAs).
5. Write files back preserving 2-space JSON indent + trailing newline (match the
   existing files: `JSON.stringify(data, null, 2) + '\n'`).
6. Print a summary: `rewritten N, kept M (list of kept URLs)`.

**Verify**: `npx tsx pipeline/normalize-photo-urls.ts` → exits 0, prints summary with
rewritten + kept counts summing to the offender count from "Current state".

### Step 2: Validate the rewritten data

**Verify**: `npm run validate` → "All data files are valid.". Then re-run the count
command from "Current state" → prints only the number the script reported as "kept"
(ideally 0–10; the kept ones are legitimately un-thumbable originals).

### Step 3: Spot-check and full pipeline

Pick 3 rewritten URLs from the git diff and `curl -sI -A portugal-events-tools/1.0 <url> | head -1`
→ `HTTP/2 200` each.

**Verify**: `npm test && npm run build` → exit 0.

## Test plan

No unit tests for the one-shot script (repo convention: pipeline scripts are verified by
`npm run validate` on their output). The per-URL HEAD verification inside the script IS
the test — a rewritten URL is only written if Wikimedia served it.

## Done criteria

- [ ] Offender count (command in "Current state") drops to the script's "kept" number,
      and every kept URL is listed in the script output as verification-failed
- [ ] `git diff --stat` touches only `data/places/*.json` and
      `pipeline/normalize-photo-urls.ts` (+ plans/README.md)
- [ ] Diff contains ONLY `"url"` line changes in the data files
      (`git diff -U0 data/places | grep '^[+-]' | grep -v '"url"' | grep -v '^[+-][+-]'` → empty)
- [ ] `npm run validate && npm test && npm run build` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- More than half of the candidate thumb URLs fail the HEAD check — the URL construction
  rule is probably wrong for this data; report examples instead of guessing variants.
- Network access to `upload.wikimedia.org` is unavailable in your environment — do NOT
  rewrite unverified URLs; report that the plan needs a networked environment.
- Any offender URL is NOT on `upload.wikimedia.org` (repo policy allows only that host —
  a foreign host is a data bug worth reporting, not silently fixing).

## Maintenance notes

- Future `generate-places` batches should keep producing `/thumb/.../1280px-` (or
  ~1024px) URLs per the skill; this script can be re-run any time as a safety net —
  it is idempotent (already-thumb URLs are skipped).
- Deferred follow-up (deliberately out of scope): responsive `srcset` with multiple
  thumb widths (480/640/1280) in `PhotoGallery.astro` + a schema extension. Worth doing
  only if mobile bandwidth is still a complaint after this fix, since it requires a
  schema migration across ~381 photo entries.
