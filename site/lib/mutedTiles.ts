import L from 'leaflet';

// OSM tiles with a per-hue regrade: greens (parks, forest, farmland) are
// pulled almost to grey and the sea's blue is softened, while roads, labels and
// the other colors stay as they are. A CSS filter can only grade every hue at
// once, so each tile is drawn into a canvas and recolored once when it loads
// (about 1 ms per 256px tile), which costs nothing while panning.

const GREEN_KEEP = 0.12; // share of saturation greens keep
const BLUE_KEEP = 0.55; // share of saturation the sea keeps

// 0..1 membership of hue h (degrees) in a band, with soft ramps.
function band(h: number, from: number, full: number, fullEnd: number, to: number): number {
  if (h <= from || h >= to) return 0;
  if (h < full) return (h - from) / (full - from);
  if (h > fullEnd) return (to - h) / (to - fullEnd);
  return 1;
}

export function recolor(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = r > g ? (r > b ? r : b) : g > b ? g : b;
    const min = r < g ? (r < b ? r : b) : g < b ? g : b;
    const d = max - min;
    if (d < 6) continue; // already grey
    let h: number;
    if (max === r) h = ((g - b) / d) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
    if (h < 0) h += 360;
    const green = band(h, 55, 75, 160, 178);
    const blue = band(h, 172, 185, 225, 245);
    if (green === 0 && blue === 0) continue;
    const keep = 1 - green * (1 - GREEN_KEEP) - blue * (1 - BLUE_KEEP);
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    data[i] = l + (r - l) * keep;
    data[i + 1] = l + (g - l) * keep;
    data[i + 2] = l + (b - l) * keep;
  }
}

const MutedTileLayer = L.TileLayer.extend({
  createTile(this: L.TileLayer, coords: L.Coords, done: L.DoneCallback) {
    const size = this.getTileSize();
    const canvas = document.createElement('canvas');
    canvas.width = size.x;
    canvas.height = size.y;
    canvas.setAttribute('role', 'presentation');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(img, 0, 0, size.x, size.y);
        try {
          const px = ctx.getImageData(0, 0, size.x, size.y);
          recolor(px.data);
          ctx.putImageData(px, 0, 0);
        } catch {
          // Tainted canvas (no CORS): keep the tile as drawn.
        }
      }
      done(undefined, canvas);
    };
    img.onerror = () => done(new Error('tile failed'), canvas);
    img.src = this.getTileUrl(coords);
    return canvas;
  },
});

// Esri "Light Gray Canvas": a pale, low-detail basemap (land, water, major
// roads) under a faint hillshade, plus a transparent layer with only town and
// road labels.
// Unlike the busy standard OSM render it has no landuse, buildings or POIs.
const ESRI_ROOT = 'https://services.arcgisonline.com/ArcGIS/rest/services';
const ESRI = `${ESRI_ROOT}/Canvas`;
const ATTRIBUTION = '© Esri, HERE, Garmin, © OpenStreetMap contributors';

export function mutedTileLayer(url: string, options: L.TileLayerOptions): L.TileLayer {
  return new (MutedTileLayer as unknown as new (u: string, o: L.TileLayerOptions) => L.TileLayer)(url, options);
}

export function addBasemap(map: L.Map): L.TileLayer {
  const base = mutedTileLayer(`${ESRI}/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`, {
    attribution: ATTRIBUTION,
    maxZoom: 19,
    maxNativeZoom: 16,
  }).addTo(map);
  // Multiply so the relief only darkens slopes and leaves flat land as pale as
  // the base (plain opacity would grey the whole map).
  const relief = mutedTileLayer(`${ESRI_ROOT}/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}`, {
    opacity: 0.35,
    maxZoom: 19,
    maxNativeZoom: 16,
  }).addTo(map);
  relief.getContainer()!.style.mixBlendMode = 'multiply';
  mutedTileLayer(`${ESRI}/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`, {
    maxZoom: 19,
    maxNativeZoom: 16,
  }).addTo(map);
  return base;
}
