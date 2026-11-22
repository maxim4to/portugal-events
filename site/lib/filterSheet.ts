// Phone filter sheet: every filter group in one bottom sheet, opened from a
// single «Фильтры» button in the top bar. Filters apply live (the list and
// map update underneath); the footer — in thumb reach — resets or closes
// with the live result count («Показать 120 мест»). Drag the header down or
// tap the backdrop to close.
//
// The page's own filter element (FilterBar / event filters) is moved into the
// sheet while it is open and put back after, so every chip keeps its handlers.

const PHONE = '(max-width: 760px)';

export function initFilterSheet(root: HTMLElement): void {
  const sheet = root.querySelector<HTMLElement>('[data-fsheet]');
  const openBtn = root.querySelector<HTMLButtonElement>('[data-fsheet-open]');
  const body = sheet?.querySelector<HTMLElement>('[data-fsheet-body]');
  const panel = sheet?.querySelector<HTMLElement>('.fsheet-panel');
  const filters = root.querySelector<HTMLElement>('.filter-bar-top .filter-bar, .filter-bar-top .event-filters');
  const badge = root.querySelector<HTMLElement>('[data-fsheet-count]');
  const apply = sheet?.querySelector<HTMLButtonElement>('[data-fsheet-apply]');
  const resetBtn = sheet?.querySelector<HTMLButtonElement>('[data-fsheet-reset]');
  if (!sheet || !openBtn || !body || !panel || !filters) return;

  const home = document.createComment('filters');
  let isOpen = false;
  let lastLabel = '';

  const activeCount = () =>
    Array.from(filters.querySelectorAll<HTMLElement>('[data-fcount]')).reduce(
      (n, el) => n + (Number.parseInt(el.textContent || '', 10) || 0),
      0,
    );
  const pageReset = () => filters.querySelector<HTMLButtonElement>('[data-reset]');

  function paint() {
    const n = activeCount();
    if (badge) {
      badge.textContent = n ? String(n) : '';
      badge.hidden = !n;
    }
    if (resetBtn) resetBtn.disabled = !n && (pageReset()?.hidden ?? true);
    const label = lastLabel || root.dataset.countLabel || '';
    if (apply && label) apply.textContent = `Показать ${label}`;
  }

  root.addEventListener('explorer:count', (e) => {
    lastLabel = (e as CustomEvent<{ label: string }>).detail.label;
    paint();
  });

  function open() {
    if (isOpen || !window.matchMedia(PHONE).matches) return;
    isOpen = true;
    filters.before(home);
    body!.append(filters);
    body!.scrollTop = 0;
    sheet!.hidden = false;
    document.documentElement.classList.add('fsheet-open');
    paint();
    requestAnimationFrame(() => requestAnimationFrame(() => sheet!.classList.add('open')));
    openBtn!.setAttribute('aria-expanded', 'true');
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    sheet!.classList.remove('open');
    panel!.style.transform = '';
    openBtn!.setAttribute('aria-expanded', 'false');
    const done = () => {
      if (isOpen) return;
      sheet!.hidden = true;
      document.documentElement.classList.remove('fsheet-open');
      home.replaceWith(filters);
    };
    let fired = false;
    panel!.addEventListener(
      'transitionend',
      () => {
        if (!fired) {
          fired = true;
          done();
        }
      },
      { once: true },
    );
    window.setTimeout(() => {
      if (!fired) {
        fired = true;
        done();
      }
    }, 450);
  }

  openBtn.addEventListener('click', open);
  sheet.querySelectorAll('[data-fsheet-close]').forEach((el) => el.addEventListener('click', close));
  resetBtn?.addEventListener('click', () => pageReset()?.click());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) close();
  });
  window.matchMedia(PHONE).addEventListener('change', (e) => {
    if (!e.matches) close();
  });

  // Drag the header down to dismiss (distance or a quick flick).
  const handle = sheet.querySelector<HTMLElement>('[data-fsheet-drag]');
  let startY = 0;
  let startT = 0;
  let dy = 0;
  let dragging = false;
  handle?.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    dragging = true;
    startY = e.clientY;
    startT = performance.now();
    dy = 0;
    handle.setPointerCapture(e.pointerId);
    sheet.classList.add('dragging');
  });
  handle?.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dy = e.clientY - startY;
    // Upward drags meet friction instead of a hard stop.
    const y = dy > 0 ? dy : dy / 6;
    panel.style.transform = `translate3d(0, ${y}px, 0)`;
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    sheet.classList.remove('dragging');
    const v = dy / Math.max(1, performance.now() - startT);
    if (dy > 90 || v > 0.6) close();
    else panel.style.transform = '';
  };
  handle?.addEventListener('pointerup', end);
  handle?.addEventListener('pointercancel', end);
}
