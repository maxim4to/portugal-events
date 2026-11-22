# DESIGN.md — portugal-events

The visual contract for the site. Every UI change follows it; tokens live in
`site/styles/tokens.css`, shared primitives in `site/styles/base.css`.

References: **Airbnb** (map + list explorer, photo-first cards, pill filters,
generous whitespace), **Linear / Stripe** (strict grid, quiet neutral type,
one accent), **Craft Docs** (palette: neutral paper-white canvas, white cards,
near-black ink for text and filled controls, soft layered shadows, pastel type
tints, a papaya brand mark). Character comes from photography and an editorial
serif used *only* for page titles — not from decoration.

## Principles

1. **Photography leads.** Cards are photo-first; chrome (borders, rules,
   badges) recedes. No boxes around boxes.
2. **One grid.** Header, filters, list and map share the same outer gutters
   (`--gutter`) and max width (`--page-max`). Nothing floats off-axis.
3. **Sentence case everywhere.** No uppercase letter-spaced labels. Hierarchy
   comes from size and weight, not tracking.
4. **One accent.** Ink (`--accent`, near-black; near-white in dark) =
   interactive/selected. Papaya (`--editorial`) stays out of UI chrome; it
   survives only in the brand mark.
   Red (`--danger`) = favorite heart, green (`--visited`) = visited.
5. **Quiet until needed.** Secondary actions (visited / not interested) appear
   on hover on pointer devices; always visible on touch.
6. **Every state designed:** hover, focus-visible, pressed, selected, empty,
   loading, missing image, long text.

## Type

| Role | Font | Size / weight / line |
| --- | --- | --- |
| Page title (detail h1) | Fraunces | clamp(32px, 3.6vw, 48px) / 600 / 1.08, -0.02em |
| Section title (h2) | Inter | 22px / 650 / 1.25, -0.01em |
| Card title | Inter | 16px / 600 / 1.3 |
| Body | Inter | 15px / 400 / 1.55 (long-form reading: 17px / 1.65) |
| Meta / secondary | Inter | 13px / 400–500 / 1.4, `--text-secondary` |
| Label / eyebrow | Inter | 12.5px / 600 / 1.3, sentence case, `--text-secondary` |

Numerals in meta use `font-variant-numeric: tabular-nums`.

## Color (light / dark in tokens.css)

- `--surface-0` page, `--surface-1` subtle fills (hover, chips, segmented
  tracks), `--surface-2` raised sheets (cards, popovers, header),
  `--surface-raised` the thumb / active pill on a `--surface-1` track (in dark
  mode surface-2 is darker than surface-1, so never use surface-2 for thumbs).
- `--text-primary / -secondary / -muted`; never pure black/white text.
- `--border` hairlines (1px), `--border-strong` for inputs/controls.
- `--accent`, `--accent-bg` (selected fill), `--accent-text` (text on accent-bg),
  `--on-accent` (text on solid accent).
- Type tints (`--type-*`) only for small type discs / badges.

## Shape, depth, spacing

- Radii: `--radius-sm` 8px (chips, small buttons), `--radius` 12px (buttons,
  inputs, images inside cards), `--radius-lg` 16px (cards, panels, map),
  `--radius-pill`.
- Shadows: `--shadow-sm` (resting controls on imagery), `--shadow-md`
  (popovers, floating pills), `--shadow-lg` (dialogs, map popups).
- Spacing: 4-pt scale `--space-1…8` (4, 8, 12, 16, 24, 32, 48, 64).
- Layout: `--page-max: 1600px`, `--gutter: 24px` (16px < 760px),
  header height `--header-h: 64px`.

## Components

- **Header**: 64px, surface-2 with hairline bottom; brand left, segmented nav
  pills center (Inter 15/500, surface-1 track, active = `--surface-raised`
  thumb + primary text), actions
  right (sign-in = secondary button, theme = icon button). Inner aligned to the
  page grid.
- **Buttons**: height 40 (sm 32). Primary = solid accent; secondary = surface-2
  + `--border-strong`; ghost = text only. Press: `scale(0.97)` 160ms
  `--ease-out`. Hover gated behind `(hover: hover)`.
- **Chips / filter pills**: 36px, radius-pill, surface-2 + border; selected =
  accent-bg + accent-text + accent border. Counts are accent dots.
  *Phones*: pills float over the map, so a selected one is solid accent with
  `--on-accent` text (a tint would vanish on the tiles); the tap area extends
  to 44px with an invisible `::before`.
- **Place / event card**: no outer border or fill; photo 4:3 on ≥761px (phones
  use the gallery's 16:10 so a card fits under the sheet header) with
  `--radius-lg`, then 12px gap, title, one-line meta row, 2-line description.
  Heart top-right on photo (white 32px disc, `--shadow-sm`); visited /
  not-interested reveal on hover (always on touch). Missing image → tinted
  type-colored placeholder with the type icon, never a blank box.
- **Meta row**: single line, `·` separators only *between* items on the same
  line; overflow ellipsizes, never clips mid-glyph. A card too narrow to show
  the free-text season drops it (container query) rather than show "се…".
- **Type label**: 8px type-tinted dot + sentence-case label, on cards and in
  map popups / phone previews alike. Event types alias place tints
  (`--type-concert` …). The detail page header uses the tinted badge variant.
- **Values**: drive time via `formatDriveMinutes` (`site/lib/format.ts`,
  "2 ч 45 мин"); date ranges via `formatDateRangeRu` (year on both ends when a
  range crosses a year); values lowercase as in the data.
- **Facet sidebar** (≥1100px, places): left column 256px (224px at
  1100–1399px so the list keeps two card columns), own scroll. Section label +
  rows (icon, label, check). Left edges of all rows align with the header brand.
- **List header** (desktop explorers): no result count; the row appears only for «Все» after a map-area search.
- **Map**: radius-lg container, controls as one rounded card with shadow-md;
  popups radius-lg + shadow-lg. Tiles graded in CSS (neutral in light, inverted
  in dark) on every map including the detail minimap. The view is locked to
  mainland Portugal: `maxBounds` + a min zoom at which the country just fits
  the visible area; on phones the frame stretches by what the sheet covers.
  leaflet.css loads after component CSS — prefix overrides with
  `.leaflet-container` (and keep its `plus-lighter` tile blend off).
- **Empty state**: centered in the list pane, icon + title + hint + secondary
  button.
- **Detail page**: two-column on ≥1100px — content + sticky aside (facts,
  actions, minimap) in a centred ~1200px reading container (deliberately
  narrower than the full-bleed explorer grid; settings/profile use a 680px
  column). Prose max 720px. Phones: edge-to-edge gallery, floating action bar
  on a surface-0 fade.

## QA

`node qa/shoot.mjs <outDir> <baseUrl> [filter]` screenshots every page/state at
8 widths × 2 themes and reports overflow, clipped text and console errors
(see the header of `qa/shoot.mjs`). Compare against a previous run before
merging UI changes. Headless full-page captures (`FULL=1`) leave lazy iframes
and Leaflet tiles blank — check maps in viewport shots.

## Motion

`--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`; UI transitions 150–200ms on
`transform`, `opacity`, `background-color`, `border-color`, `box-shadow` only —
never `all`. Respect `prefers-reduced-motion`.

## Do / don't

- Don't hardcode colors, radii or shadows in components — use tokens.
- Don't add uppercase + letter-spacing labels.
- Don't put a bordered box inside another bordered box.
- Internal links go through the base-path helpers (`hrefBase`, `BASE_URL`).
