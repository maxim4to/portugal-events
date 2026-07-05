---
name: ingest-events
description: Use when refreshing or filling the Portugal events listing ("афиша") — reads data/sources.json, gathers upcoming events across Portugal via web fetch/search, and writes validated Event entries into data/events/YYYY-MM.json for the portugal-events site. Trigger on "актуализируй события", "обнови афишу", "заполни события", "update events", "ingest events".
---

# ingest-events

Refresh the events listing for the portugal-events site. Gather real, upcoming
events across Portugal (concerts, festivals, exhibitions, markets, sport), write
them as validated `Event` entries grouped by month, dedupe against what already
exists, and archive events that have already ended. Leave the changes for the
human to review — do **not** push.

You have web tools — use `WebFetch` on the sources and `WebSearch` for major
events. Expect many calls. Never invent an event, a date, or a URL; if you can't
verify it, skip it.

## Before you write anything

1. **Read `schema/index.ts`** for the current `Event` shape — it is the source of
   truth. If this file disagrees with the summary below, follow the schema.
2. **Read `data/sources.json`** and use every source with `"enabled": true`.
   - `type: "website"` → `WebFetch` the `url` (follow the `hint`).
   - `type: "telegram"` → fetch `https://t.me/s/<channel>` (public preview; last ~20 posts).
   - `type: "rss"` → fetch the feed URL.
   Also run a few `WebSearch` queries for country-wide headliners in the window
   (e.g. "фестивали Португалия <месяц год>", "concerts Lisbon <month year>",
   "Porto Coimbra Algarve festival <year>").
3. **Read every `data/events/*.json`** (and `data/events/archive/*.json`) and
   collect all existing `id` values and `dedupeHash` values — never create a
   duplicate of either.
4. **Determine the date window.** Take today's date and target the next ~3 months
   (today through the end of the third month ahead). Only include events whose
   `dateEnd` is today or later.

## The Event shape (verify against schema)

- `id` — lowercase slug `^[a-z0-9-]+$`, stable and human-readable, include the year
  when a festival recurs (e.g. `nos-alive-2026`).
- `title` — event name (original language is fine, keep it recognizable).
- `type` — one of `concert | festival | exhibition | market | sport | other`.
- `dateStart` / `dateEnd` — ISO `YYYY-MM-DD`. `dateEnd >= dateStart`. For a
  one-day event both are equal.
- `city` — a real Portuguese city; prefer names that appear in `data/geo/cities.json`
  (Lisboa, Porto, Sintra, Cascais, Setúbal, Évora, Óbidos, Nazaré, Coimbra, Faro)
  so the site can place it — add the city to `cities.json` with coordinates if a
  venue is in a city not yet listed and it matters.
- `venue` — the place/hall (e.g. "Passeio Marítimo de Algés", "Altice Arena").
- `price` — free text (e.g. "от 45 €", "бесплатно", "по билетам"); empty string if unknown.
- `url` — a real link to the event or its tickets (validate it looks right).
- `image` — optional absolute https image URL. When writing an event, try to
  capture a representative image: `WebFetch` the event's page (its `url`) and read
  the `og:image` (or `twitter:image`) meta tag; store that absolute URL in `image`.
  Skip `image` if none is found or it isn't an absolute https URL. Prefer images on
  stable CDNs; never fabricate a URL.
- `description` — 1–2 sentences in Russian: what it is and why it's worth going.
- `sourceId` — the `id` of the source you found it through (or `"websearch"` for
  a general search find, or `"manual"` if hand-added).
- `dedupeHash` — a stable key: lowercase, `нормализованное_название|dateStart|город`
  (strip punctuation/extra spaces). Used to avoid duplicates across runs.

## Coverage

All of Portugal. Prioritize things genuinely worth traveling to on a weekend:
big festivals (NOS Alive, Super Bock Super Rock, MEO Kalorama, Paredes de Coura,
Meo Sudoeste, Kalorama, Bons Sons, Festival F, etc. — verify the real dates for
the target year), notable concerts at Altice Arena / Coliseu / Campo Pequeno /
Casa da Música, major exhibitions (Gulbenkian, MAAT, Berardo/CCB), seasonal
fairs and town festivals. Aim for a solid, real set — quality over padding.

## Writing the data

- Group events into `data/events/<YYYY-MM>.json` by the month of `dateStart`
  (a multi-month event goes in its start month). Each file is a JSON array.
- APPEND to existing month files; do not overwrite valid existing events. Keep
  files pretty-printed (2-space indent).
- Skip any event whose `dedupeHash` already exists (in any month file or the run).
- **Archive:** move events whose `dateEnd` is before today from `data/events/*.json`
  into `data/events/archive/<YYYY-MM>.json` (create the archive dir/file as needed),
  so the live listing stays current.

## Mandatory checks before finishing

- Run `npm run validate` → must print `All data files are valid.` Fix any file it
  names (bad URL, empty required field, `dateEnd` before `dateStart`, duplicate id).
  NEVER weaken the schema to make data pass.
- Run `npm test` → must stay green.
- Report a summary: how many events added per month, per source, any sources that
  failed to load (list them so they can be fixed), and how many past events archived.

## Do not

- Do NOT push. Leave the changes for the human to review (`git status` / `git diff
  data/events/`). The human promotes by reviewing and committing.
- Do NOT invent events or fabricate URLs. A source that returns nothing usable →
  note it in the summary and move on.
- Do NOT set up cron/automation — this skill is invoked on demand (the user opens
  the project and asks to refresh).
