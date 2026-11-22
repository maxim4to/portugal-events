// Small, site-wide interaction details that need a line of JS.

// Favorite / visited: play the "turned on" pop + ring only right after the
// user switches it on (not when saved state paints on load). The controllers
// flip aria-pressed in their own click handlers; compare before/after.
const TOGGLES = '.favorite-btn, .visited-btn';
document.addEventListener(
  'click',
  (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>(TOGGLES);
    if (!btn) return;
    const was = btn.getAttribute('aria-pressed') === 'true';
    requestAnimationFrame(() => {
      const now = btn.getAttribute('aria-pressed') === 'true';
      if (was || !now) return;
      btn.classList.remove('just-on');
      void btn.offsetWidth; // restart if clicked again quickly
      btn.classList.add('just-on');
      window.setTimeout(() => btn.classList.remove('just-on'), 600);
    });
  },
  true,
);
