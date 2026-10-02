// Phone (≤760px) bottom sheet for the explorer: the list rides over a
// full-screen map and snaps between three heights — `peek` (just the header,
// map mode), `half`, and `full` (list mode). Dragging the header always moves
// the sheet; dragging the list moves it too unless the list is fully open and
// scrolled (then it scrolls natively, and a pull-down at the very top collapses
// it again — the iOS sheet convention).
//
// Geometry is published as CSS custom properties on the explorer root:
//   --sheet-y    the sheet's translateY from the root's top
//   --map-cover  how many px of the map's bottom edge are covered (sheet or
//                pin preview) — map controls sit just above it.
// Framework-free; the host (mapExplorer) owns persistence and the map.

export type SheetSnap = 'peek' | 'half' | 'full';

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
  const posOf = (s: SheetSnap) =>
    s === 'full' ? 0 : s === 'half' ? Math.round(H() * 0.5) : H() - headH();

  function paint(nextY: number) {
    y = nextY;
    root.style.setProperty('--sheet-y', `${Math.round(y)}px`);
    const cover = away ? awayCover : Math.max(0, H() - y);
    root.style.setProperty('--map-cover', `${Math.round(cover)}px`);
  }

  function apply(animate: boolean) {
    root.classList.toggle('sheet-anim', animate);
    root.classList.toggle('sheet-full', state === 'full' && !away);
    root.classList.toggle('sheet-away', away);
    root.dataset.sheet = away ? 'away' : state;
    root.style.setProperty('--bar-h', `${bar.offsetHeight}px`);
    if (state !== 'full') root.classList.remove('hide-filter-bar');
    paint(away ? H() + 24 : posOf(state));
  }

  function snap(to: SheetSnap, animate = true) {
    const changed = to !== state;
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
        root.classList.remove('sheet-anim');
        root.classList.add('sheet-dragging');
      }
      e.preventDefault();
      const min = posOf('full');
      const max = posOf('peek');
      let next = startSheetY + dy;
      // Rubber-band past the ends.
      if (next < min) next = min - Math.sqrt(min - next) * 2;
      if (next > max) next = max + Math.sqrt(next - max) * 2;
      // Leaving full: the list must stop being the scroller immediately.
      root.classList.toggle('sheet-full', next <= min + 1);
      paint(next);
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
    root.classList.remove('sheet-dragging');
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
      if (state === 'full' && Math.abs(top - lastTop) > 6) {
        root.classList.toggle('hide-filter-bar', top > lastTop && top > 60);
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
