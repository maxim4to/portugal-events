// A single, reusable inline prompt shown when a signed-out visitor tries to use a
// per-user feature (favorites / visited). Explains why sign-in is needed and offers
// it as an explicit second click — the Google popup then opens from THAT click, so
// the user gesture is preserved (see lib/auth.ts). Framework-free; client only.

export interface SigninPromptOptions {
  anchor: HTMLElement;   // the toggle that was clicked
  message: string;       // why we're asking, e.g. "Войдите, чтобы сохранять избранное"
  onConfirm: () => void; // called on the confirm click (a real user gesture)
}

let el: HTMLElement | null = null;
let cleanup: (() => void) | null = null;

function dismiss() {
  cleanup?.();
  cleanup = null;
  el?.remove();
  el = null;
}

export function showSigninPrompt(opts: SigninPromptOptions): void {
  dismiss(); // only one at a time

  el = document.createElement('div');
  el.className = 'signin-prompt';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Вход');
  el.innerHTML = `
    <p class="signin-prompt-msg"></p>
    <div class="signin-prompt-actions">
      <button type="button" class="btn btn-primary" data-signin-confirm>Войти через Google</button>
      <button type="button" class="btn" data-signin-cancel>Не сейчас</button>
    </div>`;
  // Set message as textContent (never innerHTML) to avoid any injection.
  el.querySelector<HTMLElement>('.signin-prompt-msg')!.textContent = opts.message;
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

  const confirm = el.querySelector<HTMLButtonElement>('[data-signin-confirm]')!;
  const cancel = el.querySelector<HTMLButtonElement>('[data-signin-cancel]')!;
  const onConfirmClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    opts.onConfirm();   // synchronous → signInWithGoogle keeps the gesture
    dismiss();
  };
  const onCancel = (e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); dismiss(); };
  const onOutside = (e: MouseEvent) => { if (!el!.contains(e.target as Node)) dismiss(); };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(); };
  const onScrollResize = () => dismiss();

  confirm.addEventListener('click', onConfirmClick);
  cancel.addEventListener('click', onCancel);
  // Defer outside-click binding so the click that opened us doesn't immediately close it.
  setTimeout(() => document.addEventListener('click', onOutside), 0);
  document.addEventListener('keydown', onKey);
  window.addEventListener('scroll', onScrollResize, true);
  window.addEventListener('resize', onScrollResize);
  confirm.focus();

  cleanup = () => {
    document.removeEventListener('click', onOutside);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('scroll', onScrollResize, true);
    window.removeEventListener('resize', onScrollResize);
  };
}
