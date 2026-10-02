import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { initSheet, type SheetSnap } from './mobileSheet';
import { distanceKm, formatDistance, pluralRu } from './geo';
import { getFix, onFix, type Fix } from './geolocate';
import { addLocateControl } from './mapLocate';

export interface MapPoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  type?: string;
  /** Optional richer popup content. */
  image?: string;   // pre-thumbed cover URL
  kicker?: string;  // type/category label
  meta?: string;    // one-line context (drive time / date + city, etc.)
}

export interface MapExplorerOptions {
  /** Page-specific filter predicate over a card element. Defaults to always-true. */
  matches?: (card: HTMLElement) => boolean;
}

const PIN_HTML =
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C7.6 2 4 5.6 4 10c0 5.4 7 11.6 7.3 11.9a1 1 0 0 0 1.4 0C13 21.6 20 15.4 20 10c0-4.4-3.6-8-8-8Zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z"/></svg>';

// Favorite places drop as a heart (its bottom tip is the anchor, like a pin).
const HEART_HTML =
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 21S3 14.6 3 8.9C3 5.8 5.3 3.6 8.1 3.6c1.8 0 3.2 1 3.9 2.1.7-1.1 2.1-2.1 3.9-2.1 2.8 0 5.1 2.2 5.1 5.3C21 14.6 12 21 12 21Z"/></svg>';

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

  const kind = root.dataset.kind === 'events' ? 'events' : 'places';
  const NOUN: [string, string, string] =
    kind === 'events' ? ['событие', 'события', 'событий'] : ['место', 'места', 'мест'];
  const mobileMq = window.matchMedia('(max-width: 760px)');
  const isMobile = () => mobileMq.matches;

  const emptyEl = root.querySelector<HTMLElement>('[data-empty]')!;
  const countEl = root.querySelector<HTMLElement>('[data-sheet-count]');
  const areaNote = root.querySelector<HTMLElement>('[data-area-note]');
  const areaText = root.querySelector<HTMLElement>('[data-area-text]');
  const showAllBtns = Array.from(root.querySelectorAll<HTMLElement>('[data-show-all]'));
  const previewEl = root.querySelector<HTMLElement>('[data-pin-preview]');
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
  // Visited places: same pin, dimmed (styled via .place-pin--visited).
  const pinVisitedIcon = L.divIcon({
    className: 'place-pin place-pin--visited',
    html: PIN_HTML,
    iconSize: [24, 24],
    iconAnchor: [12, 22],
    popupAnchor: [0, -20],
  });
  // Favorites: a heart instead of the teardrop pin.
  const pinFavoriteIcon = L.divIcon({
    className: 'place-pin place-pin--favorite',
    html: HEART_HTML,
    iconSize: [24, 24],
    iconAnchor: [12, 22],
    popupAnchor: [0, -20],
  });

  // Favorite wins over visited (a saved place stays a heart); both fall back to
  // the plain pin. Reads the live state the controllers reflect onto the card.
  const iconFor = (el: HTMLElement) =>
    el.dataset.favorite === 'true'
      ? pinFavoriteIcon
      : el.dataset.visited === 'true'
        ? pinVisitedIcon
        : pinIcon;

  const listScroll = root.querySelector<HTMLElement>('[data-list-scroll]');
  let map: L.Map | null = null;
  let locate: ReturnType<typeof addLocateControl> | null = null;
  let markerLayer: L.LayerGroup | null = null;
  const markerById = new Map<string, L.Marker>();

  const detailUrl = (id: string) => `${hrefBase}${detailPrefix}${id}/`;

  const esc = (s: string) =>
    s.replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!),
    );

  // Editorial popup card: cover image, kicker, title, one-line meta, CTA. The
  // whole card links to the detail page. Falls back gracefully when a point
  // carries no image/kicker/meta.
  function popupHtml(p: MapPoint): string {
    const media = p.image
      ? `<span class="map-pop-media"><img src="${esc(p.image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.closest('.map-pop-media').style.display='none'"></span>`
      : '';
    const kicker = p.kicker ? `<span class="map-pop-kicker">${esc(p.kicker)}</span>` : '';
    const meta = p.meta ? `<span class="map-pop-meta">${esc(p.meta)}</span>` : '';
    return (
      `<a class="map-pop" href="${detailUrl(p.id)}">${media}` +
      `<span class="map-pop-body">${kicker}` +
      `<span class="map-pop-title">${esc(p.name)}</span>${meta}` +
      `<span class="map-pop-more">Подробнее →</span></span></a>`
    );
  }
  // The list is always filtered to the map's viewport. Guard on a laid-out map:
  // on mobile it is created inside a display:none pane (size 0), whose bounds
  // would otherwise hide everything.
  const boundsMode = () => Boolean(map && map.getSize().x > 0);

  // On the phone the map is full-screen but its top is under the floating
  // filter row and its bottom under the sheet's header, so "what's on the map"
  // is the strip between them (the map-mode view), whatever the sheet does.
  function mapInsets(): { top: number; bottom: number } {
    if (!isMobile()) return { top: 0, bottom: 0 };
    return { top: sheet.barHeight(), bottom: sheet.peekHeight() };
  }
  // Framing pins: also keep them clear of a half-open sheet.
  function fitInsets(): { top: number; bottom: number } {
    const insets = mapInsets();
    if (isMobile() && sheet.state === 'half') {
      insets.bottom = Math.max(insets.bottom, root.clientHeight - Math.round(root.clientHeight * 0.5));
    }
    return insets;
  }
  function visibleBounds(): L.LatLngBounds {
    const m = map!;
    const { top, bottom } = mapInsets();
    if (!top && !bottom) return m.getBounds();
    const size = m.getSize();
    return L.latLngBounds(
      m.containerPointToLatLng([0, Math.min(top, size.y)]),
      m.containerPointToLatLng([size.x, Math.max(0, size.y - bottom)]),
    );
  }

  // ---- List visibility (filters ∩ optional viewport) -----------------------

  function updateListVisibility() {
    const useBounds = boundsMode();
    const bounds = useBounds ? visibleBounds() : null;
    let visible = 0;
    let matching = 0;
    for (const el of cards) {
      const id = el.dataset.id!;
      let show = matches(el);
      if (show) matching++;
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
    emptyEl.hidden = visible !== 0;
    paintCount(visible, matching);
  }

  function paintCount(visible: number, matching: number) {
    const limited = visible < matching;
    if (countEl) {
      countEl.textContent = limited
        ? `${visible} ${pluralRu(visible, NOUN)} в этой области`
        : `${visible} ${pluralRu(visible, NOUN)}`;
    }
    showAllBtns.forEach((b) => (b.hidden = !limited));
    if (areaNote) areaNote.hidden = !limited;
    if (areaText) areaText.textContent = `${visible} из ${matching} — в области карты`;
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
      // "Not interested" places stay in the list (sunk to the bottom) but drop
      // off the map entirely.
      if (el.dataset.notinterested === 'true') continue;
      const p = pointById.get(el.dataset.id!);
      if (!p) continue;
      const latlng: L.LatLngExpression = [p.lat, p.lon];
      pts.push(latlng);
      const marker = L.marker(latlng, { icon: iconFor(el), title: p.name }).addTo(markerLayer);
      if (isMobile()) {
        // Phone: a docked preview card instead of a fiddly popup.
        marker.on('click', () => openPreview(p));
      } else {
        marker.bindPopup(popupHtml(p), {
          // Fixed width — CSS pins .leaflet-popup-content to 240px; keep
          // Leaflet's own bounds in sync so its autopan/layout math matches.
          className: 'map-pop-popup',
          maxWidth: 240,
          minWidth: 240,
          offset: [0, 4],
        });
        marker.on('mouseover', () => highlightCard(p.id, true));
        marker.on('mouseout', () => highlightCard(p.id, false));
        marker.on('click', () => {
          const card = cardById.get(p.id);
          if (card) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
      }
      markerById.set(p.id, marker);
    }
    if (selectedId) highlightMarker(selectedId, true);
    if (fit && skipNextFit) {
      skipNextFit = false;
    } else if (fit) {
      fitTo(pts);
    }
  }

  function fitTo(pts: L.LatLngExpression[]) {
    if (!map) return;
    const { top, bottom } = fitInsets();
    const pad = isMobile() ? 20 : 40;
    if (pts.length) {
      map.fitBounds(L.latLngBounds(pts), {
        paddingTopLeft: [pad, top + pad],
        paddingBottomRight: [pad, bottom + pad],
        maxZoom: 12,
      });
    } else {
      map.setView([39.5, -8.0], 6);
    }
  }

  /** Frame every pin that passes the current filters. */
  function fitAll() {
    const pts: L.LatLngExpression[] = [];
    for (const el of cards) {
      if (!matches(el) || el.dataset.notinterested === 'true') continue;
      const p = pointById.get(el.dataset.id!);
      if (p) pts.push([p.lat, p.lon]);
    }
    fitTo(pts);
  }

  // ---- Phone pin preview ---------------------------------------------------

  let selectedId: string | null = null;

  function previewHtml(p: MapPoint): string {
    const media = p.image
      ? `<span class="pp-media"><img src="${esc(p.image)}" alt="" decoding="async" referrerpolicy="no-referrer" onerror="this.parentNode.style.visibility='hidden'"></span>`
      : '';
    return (
      `<a class="pp-card" href="${detailUrl(p.id)}">${media}` +
      `<span class="pp-body">` +
      (p.kicker ? `<span class="pp-kicker">${esc(p.kicker)}</span>` : '') +
      `<span class="pp-title">${esc(p.name)}</span>` +
      (p.meta ? `<span class="pp-meta">${esc(p.meta)}</span>` : '') +
      `<span class="pp-dist" data-pp-dist></span>` +
      `<span class="pp-more">Подробнее →</span></span></a>` +
      `<button type="button" class="pp-close" data-pp-close aria-label="Закрыть">` +
      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`
    );
  }

  function openPreview(p: MapPoint) {
    if (!previewEl || !map) return;
    if (selectedId) highlightMarker(selectedId, false);
    selectedId = p.id;
    highlightMarker(p.id, true);
    previewEl.innerHTML = previewHtml(p);
    previewEl.hidden = false;
    previewEl.querySelector('[data-pp-close]')?.addEventListener('click', closePreview);
    paintPreviewDistance();
    document.dispatchEvent(new CustomEvent('explorer:preview', { detail: { id: p.id } }));
    const cover = previewEl.offsetHeight + 12;
    sheet.setAway(true, cover);
    // Keep the chosen pin clear of the card and the filter row.
    const pt = map.latLngToContainerPoint([p.lat, p.lon]);
    const size = map.getSize();
    const top = sheet.barHeight() + 40;
    const bottom = size.y - cover - 40;
    if (pt.y > bottom || pt.y < top || pt.x < 24 || pt.x > size.x - 24) {
      const target = L.point(size.x / 2, (top + bottom) / 2);
      map.panBy(pt.subtract(target), { animate: true });
    }
  }

  function paintPreviewDistance() {
    const el = previewEl?.querySelector<HTMLElement>('[data-pp-dist]');
    const fix = getFix();
    const p = selectedId ? pointById.get(selectedId) : undefined;
    if (el && fix && p) el.textContent = `${formatDistance(distanceKm(fix.lat, fix.lon, p.lat, p.lon))} от вас`;
  }

  function closePreview() {
    if (!previewEl || previewEl.hidden) return;
    previewEl.hidden = true;
    previewEl.innerHTML = '';
    if (selectedId) highlightMarker(selectedId, false);
    selectedId = null;
    sheet.setAway(false);
  }

  function ensureMap() {
    if (map) return;
    // Airbnb-style direct interaction: trackpad/scroll zooms, pinch zooms, drag
    // pans. The map lives in a fixed pane, so wheel-zoom no longer fights the
    // page scroll. wheelPxPerZoomLevel softens the otherwise jumpy trackpad zoom.
    map = L.map(mapEl, {
      // Phone: fractional zoom so the country fills the screen instead of
      // jumping a whole level too far out.
      zoomSnap: isMobile() ? 0.25 : 1,
      scrollWheelZoom: true,
      wheelPxPerZoomLevel: 120,
      wheelDebounceTime: 30,
    }).setView([39.5, -8.0], 6);
    // Drop Leaflet's own attribution prefix (which carries a 🇺🇦 flag); keep the
    // OpenStreetMap tile credit added below.
    map.attributionControl.setPrefix(false);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
    map.on('moveend', () => {
      if (boundsMode()) updateListVisibility();
      saveView();
    });
    map.on('click', closePreview);
    locate = addLocateControl(map, { insets: fitInsets });
    if (restored) {
      map.setView(restored.center, restored.zoom, { animate: false });
      skipNextFit = true;
      refreshMarkers(false);
    } else {
      refreshMarkers(true);
    }
  }

  /** Full re-render after a filter change: rebuild pins, refit, re-filter list. */
  function rerender() {
    refreshMarkers(true);
    updateListVisibility();
  }

  // Swap each existing marker's icon to match the card's current visited/favorite
  // state, without rebuilding/refitting the whole layer (used on toggle events).
  function restyleMarkers() {
    for (const el of cards) {
      markerById.get(el.dataset.id!)?.setIcon(iconFor(el));
    }
  }

  // ---- Card ↔ marker hover sync -------------------------------------------

  for (const el of cards) {
    const id = el.dataset.id!;
    el.addEventListener('mouseenter', () => highlightMarker(id, true));
    el.addEventListener('mouseleave', () => highlightMarker(id, false));
  }

  // Card and pin-popup links navigate to the full detail page in the same tab;
  // the browser back button returns to the list. No overlay, no custom button.

  // ---- Phone sheet + saved view ------------------------------------------

  // The phone view (sheet height, map position, list scroll) survives a trip
  // to a detail page and back, even without the bfcache.
  const viewKey = `explorer-view:${location.pathname}`;
  type SavedView = { snap: SheetSnap; center: [number, number]; zoom: number };
  let restored: SavedView | null = null;
  try {
    const raw = sessionStorage.getItem(viewKey);
    if (raw && isMobile()) restored = JSON.parse(raw) as SavedView;
  } catch {}
  let skipNextFit = false;

  function saveView() {
    if (!map || !isMobile()) return;
    const c = map.getCenter();
    try {
      sessionStorage.setItem(
        viewKey,
        JSON.stringify({ snap: sheet.state, center: [c.lat, c.lng], zoom: map.getZoom() }),
      );
    } catch {}
  }

  const sheet = initSheet(root, {
    initial: restored?.snap ?? 'half',
    enabled: isMobile,
    onChange: () => {
      saveView();
    },
  });

  root.querySelector('[data-to-map]')?.addEventListener('click', () => sheet.snap('peek'));
  showAllBtns.forEach((b) =>
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      fitAll();
    }),
  );

  // Tapping the already-active tab: back to the top of the list, or — over
  // the map — back to the full picture.
  document.addEventListener('tabbar:reselect', () => {
    if (previewEl && !previewEl.hidden) {
      closePreview();
    } else if (sheet.state === 'full') {
      if (listScroll && listScroll.scrollTop > 0) {
        listScroll.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        sheet.snap('half');
      }
    } else {
      fitAll();
    }
  });

  addEventListener('pagehide', saveView);

  // ---- Distance from the visitor + "Рядом" sort ---------------------------

  const distById = new Map<string, number>();
  let distFix: Fix | null = null;

  function updateDistances(fix: Fix) {
    // Ignore jitter: only recompute after a real move.
    if (distFix && distanceKm(distFix.lat, distFix.lon, fix.lat, fix.lon) < 0.1) return;
    const moved = distFix ? distanceKm(distFix.lat, distFix.lon, fix.lat, fix.lon) : Infinity;
    distFix = fix;
    for (const el of cards) {
      const p = pointById.get(el.dataset.id!);
      const badge = el.querySelector<HTMLElement>('[data-dist]');
      if (!p) continue;
      const km = distanceKm(fix.lat, fix.lon, p.lat, p.lon);
      distById.set(p.id, km);
      if (badge) {
        badge.textContent = formatDistance(km);
        badge.hidden = false;
      }
    }
    paintPreviewDistance();
    // Re-sort only on a sizeable move, so the list doesn't shuffle under you.
    if (nearSort && moved > 2) applySort();
  }

  const nearBtn = root.querySelector<HTMLButtonElement>('[data-sort-near]');
  const nearKey = `explorer-near:${location.pathname}`;
  const originalIndex = new Map(cards.map((c, i) => [c, i]));
  const sortParents = [...new Set(cards.map((c) => c.parentElement!))];
  let nearSort = false;

  function applySort() {
    const byOriginal = (a: HTMLElement, b: HTMLElement) =>
      originalIndex.get(a)! - originalIndex.get(b)!;
    const byDistance = (a: HTMLElement, b: HTMLElement) =>
      (distById.get(a.dataset.id!) ?? Infinity) - (distById.get(b.dataset.id!) ?? Infinity) ||
      byOriginal(a, b);
    const sorted = nearSort && distById.size > 0;
    for (const parent of sortParents) {
      cards
        .filter((c) => c.parentElement === parent)
        .sort(sorted ? byDistance : byOriginal)
        .forEach((c) => parent.appendChild(c));
    }
  }

  function setNearSort(on: boolean) {
    nearSort = on;
    nearBtn?.setAttribute('aria-pressed', String(on));
    try {
      if (on) sessionStorage.setItem(nearKey, '1');
      else sessionStorage.removeItem(nearKey);
    } catch {}
    if (on && !getFix()) locate?.ensure();
    applySort();
  }

  nearBtn?.addEventListener('click', () => {
    setNearSort(!nearSort);
    listScroll?.scrollTo({ top: 0 });
  });

  onFix(updateDistances);

  document.addEventListener('visited:changed', () => {
    updateListVisibility();
    restyleMarkers();
  });
  // Favorites don't hide/show cards, but they do change a pin into a heart.
  document.addEventListener('favorites:changed', restyleMarkers);
  // Marking a place not-interested removes/restores its pin. Rebuild the marker
  // layer without refitting, so the map doesn't jump under the user.
  document.addEventListener('notinterested:changed', () => refreshMarkers(false));

  // On resize just let Leaflet re-measure and re-run viewport filtering.
  window.addEventListener('resize', () => {
    sheet.relayout();
    map?.invalidateSize();
    updateListVisibility();
  });
  // Crossing the phone breakpoint swaps pin popups for the preview card.
  mobileMq.addEventListener('change', () => {
    closePreview();
    map?.closePopup();
    refreshMarkers(false);
  });

  // With the page locked to the viewport, a wheel over the filter bar, gaps or
  // header would otherwise do nothing. Route any vertical wheel that isn't over
  // the map (which zooms) or an open dropdown (which scrolls itself) into the
  // list, so scrolling anywhere scrolls the list. Desktop two-pane only.
  window.addEventListener(
    'wheel',
    (e) => {
      if (window.innerWidth <= 760 || !listScroll) return;
      const t = e.target as HTMLElement;
      if (t.closest('[data-map]')) return; // map handles its own zoom
      if (t.closest('.fgroup-menu')) return; // let an open dropdown scroll
      if (t.closest('[data-list-scroll]')) return; // native scroll already works
      listScroll.scrollTop += e.deltaY;
      e.preventDefault();
    },
    { passive: false },
  );

  // On wide screens both panes show at once; build the map immediately.
  ensureMap();
  const cachedFix = getFix();
  if (cachedFix) updateDistances(cachedFix);
  try {
    if (sessionStorage.getItem(nearKey) === '1') setNearSort(true);
  } catch {}
  updateListVisibility();
  // The container height settles after first layout; let Leaflet re-measure so
  // tiles render into the correct size.
  requestAnimationFrame(() => map?.invalidateSize());

  // Restore list scroll position when returning from a detail page. Real
  // navigations aren't always served from bfcache, so `.list-scroll`'s
  // scrollTop otherwise resets to 0 on every "back".
  if (listScroll) {
    const scrollKey = `explorer-scroll:${location.pathname}`;
    const saved = sessionStorage.getItem(scrollKey);
    if (saved) listScroll.scrollTop = Number(saved);
    listScroll.addEventListener(
      'scroll',
      () => sessionStorage.setItem(scrollKey, String(listScroll.scrollTop)),
      { passive: true },
    );
  }

  return { rerender };
}
