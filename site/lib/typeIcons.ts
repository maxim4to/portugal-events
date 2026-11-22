// Shared per-type colors and SVG glyphs for the game-map pins and the filter
// icons. Pure data — safe to import from Astro frontmatter (no Leaflet here).

export const COLORS: Record<string, string> = {
  // Places
  beach: '#1f87d6',
  hike: '#2f8f4f',
  castle: '#7a5bc7',
  lake: '#12a3a3',
  viewpoint: '#dd9a12',
  town: '#e06a4f',
  nature: '#6a9f2f',
  museum: '#5a54c7',
  park: '#d64f9f',
  garden: '#3fa05f',
  karting: '#e0761f',
  cablecar: '#5f7389',
  thermal: '#2aa7b8',
  route: '#8f6f3f',
  other: '#8a8275',
  // Events
  concert: '#b14fd6',
  festival: '#e05a7a',
  exhibition: '#5a54c7',
  market: '#c78a1f',
  sport: '#2f8f8f',
};

const S = 'fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

export const GLYPHS: Record<string, string> = {
  beach:
    `<path ${S} d="M4 12a8 8 0 0 1 16 0Z"/><path ${S} d="M12 4v0M12 12v7"/><path ${S} d="M6 21c2-1.6 10-1.6 12 0"/>`,
  hike: `<path fill="#fff" d="M2.5 19 9 7.5l3.4 5.6 1.9-2.8L21.5 19Z"/>`,
  castle:
    `<path fill="#fff" d="M5 21V8h2.5v2h3V8h3v2h3V8H19v13h-5v-5h-4v5Z"/>`,
  lake:
    `<path ${S} d="M3 9.5c2-1.8 4-1.8 6 0s4 1.8 6 0 4-1.8 6 0M3 14.5c2-1.8 4-1.8 6 0s4 1.8 6 0 4-1.8 6 0"/>`,
  viewpoint:
    `<path ${S} d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z"/><circle fill="#fff" cx="12" cy="12" r="2.6"/>`,
  town: `<path fill="#fff" d="M4 21V10.5L12 4l8 6.5V21h-5.5v-6h-5v6Z"/>`,
  nature:
    `<path fill="#fff" d="M12 2.5 6.5 11h2.6L5 17.5h6v4h2v-4h6L14.9 11h2.6Z"/>`,
  museum:
    `<path fill="#fff" d="M3 9.5 12 4l9 5.5V11H3ZM4.5 12.5h2.6V18H4.5Zm6.2 0h2.6V18h-2.6Zm6.2 0h2.6V18h-2.6ZM3 19.3h18V21H3Z"/>`,
  park:
    `<circle ${S} cx="12" cy="10" r="6.5"/><path ${S} d="M12 3.5v13M5.5 10h13M7.4 5.4l9.2 9.2M16.6 5.4l-9.2 9.2M12 16.5 8.5 21.5M12 16.5l3.5 5"/>`,
  garden:
    `<circle fill="#fff" cx="12" cy="8" r="2.4"/><circle fill="#fff" cx="8" cy="11" r="2.4"/><circle fill="#fff" cx="16" cy="11" r="2.4"/><circle fill="#fff" cx="12" cy="13.5" r="2.4"/><path ${S} d="M12 15.5V21M12 19c-2 0-3.5-.8-4.5-2M12 19c2 0 3.5-.8 4.5-2"/>`,
  karting:
    `<circle ${S} cx="12" cy="12" r="8"/><circle fill="#fff" cx="12" cy="12" r="2.2"/><path ${S} d="M4.5 10.5c3-1.4 12-1.4 15 0M12 14.5V20"/>`,
  cablecar:
    `<path ${S} d="M2 6.5 22 4M12 5.8V10"/><rect ${S} x="6.5" y="10" width="11" height="8.5" rx="1.8"/><path ${S} d="M6.5 14.5h11"/>`,
  thermal:
    `<path ${S} d="M8 3.5c-1.4 1.8-1.4 3.2 0 5s1.4 3.2 0 5M12 3.5c-1.4 1.8-1.4 3.2 0 5s1.4 3.2 0 5M16 3.5c-1.4 1.8-1.4 3.2 0 5s1.4 3.2 0 5"/><path ${S} d="M4.5 17a15 15 0 0 0 15 0"/>`,
  route:
    `<path fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" d="M6 21c7-3-1-7.5 3-11 2.6-2.3 7-2 9-6"/><path fill="none" stroke-width="1.6" stroke="currentColor" stroke-linecap="round" stroke-dasharray="2.4 3" d="M6 21c7-3-1-7.5 3-11 2.6-2.3 7-2 9-6"/>`,
  other:
    `<path fill="#fff" d="m12 2.8 2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7Z"/>`,
  // Events
  concert:
    `<path fill="#fff" d="M9 4.5 20 3v11.2a3 3 0 1 1-2-2.8V6.8l-7 1V17.2a3 3 0 1 1-2-2.8Z"/>`,
  festival:
    `<path ${S} d="M6 21V3.5"/><path fill="#fff" d="M6 4h12l-3 4 3 4H6Z"/>`,
  exhibition:
    `<rect ${S} x="4" y="4.5" width="16" height="13" rx="1.5"/><path fill="#fff" d="m6.5 15.5 3.5-5 2.6 3.4 1.9-2.2 3 3.8Z"/><circle fill="#fff" cx="9.5" cy="8.5" r="1.4"/><path ${S} d="M9 21h6"/>`,
  market:
    `<path ${S} d="M5 10h14l-1.5 9.5h-11Z"/><path ${S} d="M8.5 10C8.5 6 10 3.5 12 3.5S15.5 6 15.5 10"/>`,
  sport:
    `<path fill="#fff" d="M8 3.5h8V5h3v2.5A4.5 4.5 0 0 1 15 11.8 4 4 0 0 1 13 13v3h3l.6 4.5H7.4L8 16h3v-3a4 4 0 0 1-2-1.2A4.5 4.5 0 0 1 5 7.5V5h3Z"/>`,
};

export const favoriteGlyph = `<path fill="#fff" d="M12 20S4 14.7 4 9.6C4 6.9 6 5 8.4 5c1.6 0 2.9.9 3.6 1.9C12.7 5.9 14 5 15.6 5 18 5 20 6.9 20 9.6 20 14.7 12 20 12 20Z"/>`;
export const FAVORITE_COLOR = '#d6305f';

/** A small colored-disc icon for a place/event type (filter rows, legends). */
export function typeDiscHtml(type: string, size = 18): string {
  const t = GLYPHS[type] ? type : 'other';
  const color = COLORS[t] ?? COLORS.other;
  const g = Math.round(size * 0.62);
  return (
    `<span class="type-disc" style="background:${color};color:${color};width:${size}px;height:${size}px" aria-hidden="true">` +
    `<svg viewBox="0 0 24 24" width="${g}" height="${g}">${GLYPHS[t]}</svg></span>`
  );
}
