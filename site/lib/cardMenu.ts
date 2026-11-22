// Catalog card "⋯" menus (visited / not interested). One open at a time;
// closes on a click outside, Esc, scrolling the list, or shortly after a row
// is used (long enough to see the row flip to its new state).

export function initCardMenus(root: HTMLElement): void {
  let open: HTMLElement | null = null;

  const close = (focusTrigger = false) => {
    if (!open) return;
    const m = open;
    open = null;
    m.classList.remove('open');
    const btn = m.querySelector<HTMLButtonElement>('[data-more-toggle]');
    btn?.setAttribute('aria-expanded', 'false');
    if (focusTrigger) btn?.focus({ preventScroll: true });
  };

  // Capture phase: the row buttons' own controllers stop propagation.
  root.addEventListener(
    'click',
    (e) => {
      const t = e.target as HTMLElement;
      const toggle = t.closest<HTMLButtonElement>('[data-more-toggle]');
      if (toggle) {
        e.preventDefault();
        e.stopPropagation();
        const m = toggle.closest<HTMLElement>('[data-card-more]')!;
        const wasOpen = m === open;
        close();
        if (!wasOpen) {
          m.classList.add('open');
          toggle.setAttribute('aria-expanded', 'true');
          open = m;
          m.querySelector<HTMLButtonElement>('.more-menu button:not([hidden])')?.focus({ preventScroll: true });
        }
        return;
      }
      if (open && open.contains(t)) {
        const m = open;
        window.setTimeout(() => {
          if (open === m) close();
        }, 420);
        return;
      }
      close();
    },
    true,
  );
  document.addEventListener('click', (e) => {
    if (open && !open.contains(e.target as Node)) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      close(true);
    }
  });
  root.querySelector('[data-list-scroll]')?.addEventListener('scroll', () => close(), { passive: true });
}
