import L from 'leaflet';
import { GEO_UNSUPPORTED, geolocationErrorMessage } from './geoMessages.ts';

/**
 * "Где я" — on-demand geolocation for the explorer map.
 *
 * Nothing is requested on load: the browser permission prompt only appears
 * after the user presses the control, and the position is then kept for the
 * session so later presses just re-centre on it (while a fresh fix is fetched
 * in the background).
 */

/** Crosshair, same 24px box as the place pins. */
const LOCATE_ICON =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/></svg>';

/** Blue dot with a white ring — the conventional "you are here" marker. */
const ME_HTML = '<span class="me-pin-dot"></span>';

/** Zoom to settle on when jumping to the user, unless already zoomed in more. */
const LOCATE_ZOOM = 13;

export interface LocateControl {
  /** Trigger the same flow as a press on the button. */
  locate(): void;
}

export function attachLocateControl(map: L.Map): LocateControl {
  const meIcon = L.divIcon({
    className: 'me-pin',
    html: ME_HTML,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

  let marker: L.Marker | null = null;
  let accuracy: L.Circle | null = null;
  let last: L.LatLng | null = null;
  let busy = false;
  let toastTimer: number | undefined;

  // --- Button (a plain Leaflet bar control, so it matches the zoom buttons) --
  const Control = L.Control.extend({
    options: { position: 'topleft' },
    onAdd() {
      const bar = L.DomUtil.create('div', 'leaflet-bar leaflet-control locate-control');
      const link = L.DomUtil.create('a', 'locate-btn', bar) as HTMLAnchorElement;
      link.href = '#';
      link.title = 'Показать моё местоположение';
      link.setAttribute('role', 'button');
      link.setAttribute('aria-label', 'Показать моё местоположение');
      link.innerHTML = LOCATE_ICON;
      L.DomEvent.on(link, 'click', L.DomEvent.stopPropagation)
        .on(link, 'click', L.DomEvent.preventDefault)
        .on(link, 'click', () => run())
        .on(link, 'dblclick', L.DomEvent.stopPropagation);
      btn = link;
      return bar;
    },
  });
  let btn: HTMLAnchorElement | null = null;
  new Control().addTo(map);

  // --- Transient message strip (permission denied, timeout, ...) ------------
  function toast(text: string) {
    const container = map.getContainer();
    let el = container.querySelector<HTMLElement>('.locate-toast');
    if (!el) {
      el = L.DomUtil.create('div', 'locate-toast', container);
      el.setAttribute('role', 'status');
    }
    el.textContent = text;
    el.classList.add('is-shown');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => el?.classList.remove('is-shown'), 4000);
  }

  function setBusy(on: boolean) {
    busy = on;
    btn?.classList.toggle('is-busy', on);
  }

  function flyTo(latlng: L.LatLng) {
    map.flyTo(latlng, Math.max(map.getZoom(), LOCATE_ZOOM), { duration: 0.8 });
  }

  function run() {
    if (busy) return;
    // A position from earlier in the session: move there right away, then
    // refresh it in the background so the dot doesn't lag behind the user.
    if (last) flyTo(last);
    if (!('geolocation' in navigator)) {
      toast(GEO_UNSUPPORTED);
      return;
    }
    setBusy(true);
    // Leaflet's wrapper around navigator.geolocation — fires locationfound /
    // locationerror below. setView:false so we animate with flyTo ourselves.
    map.locate({
      setView: false,
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 30000,
    });
  }

  map.on('locationfound', (e: L.LocationEvent) => {
    setBusy(false);
    last = e.latlng;
    if (marker) {
      marker.setLatLng(e.latlng);
    } else {
      marker = L.marker(e.latlng, {
        icon: meIcon,
        // Above the place pins, but it isn't a result — keep it unclickable so
        // it never swallows a tap meant for a pin underneath.
        interactive: false,
        keyboard: false,
        zIndexOffset: 1000,
      }).addTo(map);
    }
    // Accuracy halo, only when it is coarse enough to be worth drawing.
    const radius = e.accuracy ?? 0;
    if (radius > 30) {
      if (accuracy) accuracy.setLatLng(e.latlng).setRadius(radius);
      else accuracy = L.circle(e.latlng, { radius, className: 'me-accuracy', interactive: false }).addTo(map);
    } else if (accuracy) {
      accuracy.remove();
      accuracy = null;
    }
    btn?.classList.add('is-located');
    flyTo(e.latlng);
  });

  map.on('locationerror', (e: L.ErrorEvent & { code?: number }) => {
    setBusy(false);
    toast(geolocationErrorMessage(e));
  });

  return { locate: run };
}
