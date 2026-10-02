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

  const phone = window.matchMedia('(max-width: 760px)');

  // Phone bottom sheet: the menu is moved to <body> while open. iOS Safari clips
  // position:fixed descendants of a scrolling container (the pill row scrolls
  // sideways), which left only a dimmed strip over the bar instead of a sheet.
  const menus = new Map<HTMLElement, HTMLElement>(); // group → its menu
  let backdrop: HTMLElement | null = null;

  function detachSheet(g: HTMLElement) {
    const menu = menus.get(g);
    if (menu && menu.parentElement !== g) {
      menu.classList.remove('is-sheet');
      g.append(menu);
    }
  }

  function attachSheet(g: HTMLElement) {
    const menu = menus.get(g);
    if (!menu) return;
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'fgroup-backdrop';
      backdrop.addEventListener('click', () => closeAll());
    }
    document.body.append(backdrop, menu);
    menu.classList.add('is-sheet');
  }

  const closeAll = () => {
    groups.forEach((g) => {
      g.classList.remove('open');
      g.querySelector('[data-fgroup-toggle]')?.setAttribute('aria-expanded', 'false');
      detachSheet(g);
      clearMenu(g);
    });
    backdrop?.remove();
  };

  groups.forEach((g) => {
    // On phones the menu opens as a bottom sheet: give it a title (the pill's
    // label) and a "Готово" button. Both are hidden by CSS on wider screens.
    const menu = g.querySelector<HTMLElement>('.fgroup-menu');
    if (menu) {
      menus.set(g, menu);
      menu.dataset.title = g.querySelector('.flabel')?.textContent?.trim() ?? '';
      const done = document.createElement('button');
      done.type = 'button';
      done.className = 'fgroup-done';
      done.textContent = 'Готово';
      done.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAll();
      });
      menu.append(done);
    }

    const btn = g.querySelector<HTMLButtonElement>('[data-fgroup-toggle]');
    btn?.addEventListener('click', () => {
      const willOpen = !g.classList.contains('open');
      closeAll();
      if (!willOpen) return;
      g.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
      if (phone.matches) attachSheet(g);
      else positionMenu(g);
    });
  });
  document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    // Inside a group, or inside its menu while that sits in <body> as a sheet.
    if (t.closest('.fgroup, .fgroup-menu')) return;
    closeAll();
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
