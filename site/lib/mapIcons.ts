import L from 'leaflet';
import { COLORS, GLYPHS, favoriteGlyph, FAVORITE_COLOR } from './typeIcons';

// Game-map style pins ("GTA blips"): a saturated colored disc with a white
// glyph per place/event type, centered on the location (no teardrop tip).
// Colors are fixed hexes, not theme tokens — markers sit on the always-light
// OSM tiles (the dark theme inverts only the tile pane), so they must read
// there in both themes.


// 24×24 viewBox, white strokes/fills. Kept deliberately chunky — they render
// at ~16px inside the disc.


export interface PinMods {
  favorite?: boolean;
  visited?: boolean;
}

const cache = new Map<string, L.DivIcon>();

/**
 * The marker icon for a place/event type. Favorite replaces the type glyph
 * with a heart badge; visited keeps the glyph but dims the disc (CSS).
 * Keeps the legacy `place-pin` className so hover/active plumbing
 * (`.pin-active`) and list↔map sync work unchanged.
 */
export function gameIcon(type: string | undefined, mods: PinMods = {}): L.DivIcon {
  const t = type && GLYPHS[type] ? type : 'other';
  const key = `${t}|${mods.favorite ? 'f' : ''}${mods.visited ? 'v' : ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const color = mods.favorite ? FAVORITE_COLOR : (COLORS[t] ?? COLORS.other);
  const glyph = mods.favorite ? favoriteGlyph : GLYPHS[t];
  const cls =
    'place-pin' +
    (mods.favorite ? ' place-pin--favorite' : '') +
    (mods.visited ? ' place-pin--visited' : '');
  const icon = L.divIcon({
    className: cls,
    html:
      `<span class="gpin" style="background:${color};color:${color}">` +
      `<svg viewBox="0 0 24 24" aria-hidden="true">${glyph}</svg></span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
  cache.set(key, icon);
  return icon;
}
