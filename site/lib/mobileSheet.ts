// Phone (≤760px) bottom sheet for the explorer: the list rides over a
// full-screen map and snaps between three heights — `peek` (just the header,
// map mode), `half`, and `full` (list mode). Dragging the header always moves
// the sheet; dragging the list moves it too unless the list is fully open and
// scrolled (then it scrolls natively, and a pull-down at the very top collapses
// it again — the iOS sheet convention).
//
// Moves are transform-only, written straight onto the sheet and the map's
// bottom control corners (which ride just above whatever covers the map). No
// custom properties on the root and no measuring per frame: either would make
// the browser restyle/re-lay out the whole 200+ card list on every finger move.
// Framework-free; the host (mapExplorer) owns persistence and the map.

export type SheetSnap = 'peek' | 'half' | 'full';

/** Half-open sheet top, as a fraction of the explorer height. Low enough that
    the first card's title shows under its photo. */
export const HALF_AT = 0.44;

export interface SheetController {
  readonly state: SheetSnap;
  snap(to: SheetSnap, animate?: boolean): void;
  /** Slide the sheet fully away (e.g. while a pin preview is up) and back. */
  setAway(away: boolean, coverPx?: number): void;
  /** Re-measure after a resize / layout change. */
  relayout(): void;
  /** Height of the map area the sheet leaves free in map mode (peek). */
  peekHeight(): number;
  barHeight(): number;
}

interface Options {
  initial: SheetSnap;
  /** False while the phone layout is off (wider screens): ignore gestures. */
  enabled: () => boolean;
  onChange?: (state: SheetSnap) => void;
}

const ORDER: SheetSnap[] = ['full', 'half', 'peek'];

export function initSheet(root: HTMLElement, opts: Options): SheetController {
  const sheet = root.querySelector<HTMLElement>('[data-sheet]')!;
  const head = root.querySelector<HTMLElement>('[data-sheet-handle]')!;
  const scroll = root.querySelector<HTMLElement>('[data-list-scroll]')!;
  const bar = root.querySelector<HTMLElement>('.filter-bar-top')!;

  let state: SheetSnap = opts.initial;
  let away = false;
  let awayCover = 0;
  let y = 0;

  const H = () => root.clientHeight;
  const headH = () => head.offsetHeight || 56;
  // Fully open, the sheet starts below the filter bar — or at the very top
  // while the bar is tucked away during a scroll down the list.
  const fullY = () => (root.classList.contains('hide-filter-bar') ? 0 : bar.offsetHeight);
  const posOf = (s: SheetSnap) =>
    s === 'full' ? fullY() : s === 'half' ? Math.round(H() * HALF_AT) : H() - headH();

  // Leaflet creates its control corners after the sheet starts; look them up
  // lazily and keep them.
  let corners: HTMLElement[] = [];
  const mapCorners = () => {
    if (corners.length < 2) {
      corners = Array.from(root.querySelectorAll<HTMLElement>('.pane-map .leaflet-bottom'));
    }
    return corners;
  };
  let lastCover = -1;
  let lastBarH = -1;

  function paint(nextY: number, height = H()) {
    y = nextY;
    if (!opts.enabled()) {
      // Wide screens: the list is a normal pane again.
      sheet.style.transform = '';
      mapCorners().forEach((el) => (el.style.transform = ''));
      lastCover = -1;
      return;
    }
    sheet.style.transform = `translate3d(0, ${Math.round(y)}px, 0)`;
    const cover = Math.round(away ? awayCover : Math.max(0, height - y));
    if (cover !== lastCover) {
      lastCover = cover;
      mapCorners().forEach((el) => (el.style.transform = `translate3d(0, ${-cover}px, 0)`));
    }
  }

  function apply(animate: boolean) {
    root.classList.toggle('sheet-anim', animate);
    root.classList.toggle('sheet-full', state === 'full' && !away);
    root.classList.toggle('sheet-away', away);
    root.dataset.sheet = away ? 'away' : state;
    const barH = bar.offsetHeight;
    if (barH !== lastBarH) {
      lastBarH = barH;
      root.style.setProperty('--bar-h', `${barH}px`);
    }
    if (state !== 'full') root.classList.remove('hide-filter-bar');
    paint(away ? H() + 24 : posOf(state));
  }

  function snap(to: SheetSnap, animate = true) {
    const changed = to !== state;
    // Below full the list can't scroll, so don't leave it parked mid-way.
    if (state === 'full' && to !== 'full') scroll.scrollTo({ top: 0, behavior: 'smooth' });
    state = to;
    away = false;
    apply(animate);
    if (changed) opts.onChange?.(state);
  }

  // ---- Drag ---------------------------------------------------------------

  let startX = 0;
  let startY = 0;
  let startSheetY = 0;
  let mode: 'idle' | 'pending' | 'drag' | 'native' = 'idle';
  let fromHead = false;
  let samples: { t: number; y: number }[] = [];
  // Measured once per gesture, not per frame.
  let dragMin = 0;
  let dragMax = 0;
  let dragH = 0;
  let pendingY: number | null = null;
  let frame = 0;
  let fullClass = false;

  function flush() {
    frame = 0;
    if (pendingY === null) return;
    const next = pendingY;
    pendingY = null;
    // Leaving full: the list must stop being the scroller right away. Only
    // touch the class when it actually flips — it restyles the whole list.
    const atTop = next <= dragMin + 1;
    if (atTop !== fullClass) {
      fullClass = atTop;
      root.classList.toggle('sheet-full', atTop);
    }
    paint(next, dragH);
  }

  sheet.addEventListener(
    'touchstart',
    (e) => {
      if (away || e.touches.length !== 1 || !opts.enabled()) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startSheetY = y;
      fromHead = head.contains(e.target as Node);
      mode = 'pending';
      samples = [{ t: e.timeStamp, y: startY }];
    },
    { passive: true },
  );

  sheet.addEventListener(
    'touchmove',
    (e) => {
      if (mode === 'idle' || mode === 'native' || e.touches.length !== 1) return;
      const cx = e.touches[0].clientX;
      const cy = e.touches[0].clientY;
      const dx = cx - startX;
      const dy = cy - startY;
      if (mode === 'pending') {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        if (Math.abs(dx) > Math.abs(dy)) {
          // Horizontal: a photo-gallery swipe, not ours.
          mode = 'native';
          return;
        }
        const listAtTop = scroll.scrollTop <= 0;
        mode =
          fromHead || state !== 'full' || (listAtTop && dy > 0) ? 'drag' : 'native';
        if (mode === 'native') return;
        dragH = H();
        dragMin = posOf('full');
        dragMax = dragH - headH();
        fullClass = root.classList.contains('sheet-full');
        // Follow the finger 1:1 — inline, so no class flips on the root.
        sheet.style.transition = 'none';
        mapCorners().forEach((el) => (el.style.transition = 'none'));
      }
      e.preventDefault();
      let next = startSheetY + dy;
      // Rubber-band past the ends.
      if (next < dragMin) next = dragMin - Math.sqrt(dragMin - next) * 2;
      if (next > dragMax) next = dragMax + Math.sqrt(next - dragMax) * 2;
      pendingY = next;
      if (!frame) frame = requestAnimationFrame(flush);
      samples.push({ t: e.timeStamp, y: cy });
      if (samples.length > 5) samples.shift();
    },
    { passive: false },
  );

  function endDrag() {
    if (mode !== 'drag') {
      mode = 'idle';
      return;
    }
    mode = 'idle';
    if (frame) cancelAnimationFrame(frame);
    flush();
    sheet.style.transition = '';
    mapCorners().forEach((el) => (el.style.transition = ''));
    const a = samples[0];
    const b = samples[samples.length - 1];
    const v = b && a && b.t > a.t ? (b.y - a.y) / (b.t - a.t) : 0; // px/ms
    const projected = y + v * 180;
    let best: SheetSnap = state;
    let bestD = Infinity;
    for (const s of ORDER) {
      const d = Math.abs(posOf(s) - projected);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    // A clear flick always moves at least one step in its direction.
    if (Math.abs(v) > 0.45 && best === state) {
      const i = ORDER.indexOf(state) + (v > 0 ? 1 : -1);
      best = ORDER[Math.max(0, Math.min(ORDER.length - 1, i))];
    }
    snap(best);
  }
  sheet.addEventListener('touchend', endDrag);
  sheet.addEventListener('touchcancel', endDrag);

  // Tap the header: step the sheet open (peek → half → full → peek).
  head.addEventListener('click', (e) => {
    if (!opts.enabled()) return;
    if ((e.target as HTMLElement).closest('button:not([data-sheet-handle])')) return;
    snap(state === 'peek' ? 'half' : state === 'half' ? 'full' : 'peek');
  });

  // ---- List mode: tuck the filter bar away while reading down the list -----

  let lastTop = scroll.scrollTop;
  scroll.addEventListener(
    'scroll',
    () => {
      const top = scroll.scrollTop;
      if (state === 'full' && !away && Math.abs(top - lastTop) > 6) {
        const hide = top > lastTop && top > 60;
        if (hide !== root.classList.contains('hide-filter-bar')) {
          root.classList.toggle('hide-filter-bar', hide);
          apply(true);
        }
      }
      if (Math.abs(top - lastTop) > 6 || top <= 0) lastTop = top;
    },
    { passive: true },
  );

  apply(false);
  opts.onChange?.(state);

  return {
    get state() {
      return state;
    },
    snap,
    setAway(next: boolean, coverPx = 0) {
      away = next;
      awayCover = coverPx;
      apply(true);
    },
    relayout() {
      apply(false);
    },
    peekHeight: headH,
    barHeight: () => bar.offsetHeight,
  };
}
