// Desktop "modal route" for detail pages (the Pinterest / Dribbble pattern).
//
// Clicking a place or event card (or a map popup) on a wide screen opens its
// detail page in a panel over the explorer instead of navigating away: the URL
// becomes the detail URL (shareable, reload = full page), and closing — ×,
// Esc, a click on the backdrop or the browser's Back — returns to the list
// with filters, scroll position and map view untouched.
//
// The detail page itself is loaded in a same-origin iframe (Base.astro puts it
// in "embed" mode: no header/tab bar, links target the top window). That keeps
// every detail-page script — gallery, minimap, favorite/visited controllers —
// working unchanged, at the cost of one more page boot per open.
//
// History: opening pushes one entry ({__overlay}); every close path goes
// through history.back(), and popstate alone shows/hides the panel, so Back,
// Forward and the UI can never disagree.

const MQ = '(min-width: 1100px)';
const STATE_KEY = '__overlay';

type OverlayState = { [STATE_KEY]?: string } & Record<string, unknown>;

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const overlayUrl = (s: unknown) => (s as OverlayState | null)?.[STATE_KEY];

export function isOverlayEntry(): boolean {
  return typeof overlayUrl(history.state) === 'string';
}

export function initDetailOverlay(root: HTMLElement): void {
  const found = document.querySelector<HTMLDialogElement>('[data-detail-overlay]');
  if (!found || found.dataset.ready) return;
  const dialog: HTMLDialogElement = found;
  dialog.dataset.ready = '1';

  const panel = dialog.querySelector<HTMLElement>('[data-do-panel]')!;
  const body = dialog.querySelector<HTMLElement>('[data-do-body]')!;
  const skeletonTitle = dialog.querySelector<HTMLElement>('[data-do-skeleton-title]');
  const openLink = dialog.querySelector<HTMLAnchorElement>('[data-do-open]')!;
  const prefix = (root.dataset.hrefBase ?? '') + (root.dataset.detailPrefix ?? '/places/');
  const listTitle = document.title;

  let frame: HTMLIFrameElement | null = null;
  let returnFocus: HTMLElement | null = null;
  let closing = false;

  const isDetailHref = (a: HTMLAnchorElement) => {
    if (a.origin !== location.origin) return false;
    const rest = a.pathname.startsWith(prefix) ? a.pathname.slice(prefix.length) : '';
    return /^[^/]+\/?$/.test(rest);
  };

  // ---- show / hide (driven only by history) -------------------------------

  function show(url: string, origin?: DOMRect, name?: string) {
    closing = false;
    dialog.classList.remove('is-closing');
    // Grow out of the card that was clicked (origin-aware), else from centre.
    if (origin && !reduced()) {
      const p = dialog.getBoundingClientRect();
      const x = origin.left + origin.width / 2 - p.left;
      const y = origin.top + origin.height / 2 - p.top;
      panel.style.transformOrigin = `${x}px ${y}px`;
    } else {
      panel.style.transformOrigin = '';
    }
    if (skeletonTitle) skeletonTitle.textContent = name ?? '';
    dialog.classList.remove('is-loaded');
    openLink.href = url;

    frame?.remove();
    frame = document.createElement('iframe');
    frame.className = 'do-frame';
    frame.dataset.detailFrame = '';
    frame.title = name ?? 'Подробнее';
    frame.addEventListener('load', () => {
      dialog.classList.add('is-loaded');
      try {
        const t = frame?.contentDocument?.title;
        if (t) document.title = t;
      } catch {}
    });
    frame.src = url;
    body.append(frame);

    if (!dialog.open) dialog.showModal();
    // Next frame: start the enter transition from the initial state.
    requestAnimationFrame(() => dialog.classList.add('is-open'));
  }

  function hide() {
    if (!dialog.open || closing) return;
    closing = true;
    document.title = listTitle;
    dialog.classList.remove('is-open');
    dialog.classList.add('is-closing');
    const done = () => {
      if (!closing) return;
      closing = false;
      dialog.classList.remove('is-closing', 'is-loaded');
      dialog.close();
      frame?.remove();
      frame = null;
      returnFocus?.focus({ preventScroll: true });
    };
    if (reduced()) done();
    else {
      panel.addEventListener('transitionend', done, { once: true });
      window.setTimeout(done, 320);
    }
  }

  function requestClose() {
    if (isOverlayEntry()) history.back();
    else hide();
  }

  window.addEventListener('popstate', (e) => {
    const url = overlayUrl(e.state);
    if (typeof url === 'string') {
      if (!dialog.open) show(url);
    } else {
      hide();
    }
  });

  // ---- open from cards / map popups ---------------------------------------

  root.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!window.matchMedia(MQ).matches) return;
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');
    if (!a || a.target === '_blank' || !isDetailHref(a)) return;
    e.preventDefault();
    returnFocus = a;
    const card = a.closest<HTMLElement>('[data-item-card]') ?? a;
    const name =
      a.querySelector('h3, .map-pop-title')?.textContent?.trim() || card.dataset.name || undefined;
    history.pushState({ ...((history.state as object) ?? {}), [STATE_KEY]: a.href }, '', a.href);
    show(a.href, card.getBoundingClientRect(), name);
  });

  // Warm the cache while the pointer rests on a card: the panel opens faster.
  const prefetched = new Set<string>();
  root.addEventListener('pointerover', (e) => {
    if (!window.matchMedia(MQ).matches) return;
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');
    if (!a || prefetched.has(a.href) || !isDetailHref(a)) return;
    prefetched.add(a.href);
    const l = document.createElement('link');
    l.rel = 'prefetch';
    l.href = a.href;
    document.head.append(l);
  });

  // ---- close paths ---------------------------------------------------------

  dialog.querySelector('[data-do-close]')?.addEventListener('click', requestClose);
  // Backdrop: the dialog element itself is the full-viewport backdrop area.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) requestClose();
  });
  // Esc on the parent page (focus outside the frame).
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    requestClose();
  });
  // Esc inside the frame, relayed by the embedded page (see Base.astro).
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || !frame || e.source !== frame.contentWindow) return;
    if ((e.data as { type?: string })?.type === 'detail-overlay:close') requestClose();
  });
}
