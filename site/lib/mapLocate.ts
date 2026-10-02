// "Where am I" on a Leaflet map: a blue dot with an accuracy halo, plus a
// locate button with Apple-Maps-like modes:
//   off      → nothing shown; tap asks for the position
//   locating → waiting for the first fix (button pulses)
//   follow   → the map keeps the dot centred (filled arrow)
//   shown    → dot visible, map free (outline arrow); tap recentres → follow
// Panning the map by hand drops `follow` to `shown`.

import L from 'leaflet';
import {
  getFix,
  isActive,
  onFix,
  onGeoError,
  requestLocation,
  resumeIfGranted,
  type Fix,
} from './geolocate';
import { showToast } from './toast';

export type LocateMode = 'off' | 'locating' | 'follow' | 'shown';

interface Options {
  /** Map edges hidden under overlays — the dot is centred between them. */
  insets?: () => { top: number; bottom: number };
  followZoom?: number;
  onModeChange?: (mode: LocateMode) => void;
}

const ARROW =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 3.5 3.8 10.4c-.7.3-.6 1.3.1 1.5l6.6 1.6 1.6 6.6c.2.7 1.2.8 1.5.1z"/></svg>';

export function addLocateControl(map: L.Map, opts: Options = {}) {
  const followZoom = opts.followZoom ?? 12;
  let mode: LocateMode = 'off';
  let dot: L.Marker | null = null;
  let halo: L.Circle | null = null;
  let btn: HTMLButtonElement;

  const Control = L.Control.extend({
    onAdd() {
      const wrap = L.DomUtil.create('div', 'leaflet-bar locate-ctl');
      btn = L.DomUtil.create('button', 'locate-btn', wrap) as HTMLButtonElement;
      btn.type = 'button';
      btn.innerHTML = ARROW;
      btn.setAttribute('aria-label', 'Моё местоположение');
      L.DomEvent.disableClickPropagation(wrap);
      L.DomEvent.on(btn, 'click', onTap);
      return wrap;
    },
  });
  new Control({ position: 'bottomright' }).addTo(map);

  function setMode(next: LocateMode) {
    mode = next;
    btn.dataset.mode = next;
    btn.setAttribute('aria-pressed', String(next === 'follow'));
    opts.onModeChange?.(next);
  }

  function centreOn(fix: Fix, fly: boolean) {
    const { top, bottom } = opts.insets?.() ?? { top: 0, bottom: 0 };
    const zoom = fly ? Math.max(map.getZoom(), followZoom) : map.getZoom();
    // Put the dot in the middle of the uncovered strip, not the raw centre.
    const p = map.project([fix.lat, fix.lon], zoom).add([0, (bottom - top) / 2]);
    const target = map.unproject(p, zoom);
    if (fly) map.flyTo(target, zoom, { duration: 0.8 });
    else map.panTo(target, { animate: true });
  }

  function paint(fix: Fix) {
    const ll: L.LatLngExpression = [fix.lat, fix.lon];
    if (!dot) {
      halo = L.circle(ll, {
        radius: fix.accuracy,
        className: 'me-halo',
        interactive: false,
        weight: 1,
      }).addTo(map);
      dot = L.marker(ll, {
        icon: L.divIcon({ className: 'me-dot', html: '<span></span>', iconSize: [22, 22] }),
        interactive: false,
        keyboard: false,
        zIndexOffset: 2000,
      }).addTo(map);
    } else {
      dot.setLatLng(ll);
      halo!.setLatLng(ll).setRadius(fix.accuracy);
    }
    // A very coarse fix (city-level) shouldn't paint a giant disc.
    halo!.setStyle({ opacity: fix.accuracy > 3000 ? 0 : 1, fillOpacity: fix.accuracy > 3000 ? 0 : 0.12 });
  }

  function onTap() {
    const fix = getFix();
    if (mode === 'off' || !isActive()) {
      setMode('locating');
      requestLocation();
      if (fix) {
        paint(fix);
        centreOn(fix, true);
        setMode('follow');
      }
    } else if (fix) {
      centreOn(fix, true);
      setMode('follow');
    }
  }

  onFix((fix) => {
    paint(fix);
    if (mode === 'locating') {
      centreOn(fix, true);
      setMode('follow');
    } else if (mode === 'follow') {
      centreOn(fix, false);
    } else if (mode === 'off') {
      setMode('shown');
    }
  });

  onGeoError((err) => {
    if (mode === 'locating' || err === 'denied') setMode(dot ? 'shown' : 'off');
    if (err === 'denied') {
      showToast(
        'Нет доступа к геопозиции. Разрешите его: Настройки → Конфиденциальность → Службы геолокации.',
        6000,
      );
    } else if (err === 'unsupported') {
      showToast('Этот браузер не умеет определять местоположение.');
    } else if (mode !== 'shown' && mode !== 'follow') {
      showToast('Не удалось определить местоположение. Попробуйте ещё раз.');
    }
  });

  map.on('dragstart', () => {
    if (mode === 'follow') setMode('shown');
  });

  setMode('off');
  const cached = getFix();
  void resumeIfGranted().then((resumed) => {
    if (resumed && cached) {
      paint(cached);
      setMode('shown');
    }
  });

  return {
    get mode() {
      return mode;
    },
    /** Ask for the position without moving the map (e.g. for sorting). */
    ensure() {
      if (!isActive()) {
        if (mode === 'off') setMode('shown');
        requestLocation();
      }
    },
  };
}
