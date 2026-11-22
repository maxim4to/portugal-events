import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { gameIcon } from './mapIcons';
import PT_MAINLAND from '../assets/pt-mainland.json';

/** How far the explorer map may pan: mainland Portugal (36.7–42.2°N,
 *  9.8–6.2°W) plus a margin, so the coast isn't pinned to the pane edge.
 *  Outside it there's nothing to show. On the phone the list sheet covers the
 *  lower half of the map, so the frame reaches much further south: the whole
 *  country (and the Algarve on its own) must still fit above the sheet. */
const PT_VIEW_BOUNDS = L.latLngBounds([34.6, -12.4], [43.6, -3.6]);
const PT_VIEW_BOUNDS_PHONE = L.latLngBounds([22.0, -12.4], [43.6, -3.6]);
/** Mainland Portugal's own bounding box (from pt-mainland.json). */
const PT_BOX = L.latLngBounds([36.7, -9.85], [42.16, -6.18]);
import { HALF_AT, initSheet, type SheetSnap } from './mobileSheet';
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
  const viewBounds = () => (isMobile() ? PT_VIEW_BOUNDS_PHONE : PT_VIEW_BOUNDS);

  const emptyEl = root.querySelector<HTMLElement>('[data-empty]')!;
  const countEl = root.querySelector<HTMLElement>('[data-sheet-count]');
  const showAllBtns = Array.from(root.querySelectorAll<HTMLElement>('[data-show-all]'));
  const previewEl = root.querySelector<HTMLElement>('[data-pin-preview]');
  const railEl = root.querySelector<HTMLElement>('[data-peek-rail]');
  const mapEl = root.querySelector<HTMLElement>('[data-map]')!;
  const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-item-card]'));
  const groups = Array.from(root.querySelectorAll<HTMLElement>('[data-group]'));

  const points: MapPoint[] = JSON.parse(
    root.querySelector<HTMLElement>('[data-points]')?.textContent || '[]',
  );
  const pointById = new Map(points.map((p) => [p.id, p]));
  const cardById = new Map(cards.map((c) => [c.dataset.id!, c]));

  // Game-map pins: a colored disc with a per-type glyph (see mapIcons.ts).
  // Favorite swaps the glyph for a heart badge; visited dims the disc. Reads
  // the live state the controllers reflect onto the card.
  const iconFor = (el: HTMLElement) =>
    gameIcon(pointById.get(el.dataset.id!)?.type, {
      favorite: el.dataset.favorite === 'true',
      visited: el.dataset.visited === 'true',
    });

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
  // Phone: the list always follows the map's viewport (the sheet UX depends on
  // it). Desktop: the list stays put while the map moves — an Airbnb-style
  // "search this area" button applies the current view as a one-shot area
  // filter (areaBounds), and "show all" clears it. Guard on a laid-out map: on
  // mobile it is created inside a display:none pane (size 0), whose bounds
  // would otherwise hide everything.
  const boundsMode = () => Boolean(map && map.getSize().x > 0);
  let areaBounds: L.LatLngBounds | null = null;
  const areaSearchBtn = root.querySelector<HTMLElement>('[data-area-search]');
  const areaClearBtn = root.querySelector<HTMLElement>('[data-area-clear]');

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
      insets.bottom = Math.max(insets.bottom, root.clientHeight - Math.round(root.clientHeight * HALF_AT));
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
    const useBounds = isMobile() ? boundsMode() : areaBounds !== null;
    const bounds = !useBounds ? null : isMobile() ? visibleBounds() : areaBounds;
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
    renderRail();
  }

  // ---- Collapsed-sheet rail: compact cards for what's in view ---------------

  const RAIL_MAX = 15;
  let railKey = '';

  // Wikimedia thumbnails are addressable by width, but only a few widths are
  // pre-rendered: others are refused (400) or rate-limited while generated
  // (429). 330px is a cached standard step; on any failure fall back to the
  // stored 1280px URL the rest of the site already loads.
  const smallImage = (url: string) => url.replace(/\/(\d+)px-([^/]+)$/, '/330px-$2');
  const imgTag = (url: string, hide: string) =>
    `<img src="${esc(smallImage(url))}" data-full="${esc(url)}" alt="" decoding="async" referrerpolicy="no-referrer" ` +
    `onerror="if(this.dataset.full&&this.src!==this.dataset.full){this.src=this.dataset.full}else{${hide}}">`;

  function renderRail(force = false) {
    if (!railEl || !isMobile()) return;
    const items: MapPoint[] = [];
    for (const el of root.querySelectorAll<HTMLElement>('[data-item-card]')) {
      if (el.hidden || el.dataset.notinterested === 'true') continue;
      const p = pointById.get(el.dataset.id!);
      if (p) items.push(p);
      if (items.length >= RAIL_MAX) break;
    }
    const key = items.map((p) => p.id).join('|') + (distFix ? `@${distFix.at}` : '');
    if (key === railKey && !force) return;
    railKey = key;
    if (!items.length) {
      railEl.innerHTML = '<span class="rail-empty">Здесь ничего нет — подвиньте карту</span>';
      return;
    }
    railEl.innerHTML = items
      .map((p) => {
        const km = distById.get(p.id);
        const meta =
          km !== undefined
            ? `<span class="rail-meta is-dist">${formatDistance(km)} от вас</span>`
            : p.meta
              ? `<span class="rail-meta">${esc(p.meta)}</span>`
              : '';
        const img = p.image ? imgTag(p.image, "this.style.visibility='hidden'") : '';
        return (
          `<button type="button" class="rail-item" data-rail-id="${esc(p.id)}">` +
          `<span class="rail-thumb">${img}</span><span class="rail-text">` +
          (p.kicker ? `<span class="rail-kicker">${esc(p.kicker)}</span>` : '') +
          `<span class="rail-title">${esc(p.name)}</span>${meta}</span></button>`
        );
      })
      .join('');
    railEl.scrollLeft = 0;
  }

  railEl?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-rail-id]');
    const p = btn ? pointById.get(btn.dataset.railId!) : undefined;
    if (p) openPreview(p);
  });

  function paintCount(visible: number, matching: number) {
    const limited = visible < matching;
    if (countEl) {
      countEl.textContent = limited
        ? `${visible} из ${matching} · в этой области`
        : `${visible} ${pluralRu(visible, NOUN)}`;
    }
    showAllBtns.forEach((b) => (b.hidden = !limited));
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
    if (!markerLayer) {
      // No clustering: every pin is its own icon (game-map style), so a
      // hovered card can always light its pin up. At country zoom the pins
      // shrink instead (see the zoomend handler) to stay readable.
      markerLayer = L.layerGroup().addTo(map);
    }
    markerLayer.clearLayers();
    markerById.clear();
    const batch: L.Marker[] = [];
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
      const marker = L.marker(latlng, { icon: iconFor(el), title: p.name });
      batch.push(marker);
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
    for (const m of batch) markerLayer.addLayer(m);
    if (selectedId) highlightMarker(selectedId, true);
    if (fit && (skipNextFit || holdRestored)) {
      skipNextFit = false;
    } else if (fit) {
      fitTo(pts);
    }
  }

  // While the map shows the automatic framing (nobody has panned/zoomed it by
  // hand), it re-frames itself whenever the sheet changes height.
  let autoFit = true;
  // Moves the code starts (fits, preview pans) must not offer "search this
  // area" — only the user's own pan/zoom does. A programmatic call arms
  // `progMove`; the movestart it triggers consumes it into `moveWasProg`. Any
  // pointer/wheel interaction with the map clears a stale armed flag (left by
  // a no-op call that never fired movestart) so the user's own move counts.
  // Starts true: every move before the first interaction is ours.
  let progMove = false;
  let moveWasProg = true;
  function progCall(fn: () => void) {
    progMove = true;
    fn();
  }

  function showAreaSearch(on: boolean) {
    if (areaSearchBtn) areaSearchBtn.hidden = !on;
  }
  function setAreaMode(b: L.LatLngBounds | null) {
    areaBounds = b;
    if (areaClearBtn) areaClearBtn.hidden = !b;
    showAreaSearch(false);
    updateListVisibility();
  }
  areaSearchBtn?.addEventListener('click', () => {
    if (map) setAreaMode(visibleBounds());
  });
  areaClearBtn?.addEventListener('click', () => {
    setAreaMode(null);
    fitAll();
  });

  function fitTo(pts: L.LatLngExpression[]) {
    if (!map) return;
    autoFit = true;
    const { top, bottom } = fitInsets();
    const pad = isMobile() ? 20 : 40;
    progCall(() => {
      if (pts.length) {
        map!.fitBounds(L.latLngBounds(pts), {
          paddingTopLeft: [pad, top + pad],
          paddingBottomRight: [pad, bottom + pad],
          maxZoom: 12,
        });
      } else {
        map!.setView([39.5, -8.0], 6);
      }
    });
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
      ? `<span class="pp-media">${imgTag(p.image, "this.parentNode.style.visibility='hidden'")}</span>`
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
      progCall(() => map!.panBy(pt.subtract(target), { animate: true }));
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
      // Fractional zoom everywhere: on the phone the country fills the screen
      // instead of jumping a whole level too far out, and on desktop a wheel /
      // trackpad swipe moves in quarter-steps instead of whole-level leaps.
      zoomSnap: 0.25,
      zoomDelta: 0.25,
      scrollWheelZoom: true,
      // A light two-finger trackpad swipe fires a burst of wheel events; with
      // the default 60px-per-level it used to jump several levels at once.
      // Demand far more scroll per level so zooming is gentle and controllable.
      wheelPxPerZoomLevel: 320,
      wheelDebounceTime: 25,
      // The site only covers mainland Portugal: keep the view on it.
      maxBounds: viewBounds(),
      maxBoundsViscosity: 1,
    }).setView([39.5, -8.0], 6);
    // Never zoom out past the frame: at minZoom the whole frame just fits the
    // pane, so there's no "fly off to the rest of the world". Recomputed when
    // the pane resizes (window resize, phone rotation, list/map toggle).
    // The floor is "all of mainland Portugal fits in the visible part of the
    // map" (minus whatever the phone sheet covers), one quarter-step out.
    const syncMinZoom = () => {
      if (!map) return;
      map.setMaxBounds(viewBounds());
      const { top, bottom } = fitInsets();
      const pad = isMobile() ? 16 : 32;
      const fit = map.getBoundsZoom(PT_BOX, false, L.point(2 * pad, top + bottom + 2 * pad));
      const z = Math.floor(fit * 4) / 4 - 0.25;
      map.setMinZoom(z);
      if (map.getZoom() < z) map.setZoom(z, { animate: false });
    };
    syncMinZoom();
    map.on('resize', syncMinZoom);
    // Drop Leaflet's own attribution prefix (which carries a 🇺🇦 flag); keep the
    // OpenStreetMap tile credit added below.
    map.attributionControl.setPrefix(false);
    // Standard OSM tiles, regraded in CSS (see MapShell) into a warm, slightly
    // desaturated "game world" tone under the colored type blips.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
    // Dim everything outside mainland Portugal (a world polygon with a
    // Portugal-shaped hole), so the country reads like the playable area of a
    // game map. Fill color/opacity are theme-aware via .pt-mask in CSS.
    L.polygon(
      [
        [
          [85, -180],
          [85, 180],
          [-85, 180],
          [-85, -180],
        ],
        PT_MAINLAND as [number, number][],
      ],
      { className: 'pt-mask', stroke: false, interactive: false },
    ).addTo(map);
    map.on('movestart', () => {
      moveWasProg = progMove;
      progMove = false;
    });
    map.on('moveend', () => {
      if (isMobile()) {
        if (boundsMode()) updateListVisibility();
      } else if (!moveWasProg) {
        // The user moved the map themselves: offer to sync the list to it.
        showAreaSearch(true);
      }
      saveView();
    });
    // Country zoom: shrink the game pins so a dense coastline stays readable
    // (replaces clustering). CSS keys off the class, no marker rebuild needed.
    const sizePins = () => mapEl.classList.toggle('map-far', map!.getZoom() < 8.5);
    map.on('zoomend', sizePins);
    sizePins();
    map.on('click', closePreview);
    map.on('dragstart', () => (autoFit = false));
    mapEl.addEventListener('wheel', () => (autoFit = false), { passive: true });
    mapEl.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length > 1) autoFit = false;
      },
      { passive: true },
    );
    // The user touching the map (drag, zoom buttons, locate) claims the next
    // move as theirs, clearing any stale programmatic flag.
    const userIntent = () => (progMove = false);
    mapEl.addEventListener('pointerdown', userIntent, { capture: true, passive: true });
    mapEl.addEventListener('wheel', userIntent, { capture: true, passive: true });
    locate = addLocateControl(map, {
      insets: fitInsets,
      onModeChange: (m) => {
        if (m === 'follow') autoFit = false;
      },
    });
    if (restored) {
      map.setView(restored.center, restored.zoom, { animate: false });
      skipNextFit = true;
      holdRestored = true;
      autoFit = false;
      const release = () => (holdRestored = false);
      root.addEventListener('pointerdown', release, { once: true, capture: true });
      window.setTimeout(release, 4000);
      refreshMarkers(false);
    } else {
      refreshMarkers(true);
    }
  }

  /** Full re-render after a filter change: rebuild pins, refit, re-filter list. */
  function rerender() {
    closePreview();
    // While a desktop area filter is applied, filter changes must not refit
    // the map away from the chosen area.
    refreshMarkers(isMobile() || !areaBounds);
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
  // Only a real "back"/"forward" returns to the saved view; a fresh visit (a
  // tab tap, a link with other filters) frames the pins anew.
  const navType = (
    performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  )?.type;
  let isReturn = navType === 'back_forward';
  try {
    if (sessionStorage.getItem('explorer-return') === location.pathname) isReturn = true;
    sessionStorage.removeItem('explorer-return');
  } catch {}
  try {
    const raw = sessionStorage.getItem(viewKey);
    const saved = raw ? (JSON.parse(raw) as SavedView & { search?: string }) : null;
    if (saved && isMobile() && isReturn && (saved.search ?? '') === location.search) {
      restored = saved;
    }
  } catch {}
  let skipNextFit = false;
  // Late re-renders on load (the signed-in sets arriving) mustn't throw the
  // restored view away; the hold ends on the first touch or after a moment.
  let holdRestored = false;

  function saveView() {
    if (!map || !isMobile()) return;
    const c = map.getCenter();
    try {
      sessionStorage.setItem(
        viewKey,
        JSON.stringify({
          snap: sheet.state,
          center: [c.lat, c.lng],
          zoom: map.getZoom(),
          search: location.search,
        }),
      );
    } catch {}
  }

  const sheet = initSheet(root, {
    initial: restored?.snap ?? 'half',
    enabled: isMobile,
    onChange: (state) => {
      if (autoFit && state !== 'full' && map) fitAll();
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
    renderRail(true);
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
    renderRail(true);
  }

  function setNearSort(on: boolean, fromRestore = false) {
    nearSort = on;
    nearBtn?.setAttribute('aria-pressed', String(on));
    try {
      if (on) sessionStorage.setItem(nearKey, '1');
      else sessionStorage.removeItem(nearKey);
    } catch {}
    // Restoring on load never prompts; it sorts once a (resumed) fix lands.
    if (on && !getFix() && !fromRestore) locate?.ensure();
    applySort();
  }

  nearBtn?.addEventListener('click', () => {
    setNearSort(!nearSort);
    listScroll?.scrollTo({ top: 0 });
  });

  onFix(updateDistances);

  // The visited filter can add/remove pins (and the set may land after the
  // first render), so rebuild them — refitting only while auto-framed.
  document.addEventListener('visited:changed', () => {
    refreshMarkers(autoFit);
    updateListVisibility();
  });
  // Favorites don't hide/show cards, but they do change a pin into a heart.
  document.addEventListener('favorites:changed', restyleMarkers);
  // Marking a place not-interested removes/restores its pin. Rebuild the marker
  // layer without refitting, so the map doesn't jump under the user.
  document.addEventListener('notinterested:changed', () => refreshMarkers(false));

  // On resize just let Leaflet re-measure and re-run viewport filtering.
  window.addEventListener('resize', () => {
    sheet.relayout();
    // invalidateSize pans internally — not a user move.
    if (map) progCall(() => map!.invalidateSize());
    updateListVisibility();
  });
  // Crossing the phone breakpoint swaps pin popups for the preview card.
  mobileMq.addEventListener('change', () => {
    closePreview();
    map?.closePopup();
    // The area filter is a desktop concept; crossing the breakpoint resets it
    // (mobile re-filters by viewport live anyway).
    setAreaMode(null);
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
      if (t.closest('.filter-bar-top')) return; // the filter sidebar scrolls itself
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
    if (sessionStorage.getItem(nearKey) === '1') setNearSort(true, true);
  } catch {}
  updateListVisibility();
  // The container height settles after first layout; let Leaflet re-measure so
  // tiles render into the correct size (it pans internally — not a user move).
  requestAnimationFrame(() => {
    if (map) progCall(() => map!.invalidateSize());
  });

  // Restore list scroll position when returning from a detail page. Real
  // navigations aren't always served from bfcache, so `.list-scroll`'s
  // scrollTop otherwise resets to 0 on every "back".
  if (listScroll) {
    const scrollKey = `explorer-scroll:${location.pathname}`;
    try {
      const saved = sessionStorage.getItem(scrollKey);
      if (saved && (isReturn || !isMobile())) listScroll.scrollTop = Number(saved);
    } catch {}
    listScroll.addEventListener(
      'scroll',
      () => {
        try {
          sessionStorage.setItem(scrollKey, String(listScroll.scrollTop));
        } catch {}
      },
      { passive: true },
    );
  }

  return { rerender };
}
