# Plan 001: Keep the events afisha fresh — add a scheduled daily rebuild

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 4b0f531..HEAD -- .github/workflows/deploy.yml site/lib/data.ts CLAUDE.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `4b0f531`, 2026-07-05

## Why this matters

This is a fully static Astro site: "today" is computed **once, at build time**, and the
site is only rebuilt when someone pushes to `main`. `site/lib/data.ts` filters events to
`dateEnd >= today`, `site/pages/events.astro` splits ongoing vs. future events, and
`site/pages/index.astro` computes the "coming weekend" hero dates and the ~10-day event
window — all frozen at the moment of the last deploy. If the repo sits untouched for a
week, the home page shows last week's weekend dates and events that already ended still
appear as "upcoming". For a site whose headline feature is "what's on in the near future",
this silently corrupts the main content. A scheduled daily rebuild fixes it with a
3-line workflow change and no code changes.

Note on intent: the maintainer has an explicit design decision that **event ingestion**
(gathering new events) stays a manually-triggered agent session — no cron. That decision
is about producing new *data*. This plan only re-*builds* the site from data already in
git, which does not conflict with that decision. Do not add any ingestion automation.

## Current state

- `.github/workflows/deploy.yml` — CI + Pages deploy; triggers are currently only
  `push` to `main` and `workflow_dispatch`:

  ```yaml
  # .github/workflows/deploy.yml:3-6
  on:
    push:
      branches: [main]
    workflow_dispatch:
  ```

- `site/lib/data.ts:24-27` — build-time freeze of "today" (context only; do not change):

  ```ts
  const todayISO = new Date().toISOString().slice(0, 10);
  export const upcomingEvents: Event[] = Object.values(eventFiles)
    .flatMap((v) => z.array(EventSchema).parse(v))
    .filter((e) => e.dateEnd >= todayISO)
  ```

- `site/pages/index.astro:8-22` and `site/pages/events.astro:20-24` similarly compute
  `new Date()` at build time (context only; do not change).

- `CLAUDE.md` — describes the CI pipeline in its "What this is"/commands section; the
  sentence "CI (`.github/workflows/deploy.yml`) runs `validate` → `test` → `build` on
  every push to `main`..." should be extended to mention the schedule.

## Commands you will need

| Purpose  | Command            | Expected on success |
|----------|--------------------|---------------------|
| Validate | `npm run validate` | "All data files are valid.", exit 0 |
| Tests    | `npm test`         | all pass, exit 0    |
| Build    | `npm run build`    | exit 0, writes `dist/` |
| YAML sanity | `node -e "require('js-yaml')" 2>/dev/null \|\| npx --yes yaml-lint .github/workflows/deploy.yml` | see Step 1 verify for the simpler alternative |

## Scope

**In scope** (the only files you should modify):
- `.github/workflows/deploy.yml`
- `CLAUDE.md` (one-sentence doc update)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):
- `site/lib/data.ts`, `site/pages/index.astro`, `site/pages/events.astro` — the
  build-time date logic is correct once rebuilds are scheduled; moving filtering to the
  client is a bigger change explicitly not chosen here.
- `.claude/skills/ingest-events/` — no ingestion automation, per the maintainer's
  standing decision.

## Git workflow

- Branch: `advisor/001-scheduled-rebuild` (repo convention: work happens on branches;
  `main` is deployed).
- Commit message style: repo uses `feat|fix|data|chore|refactor|docs` prefixes, e.g.
  `chore: switch dev preview port to 4323`. Use: `fix: rebuild site daily so the afisha
  doesn't go stale`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add a daily schedule trigger to the deploy workflow

In `.github/workflows/deploy.yml`, change the `on:` block to:

```yaml
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 5 * * *'   # daily 05:00 UTC — refreshes build-time "today"
  workflow_dispatch:
```

05:00 UTC is early morning in Portugal (UTC/UTC+1), so the site is fresh before the day
starts. Keep the rest of the file byte-identical.

**Verify**: `python3 -c "import yaml,sys; d=yaml.safe_load(open('.github/workflows/deploy.yml')); trig=d[True] if True in d else d['on']; assert 'schedule' in trig and trig['schedule'][0]['cron']=='0 5 * * *'; print('ok')"` → prints `ok`
(PyYAML parses the key `on` as boolean `True`; the command handles both.)

### Step 2: Confirm the pipeline the schedule will run still passes locally

**Verify**: `npm run validate && npm test && npm run build` → all three exit 0.

### Step 3: Document the schedule in CLAUDE.md

In `CLAUDE.md`, find the sentence beginning `CI (\`.github/workflows/deploy.yml\`) runs
\`validate\` → \`test\` → \`build\` on every push to` and extend it to also say the
workflow runs on a daily cron (05:00 UTC) so the statically-baked "today" used by the
events listing stays current.

**Verify**: `grep -n "05:00 UTC" CLAUDE.md` → one match.

## Test plan

No unit tests — this is CI configuration. Verification is the YAML assertion in Step 1
plus the full local pipeline in Step 2. After merge, the operator can confirm with a
manual `workflow_dispatch` run or by checking the Actions tab the next day.

## Done criteria

- [ ] `.github/workflows/deploy.yml` contains the `schedule` trigger with cron `0 5 * * *`
- [ ] `npm run validate && npm test && npm run build` exits 0
- [ ] `git diff --stat` shows only `.github/workflows/deploy.yml`, `CLAUDE.md`, and `plans/README.md` changed
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `on:` block in `deploy.yml` no longer matches the excerpt above (someone already
  added triggers).
- You are tempted to change any file under `site/` — that means you're solving the
  problem a different way than planned.
- `npm run build` fails for reasons unrelated to your change.

## Maintenance notes

- GitHub disables scheduled workflows after ~60 days of repo inactivity and sends the
  owner an email with a re-enable button. If the afisha ever goes stale again, check the
  Actions tab for a disabled schedule first.
- The known intermittent `actions/deploy-pages@v4` flakiness (deploy job fails, build
  green) also applies to scheduled runs — a failed nightly deploy self-heals the next
  night; no action needed.
- If the maintainer later wants intra-day freshness, the alternative is client-side
  date filtering in `events.astro`/`index.astro` — deliberately deferred as an invasive
  change with little benefit over a daily rebuild.
