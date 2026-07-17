// A small, self-dismissing toast shown when a signed-out visitor tries to use a
// per-user feature (favorites / visited). It explains why sign-in is needed and
// offers a single "Войти" action — the Google popup opens from THAT click, so
// the user gesture is preserved (see lib/auth.ts). Framework-free; client only.

export interface SigninPromptOptions {
  anchor: HTMLElement;   // the toggle that was clicked
  message: string;       // why we're asking, e.g. "Войдите, чтобы сохранять избранное"
  onConfirm: () => void; // called on the "Войти" click (a real user gesture)
}

// How long the toast lingers before fading out on its own. The countdown pauses
// while the pointer is over the toast so it never vanishes mid-reach.
const AUTO_DISMISS_MS = 6000;
const FADE_MS = 180;

let el: HTMLElement | null = null;
let cleanup: (() => void) | null = null;
let autoTimer: number | undefined;
let removeTimer: number | undefined;

function clearTimers() {
  if (autoTimer !== undefined) { clearTimeout(autoTimer); autoTimer = undefined; }
  if (removeTimer !== undefined) { clearTimeout(removeTimer); removeTimer = undefined; }
}

function dismiss() {
  if (!el) return;
  cleanup?.();
  cleanup = null;
  clearTimers();
  const node = el;
  el = null;
  // Fade out, then remove.
  node.classList.remove('show');
  removeTimer = window.setTimeout(() => node.remove(), FADE_MS);
}

export function showSigninPrompt(opts: SigninPromptOptions): void {
  dismiss(); // only one at a time
  clearTimers();

  el = document.createElement('div');
  el.className = 'signin-toast';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = `
    <span class="signin-toast-msg"></span>
    <button type="button" class="signin-toast-action" data-signin-confirm>Войти</button>`;
  // Set message as textContent (never innerHTML) to avoid any injection.
  el.querySelector<HTMLElement>('.signin-toast-msg')!.textContent = opts.message;
  document.body.appendChild(el);

  // Position: fixed, near the anchor, clamped to the viewport.
  const r = opts.anchor.getBoundingClientRect();
  const pr = el.getBoundingClientRect();
  const margin = 8;
  let top = r.bottom + margin;
  if (top + pr.height > window.innerHeight - margin) top = Math.max(margin, r.top - pr.height - margin);
  let left = r.left;
  if (left + pr.width > window.innerWidth - margin) left = window.innerWidth - pr.width - margin;
  left = Math.max(margin, left);
  el.style.top = `${top}px`;
  el.style.left = `${left}px`;

  // Trigger the enter transition. Force a reflow so the initial (opacity:0)
  // state is committed before adding `.show`, then flip synchronously. Avoids
  // requestAnimationFrame, which is throttled/paused in a background tab and
  // would otherwise leave the toast stuck invisible.
  void el.offsetWidth;
  el.classList.add('show');

  const confirm = el.querySelector<HTMLButtonElement>('[data-signin-confirm]')!;
  const onConfirmClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    opts.onConfirm();   // synchronous → signInWithGoogle keeps the gesture
    dismiss();
  };
  const onOutside = (e: MouseEvent) => { if (el && !el.contains(e.target as Node)) dismiss(); };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(); };
  const onScrollResize = () => dismiss();

  // Auto-dismiss countdown, paused while hovering the toast.
  const startAuto = () => {
    if (autoTimer !== undefined) clearTimeout(autoTimer);
    autoTimer = window.setTimeout(dismiss, AUTO_DISMISS_MS);
  };
  const pauseAuto = () => { if (autoTimer !== undefined) { clearTimeout(autoTimer); autoTimer = undefined; } };
  startAuto();

  confirm.addEventListener('click', onConfirmClick);
  el.addEventListener('pointerenter', pauseAuto);
  el.addEventListener('pointerleave', startAuto);
  // Defer outside-click binding so the click that opened us doesn't immediately close it.
  setTimeout(() => document.addEventListener('click', onOutside), 0);
  document.addEventListener('keydown', onKey);
  window.addEventListener('scroll', onScrollResize, true);
  window.addEventListener('resize', onScrollResize);

  cleanup = () => {
    document.removeEventListener('click', onOutside);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('scroll', onScrollResize, true);
    window.removeEventListener('resize', onScrollResize);
  };
}
