// Shared behaviour for the popover "filter group" pills used by the places and
// events explorers. A .fgroup contains a [data-fgroup-toggle] summary pill and a
// .fgroup-menu dropdown; clicking the pill opens one group at a time, and a click
// anywhere outside closes them all.

/** Wire open/close (one-at-a-time, close-on-outside-click) for all `.fgroup`. */
export function initFilterGroups(root: HTMLElement): void {
  const groups = Array.from(root.querySelectorAll<HTMLElement>('.fgroup'));
  const MARGIN = 8;

  function clearMenu(g: HTMLElement) {
    const menu = g.querySelector<HTMLElement>('.fgroup-menu');
    if (menu) {
      menu.style.left = '';
      menu.style.right = '';
    }
  }

  // Keep an opened dropdown within the viewport: flip a right-edge overflow to
  // right-align, and pin to the viewport if it would still spill off the left.
  function positionMenu(g: HTMLElement) {
    const menu = g.querySelector<HTMLElement>('.fgroup-menu');
    if (!menu) return;
    menu.style.left = '';
    menu.style.right = '';
    let rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth - MARGIN) {
      menu.style.left = 'auto';
      menu.style.right = '0';
      rect = menu.getBoundingClientRect();
    }
    if (rect.left < MARGIN) {
      menu.style.right = 'auto';
      menu.style.left = `${MARGIN - g.getBoundingClientRect().left}px`;
    }
  }

  groups.forEach((g) => {
    const btn = g.querySelector<HTMLButtonElement>('[data-fgroup-toggle]');
    btn?.addEventListener('click', () => {
      const willOpen = !g.classList.contains('open');
      groups.forEach((o) => {
        const open = o === g && willOpen;
        o.classList.toggle('open', open);
        o.querySelector('[data-fgroup-toggle]')?.setAttribute('aria-expanded', String(open));
        if (!open) clearMenu(o);
      });
      if (willOpen) positionMenu(g);
    });
  });
  document.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.fgroup')) return;
    groups.forEach((g) => {
      g.classList.remove('open');
      g.querySelector('[data-fgroup-toggle]')?.setAttribute('aria-expanded', 'false');
      clearMenu(g);
    });
  });
}

/** Toggle a group's active state and update its count badge (blank when 0). */
export function setGroupCount(root: HTMLElement, key: string, n: number): void {
  const group = root.querySelector<HTMLElement>(`[data-fgroup="${key}"]`);
  if (!group) return;
  group.classList.toggle('active', n > 0);
  const badge = group.querySelector<HTMLElement>('[data-fcount]');
  if (badge) badge.textContent = n > 0 ? String(n) : '';
}
