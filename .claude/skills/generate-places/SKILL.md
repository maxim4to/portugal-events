---
name: generate-places
description: Use when generating or expanding the Portugal places catalog — produces candidate Place entries (with Wikimedia photos) into data/places/*.json for the portugal-events site. Trigger on "сгенерируй места", "добавь места", "наполни каталог", "generate places".
---

# generate-places

Generate realistic **candidate** `Place` entries for the portugal-events catalog:
real places within a 2–3 hour drive of Lisbon, each with an honest description,
coordinates, and (when possible) a freely-licensed Wikimedia photo. Everything you
add lands in `data/places/*.json` with `status: "candidate"` for a human to review
and promote later.

## Before you write anything

1. **Read `schema/index.ts`.** Use the current `Place` shape as the source of
   truth — if this file ever disagrees with the schema, follow the schema. The
   fields you must produce are described below; do **not** invent fields that are
   not in the schema.
2. **Read every `data/places/*.json`** and collect all existing `id` values.
   **NEVER reuse an id** — the validator rejects duplicate ids across files.
   Also skim the existing names so you don't add the same real place twice under
   a different slug.

## The `Place` shape (confirm against `schema/index.ts`)

| field | rule |
|---|---|
| `id` | lowercase latin slug matching `^[a-z0-9-]+$`. Transliterate Portuguese names; keep it stable and human-readable, e.g. `praia-da-ursa`, `cabo-da-roca`. |
| `name` | Russian display name, non-empty. |
| `type` | exactly one of: `beach`, `hike`, `castle`, `lake`, `viewpoint`, `town`, `nature`, `other`. |
| `region` | Russian region name (see matrix below), non-empty. |
| `coords` | `{ lat, lon }` — real numbers, `lat` in [-90, 90], `lon` in [-180, 180]. |
| `description` | 2–3 sentences in Russian: what it is, why go, one practical tip. Non-empty. |
| `driveMinutesFromLisbon` | positive **integer** minutes — an honest estimate. |
| `visitDurationHours` | positive number (may be fractional, e.g. `1.5`). |
| `bestSeason` | Russian free text, e.g. `"май–октябрь"`, `"круглый год"`. Non-empty. |
| `tags` | array of 2–4 tags from the controlled vocabulary below. |
| `links` | array of `{ title, url }` (both required, `url` must be a valid URL). May be `[]`. |
| `photo` | OPTIONAL object `{ url, author, license, sourceUrl }` — **all four required when present**. Omit the whole field if you have no free photo. |
| `status` | always `"candidate"` for everything you generate. |

## Controlled tag vocabulary (use ONLY these)

The site's tag filter shows whatever tags exist in approved data, so do **not**
invent synonyms. Pick 2–4 per place from:

```
закат, бесплатно, с детьми, купание, виды, история, вино, сёрфинг, природа, фото, ресторан
```

## Category × region matrix

Cover the 8 `type` values across these regions (a 2–3 h driving radius from Lisbon):

- «Лиссабон и Синтра»
- «Сетубал и Аррабида»
- «Оэште»
- «Алентежу»
- «Центр (Коимбра, Томар)»
- «Эштремадура»

Target roughly **60–80 places total across all runs**. A single run should add a
**focused batch (~20–30)** — for example one region, or one category across a few
regions — rather than trying to do everything at once.

## For each place — gather via web search

- A 2–3 sentence Russian `description` (what it is, why go, one practical tip).
- Approximate but real `coords` (look them up — do not guess wildly).
- An honest `driveMinutesFromLisbon`.
- A realistic `visitDurationHours`.
- A `bestSeason` in Russian free text.
- 2–4 `tags` from the controlled vocabulary above.

**Accuracy over volume.** It is better to add 20 correct, real places than 40
shaky ones. If you are unsure a place exists, or you cannot pin down its
coordinates, **skip it**.

## Photos — Wikimedia Commons only

For each place, query the Wikimedia Commons API for a freely-licensed image.

- Store `photo` as `{ url, author, license, sourceUrl }` where:
  - `url` — a **direct image URL on `upload.wikimedia.org`**, preferably a
    thumbnail ~1024px wide.
  - `author` — the credited author (plain text — **strip any HTML** from the
    Artist field).
  - `license` — the license short name, e.g. `"CC BY-SA 4.0"`, `"CC0"`,
    `"Public domain"`.
  - `sourceUrl` — the Commons `File:` page URL.
- **Only free licenses:** CC0, CC BY, CC BY-SA, or Public domain. Verify the
  license and **skip non-free images**.
- **If no suitable freely-licensed photo exists, OMIT the `photo` field
  entirely.** Never invent a URL, author, or license.

### Commons API recipe

Search for a file, then read its metadata:

```
# 1. find candidate files
https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=Praia%20da%20Ursa&gsrnamespace=6&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1024

# 2. or, if you already know the file title
https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1024&titles=File:Praia_da_Ursa.jpg
```

From the response, per page under `query.pages[*].imageinfo[0]`:

- `thumburl` → `photo.url` (a `upload.wikimedia.org` URL at the requested width).
- `descriptionurl` → `photo.sourceUrl` (the `File:` page).
- `extmetadata.Artist.value` → `photo.author` — **strip HTML tags** (it is
  often wrapped in `<a>`/`<span>`).
- `extmetadata.LicenseShortName.value` → `photo.license`.
- Check `extmetadata.LicenseShortName` / `License` is a free license before
  keeping it.

## Writing the data

- Append to the matching existing region file, or create a new
  `data/places/<region-slug>.json`. Each file must be a **valid JSON array** of
  places.
- Set `status: "candidate"` on everything.

## Mandatory before finishing

1. Run `npm run validate` and `npm test`.
2. Fix any file the validator names — usually a bad id, a partial `photo`
   object, or an out-of-range coordinate.
3. **NEVER weaken the schema** in `schema/index.ts` to make data pass. The data
   must conform to the schema, not the other way around.
4. **Do NOT commit.** Leave the changes staged/unstaged for the user to review.
