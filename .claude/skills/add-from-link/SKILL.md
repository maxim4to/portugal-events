---
name: add-from-link
description: End-to-end pipeline to add a place (or event) to the portugal-events site from a link the user shares (Instagram, blog, news, map). Reads the link, extracts real places/events, dedupes, generates validated entries with Wikimedia photos, commits to the feature branch, merges to main, waits for the GitHub Pages deploy, then replies with direct live URLs. Trigger on "добавь место", "добавь это место", "добавь событие", "вот ссылка", "add place from link", or whenever the user pastes a link and asks to add what's in it.
---

# add-from-link

Take a link the user shares and drive it all the way to the **live site**: extract
what's in the link, add it to the catalog through the existing content skills, and
publish so the user gets a working URL they can open in the browser.

This skill is the orchestrator. It does **not** replace `generate-places` (places)
or `ingest-events` (events) — it calls into them for the data-writing step and adds
the read-the-link, publish, and verify steps around them.

## When to use

The user pastes a link (Instagram post, travel blog, news article, Google Maps,
etc.) and says something like «добавь это место / места / событие на сайт». One
link may describe **several** places — read the whole thing and add all the real
ones.

## The pipeline

### 1. Read the link and extract candidates

Fetch the link and pull out every real place/event it mentions (name, town,
short context, any practical tips).

- **Instagram** blocks plain fetches — the normal URL returns just the word
  "Instagram". Read the post in this order, stopping at the first that works:
  1. **Embed endpoint** — returns the full caption:
     `https://www.instagram.com/p/<SHORTCODE>/embed/captioned/`
  2. **imginn mirror** — if the embed is empty/partial or you also need comments
     or other post content, take the **post id (the last part of the Instagram
     URL)** and read it through imginn:
     `https://imginn.com/p/<SHORTCODE>/`
     e.g. `https://www.instagram.com/p/DayXzXVMabB/` → `https://imginn.com/p/DayXzXVMabB/`.
  3. If both fail, web-search the caption text or ask the user to paste it.
  The `<SHORTCODE>` is the id segment after `/p/` in the Instagram link.
- For blogs/news/maps, fetch the page directly. If a fetch is blocked, try a web
  search for the same content, or ask the user to paste the text.
- Decide **places vs events**: a physical spot to visit → place; a dated
  happening (concert, festival, market, exhibition) → event.

### 2. Dedupe against the catalog

Before writing anything, check what already exists so you don't add a place twice
under a different slug.

- Places: grep `data/places/*.json` for the candidate names / likely slugs (Latin
  and transliterated). Report which candidates are **already present** and skip
  them — mention them to the user rather than silently dropping.
- Events: dedupe follows `ingest-events` rules (`dedupeHash`).

### 3. Generate the entries

- **Places** → invoke the `generate-places` skill and follow it exactly: correct
  `Place` shape from `schema/index.ts`, unique `id`, honest Russian description +
  coordinates + drive time, tags from the closed vocabulary, and **only
  free-licensed Wikimedia Commons photos** (`upload.wikimedia.org` URLs, all four
  photo fields present, or omit the photo). Append to the matching region file
  (e.g. Arrábida/Sesimbra beaches → `data/places/setubal.json`).
- **Events** → invoke the `ingest-events` skill and write into
  `data/events/<YYYY-MM>.json`.

### 4. Validate

Run and get them green before committing:

```bash
npm install          # if tsx/vitest are missing (fresh container)
npm run validate
npm test
```

Never loosen `schema/index.ts` to make data pass — fix the data.

### 5. Commit to the feature branch

Commit on the designated feature branch (do **not** commit straight to `main`).
Use a `data:` prefix, e.g.:

```
data: add Arrábida/Sesimbra beaches from Instagram post
```

Then `git push -u origin <feature-branch>`.

### 6. Publish to the live site

The site deploys via `.github/workflows/deploy.yml`, which only runs on push to
**`main`**. So a feature branch alone will **not** update the live site. To publish:

1. Open a PR from the feature branch into `main` (GitHub MCP:
   `create_pull_request`).
2. Merge it (`merge_pull_request`, squash) — this is the step that triggers the
   Pages deploy.

**This is standing authorization: whenever the user asks to add a place or event,
publish immediately — open the PR and merge to `main` without asking for
confirmation, then send the live link.** The user has explicitly opted into
auto-publish for this skill, so do not pause to confirm the merge.

If the feature branch has diverged from `main` (e.g. after earlier squash-merges)
and the merge hits a conflict, rebuild the branch from the latest `main`, re-apply
the change, and push (`--force-with-lease` is fine when the branch only carried
already-merged history), then merge the PR.

### 7. Wait for the deploy, then verify live

- Find the deploy run: `actions_list` (`list_workflow_runs`, `deploy.yml`, branch
  `main`) and poll `actions_get` (`get_workflow_run`) until
  `conclusion: success`. Use `ScheduleWakeup` (~2 min) instead of `sleep`.
- Verify each new page actually loads (HTTP 200):

```bash
for slug in <slug-1> <slug-2>; do
  curl -s -o /dev/null -w "%{http_code}  $slug\n" \
    "https://mi-crafts.com/portugal-events/places/$slug/"
done
```

Live base URL: `https://mi-crafts.com/portugal-events/`. A place page is
`.../places/<id>/`; the events listing is `.../events/`.

### 8. Reply with direct links

Send the user the direct live URL for each place added, so they can open it in the
browser — e.g. `https://mi-crafts.com/portugal-events/places/praia-do-creiro/`.
Also list any candidates from the link that were **already** in the catalog, with
their existing links.

## Notes

- Accuracy over volume: if you can't confirm a place is real or can't pin its
  coordinates, skip it and say so.
- One link can mix places and events — handle each with the right sub-skill.
- Follow the repo's branch rules: develop on the feature branch, never push to a
  different branch without permission.
