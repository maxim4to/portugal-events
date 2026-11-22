// Shared caption for the catalog card actions (favorite / visited / not
// interested). The buttons are fixed-size icons; hovering one fills the
// row's single caption (.ca-label) with that button's current label. Moving
// between buttons only swaps the caption's text and width — nothing the
// cursor is aiming at ever moves (the dock-label / toolbar-hint pattern).
//
// First reveal waits a beat so sweeping across a card doesn't flash it;
// once open, switching between buttons is instant.

const OPEN_DELAY = 220;
const CLOSE_DELAY = 120;

export function initCardActionLabels(root: HTMLElement): void {
  if (!window.matchMedia('(hover: hover) and (min-width: 761px)').matches) return;

  let row: HTMLElement | null = null;
  let openTimer = 0;
  let closeTimer = 0;

  const labelOf = (btn: HTMLElement) =>
    btn.querySelector('[class$="-label"]')?.textContent?.trim() ?? '';

  function paint(r: HTMLElement, btn: HTMLElement, animate: boolean) {
    const cap = r.querySelector<HTMLElement>('.ca-label');
    const text = cap?.querySelector<HTMLElement>('.ca-text');
    if (!cap || !text) return;
    const next = labelOf(btn);
    if (text.textContent !== next) {
      text.textContent = next;
      if (animate) {
        text.classList.remove('swap');
        void text.offsetWidth;
        text.classList.add('swap');
      }
    }
    cap.style.width = `${text.offsetWidth}px`;
    cap.classList.add('is-on');
  }

  function close(r: HTMLElement) {
    const cap = r.querySelector<HTMLElement>('.ca-label');
    if (!cap) return;
    cap.classList.remove('is-on');
    cap.style.width = '0px';
  }

  root.addEventListener('pointerover', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.card-actions .icon-tip');
    if (!btn) return;
    const r = btn.closest<HTMLElement>('.card-actions')!;
    clearTimeout(closeTimer);
    if (row && row !== r) {
      close(row);
      row = null;
    }
    const isOpen = r.querySelector('.ca-label.is-on');
    clearTimeout(openTimer);
    if (isOpen) paint(r, btn, true);
    else openTimer = window.setTimeout(() => paint(r, btn, false), OPEN_DELAY);
    row = r;
  });

  root.addEventListener('pointerout', (e) => {
    if (!row) return;
    const to = e.relatedTarget as Node | null;
    if (to && row.contains(to)) return;
    clearTimeout(openTimer);
    const r = row;
    closeTimer = window.setTimeout(() => {
      close(r);
      if (row === r) row = null;
    }, CLOSE_DELAY);
  });

  // Keyboard: focusing a button names it too.
  root.addEventListener('focusin', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.card-actions .icon-tip');
    if (btn && btn.matches(':focus-visible')) paint(btn.closest('.card-actions')!, btn, true);
  });
  root.addEventListener('focusout', (e) => {
    const r = (e.target as HTMLElement).closest<HTMLElement>('.card-actions');
    if (r && !r.contains(e.relatedTarget as Node | null)) close(r);
  });

  // A click flips the state and the controllers rewrite the label: refresh
  // the caption so it confirms the new state in place.
  root.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.card-actions .icon-tip');
    if (!btn) return;
    requestAnimationFrame(() => {
      const r = btn.closest<HTMLElement>('.card-actions');
      if (r?.querySelector('.ca-label.is-on')) paint(r, btn, true);
    });
  });
}
