import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

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

  const emptyEl = root.querySelector<HTMLElement>('[data-empty]')!;
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

  let map: L.Map | null = null;
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
      // "Not interested" places stay in the list (sunk to the bottom) but drop
      // off the map entirely.
      if (el.dataset.notinterested === 'true') continue;
      const p = pointById.get(el.dataset.id!);
      if (!p) continue;
      const latlng: L.LatLngExpression = [p.lat, p.lon];
      pts.push(latlng);
      const marker = L.marker(latlng, { icon: iconFor(el), title: p.name })
        .bindPopup(popupHtml(p), {
          // Fixed width — CSS pins .leaflet-popup-content to 240px; keep
          // Leaflet's own bounds in sync so its autopan/layout math matches.
          className: 'map-pop-popup',
          maxWidth: 240,
          minWidth: 240,
          offset: [0, 4],
        })
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
    // Drop Leaflet's own attribution prefix (which carries a 🇺🇦 flag); keep the
    // OpenStreetMap tile credit added below.
    map.attributionControl.setPrefix(false);
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

  // ---- Mobile list/map toggle ---------------------------------------------

  function setView(view: 'list' | 'map') {
    root.classList.toggle('show-map', view === 'map');
    root.classList.remove('hide-filter-bar');
    lastScrollY = window.scrollY;
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
    map?.invalidateSize();
    updateListVisibility();
  });

  // Mobile list view: the whole page scrolls (desktop and the map view stay
  // locked to the viewport, see Base/MapShell). Hide the sticky filter bar when
  // scrolling down into the list, reveal it on any scroll back up.
  let lastScrollY = window.scrollY;
  let scrollTicking = false;
  function onPageScroll() {
    const y = window.scrollY;
    const active = window.innerWidth <= 760 && !root.classList.contains('show-map');
    if (!active) {
      root.classList.remove('hide-filter-bar');
    } else if (Math.abs(y - lastScrollY) > 6) {
      // Keep it visible near the very top; hide only once scrolled past it.
      root.classList.toggle('hide-filter-bar', y > lastScrollY && y > 80);
    }
    lastScrollY = y;
    scrollTicking = false;
  }
  window.addEventListener(
    'scroll',
    () => {
      if (scrollTicking) return;
      scrollTicking = true;
      requestAnimationFrame(onPageScroll);
    },
    { passive: true },
  );

  // With the page locked to the viewport, a wheel over the filter bar, gaps or
  // header would otherwise do nothing. Route any vertical wheel that isn't over
  // the map (which zooms) or an open dropdown (which scrolls itself) into the
  // list, so scrolling anywhere scrolls the list. Desktop two-pane only.
  const listScroll = root.querySelector<HTMLElement>('[data-list-scroll]');
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
