import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

export interface MapPoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  type?: string;
}

export interface MapExplorerOptions {
  /** Page-specific filter predicate over a card element. Defaults to always-true. */
  matches?: (card: HTMLElement) => boolean;
}

const PIN_HTML =
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C7.6 2 4 5.6 4 10c0 5.4 7 11.6 7.3 11.9a1 1 0 0 0 1.4 0C13 21.6 20 15.4 20 10c0-4.4-3.6-8-8-8Zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z"/></svg>';

function pluralWord(kind: string, n: number): string {
  const d = n % 10;
  const dd = n % 100;
  if (kind === 'events') {
    if (d === 1 && dd !== 11) return 'событие';
    if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return 'события';
    return 'событий';
  }
  if (d === 1 && dd !== 11) return 'место';
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return 'места';
  return 'мест';
}

/**
 * Wires the two-pane (list + map) explorer: marker/list synchronisation,
 * "search as I move the map" viewport filtering, and the in-place detail
 * slide panel (iframe, so the existing static detail pages render unchanged).
 * Returns `rerender` so the host page can re-run filtering when its own filter
 * controls change.
 */
export function initMapExplorer(root: HTMLElement, options: MapExplorerOptions = {}) {
  const matches = options.matches ?? (() => true);
  const hrefBase = root.dataset.hrefBase ?? '';
  const detailPrefix = root.dataset.detailPrefix ?? '/places/';
  const kind = root.dataset.kind ?? 'places';

  const emptyEl = root.querySelector<HTMLElement>('[data-empty]')!;
  const countEl = root.querySelector<HTMLElement>('[data-count]');
  const mapEl = root.querySelector<HTMLElement>('[data-map]')!;
  const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-item-card]'));
  const groups = Array.from(root.querySelectorAll<HTMLElement>('[data-group]'));

  const points: MapPoint[] = JSON.parse(
    root.querySelector<HTMLElement>('[data-points]')?.textContent || '[]',
  );
  const pointById = new Map(points.map((p) => [p.id, p]));
  const cardById = new Map(cards.map((c) => [c.dataset.id!, c]));

  const pinIcon = L.divIcon({
    className: 'place-pin',
    html: PIN_HTML,
    iconSize: [24, 24],
    iconAnchor: [12, 22],
    popupAnchor: [0, -20],
  });

  let map: L.Map | null = null;
  let markerLayer: L.LayerGroup | null = null;
  const markerById = new Map<string, L.Marker>();

  const detailUrl = (id: string) => `${hrefBase}${detailPrefix}${id}/`;
  // The list is always filtered to the map's viewport. Guard on a laid-out map:
  // on mobile it is created inside a display:none pane (size 0), whose bounds
  // would otherwise hide everything.
  const boundsMode = () => Boolean(map && map.getSize().x > 0);

  // ---- List visibility (filters ∩ optional viewport) -----------------------

  function updateListVisibility() {
    const useBounds = boundsMode();
    const bounds = useBounds ? map!.getBounds() : null;
    let visible = 0;
    for (const el of cards) {
      const id = el.dataset.id!;
      let show = matches(el);
      if (show && bounds) {
        const p = pointById.get(id);
        // Items without a point (e.g. unknown city) stay in the list regardless.
        if (p) show = bounds.contains([p.lat, p.lon]);
      }
      el.hidden = !show;
      if (show) visible++;
    }
    for (const g of groups) {
      g.hidden = !g.querySelector<HTMLElement>('[data-item-card]:not([hidden])');
    }
    if (countEl) countEl.textContent = `${visible} ${pluralWord(kind, visible)}`;
    emptyEl.hidden = visible !== 0;
  }

  // ---- Markers -------------------------------------------------------------

  function highlightCard(id: string, on: boolean) {
    cardById.get(id)?.classList.toggle('is-active', on);
  }

  function highlightMarker(id: string, on: boolean) {
    const el = markerById.get(id)?.getElement();
    if (el) el.classList.toggle('pin-active', on);
  }

  function refreshMarkers(fit: boolean) {
    if (!map) return;
    if (!markerLayer) markerLayer = L.layerGroup().addTo(map);
    markerLayer.clearLayers();
    markerById.clear();
    const pts: L.LatLngExpression[] = [];
    for (const el of cards) {
      if (!matches(el)) continue;
      const p = pointById.get(el.dataset.id!);
      if (!p) continue;
      const latlng: L.LatLngExpression = [p.lat, p.lon];
      pts.push(latlng);
      const marker = L.marker(latlng, { icon: pinIcon, title: p.name })
        .bindPopup(`<a href="${detailUrl(p.id)}">${p.name}</a>`)
        .addTo(markerLayer);
      marker.on('mouseover', () => highlightCard(p.id, true));
      marker.on('mouseout', () => highlightCard(p.id, false));
      marker.on('click', () => {
        const card = cardById.get(p.id);
        if (card) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
      markerById.set(p.id, marker);
    }
    if (fit && pts.length) {
      map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 12 });
    } else if (fit) {
      map.setView([39.5, -8.0], 6);
    }
  }

  function ensureMap() {
    if (map) return;
    // Airbnb-style direct interaction: trackpad/scroll zooms, pinch zooms, drag
    // pans. The map lives in a fixed pane, so wheel-zoom no longer fights the
    // page scroll. wheelPxPerZoomLevel softens the otherwise jumpy trackpad zoom.
    map = L.map(mapEl, {
      scrollWheelZoom: true,
      wheelPxPerZoomLevel: 120,
      wheelDebounceTime: 30,
    }).setView([39.5, -8.0], 6);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
    map.on('moveend', () => {
      if (boundsMode()) updateListVisibility();
    });
    refreshMarkers(true);
  }

  /** Full re-render after a filter change: rebuild pins, refit, re-filter list. */
  function rerender() {
    refreshMarkers(true);
    updateListVisibility();
  }

  // ---- Card ↔ marker hover sync -------------------------------------------

  for (const el of cards) {
    const id = el.dataset.id!;
    el.addEventListener('mouseenter', () => highlightMarker(id, true));
    el.addEventListener('mouseleave', () => highlightMarker(id, false));
  }

  // Card and pin-popup links navigate to the full detail page in the same tab;
  // the browser back button returns to the list. No overlay, no custom button.

  // ---- Mobile list/map toggle ---------------------------------------------

  function setView(view: 'list' | 'map') {
    root.classList.toggle('show-map', view === 'map');
    root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.view === view));
    });
    if (view === 'map') {
      ensureMap();
      setTimeout(() => {
        map?.invalidateSize();
        updateListVisibility();
      }, 0);
    }
  }
  root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((b) =>
    b.addEventListener('click', () => setView(b.dataset.view as 'list' | 'map')),
  );

  document.addEventListener('visited:changed', updateListVisibility);

  // Lock the explorer to the remaining viewport height so the list gets its own
  // scroll area (instead of the whole page scrolling) and the map pane gets a
  // real, non-zero height. On mobile the CSS media query owns the height.
  function sizeToViewport() {
    if (window.innerWidth <= 760) {
      root.style.height = '';
      return;
    }
    const top = root.getBoundingClientRect().top + window.scrollY;
    root.style.height = `${Math.max(480, window.innerHeight - top - 16)}px`;
  }
  sizeToViewport();
  window.addEventListener('resize', () => {
    sizeToViewport();
    map?.invalidateSize();
    updateListVisibility();
  });

  // On wide screens both panes show at once; build the map immediately.
  ensureMap();
  updateListVisibility();
  // The container height settles after first layout; let Leaflet re-measure so
  // tiles render into the correct size.
  requestAnimationFrame(() => map?.invalidateSize());

  return { rerender };
}
