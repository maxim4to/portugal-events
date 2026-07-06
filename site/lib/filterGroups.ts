// Shared behaviour for the popover "filter group" pills used by the places and
// events explorers. A .fgroup contains a [data-fgroup-toggle] summary pill and a
// .fgroup-menu dropdown; clicking the pill opens one group at a time, and a click
// anywhere outside closes them all.

/** Wire open/close (one-at-a-time, close-on-outside-click) for all `.fgroup`. */
export function initFilterGroups(root: HTMLElement): void {
  const groups = Array.from(root.querySelectorAll<HTMLElement>('.fgroup'));
  groups.forEach((g) => {
    const btn = g.querySelector<HTMLButtonElement>('[data-fgroup-toggle]');
    btn?.addEventListener('click', () => {
      const willOpen = !g.classList.contains('open');
      groups.forEach((o) => {
        o.classList.toggle('open', o === g && willOpen);
        o.querySelector('[data-fgroup-toggle]')?.setAttribute(
          'aria-expanded',
          String(o === g && willOpen),
        );
      });
    });
  });
  document.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.fgroup')) return;
    groups.forEach((g) => {
      g.classList.remove('open');
      g.querySelector('[data-fgroup-toggle]')?.setAttribute('aria-expanded', 'false');
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
