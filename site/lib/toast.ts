// A minimal, self-dismissing status toast for transient feedback — e.g. a save
// that failed. Bottom-centered so it doesn't fight the anchored sign-in prompt.
// Framework-free; client only. Message is set via textContent (never innerHTML).

const AUTO_DISMISS_MS = 5000;
const FADE_MS = 180;

let el: HTMLElement | null = null;
let hideTimer: number | undefined;
let removeTimer: number | undefined;

function clearTimers() {
  if (hideTimer !== undefined) { clearTimeout(hideTimer); hideTimer = undefined; }
  if (removeTimer !== undefined) { clearTimeout(removeTimer); removeTimer = undefined; }
}

/** Show a transient toast. Replaces any toast already on screen. */
export function showToast(message: string, ms = AUTO_DISMISS_MS): void {
  clearTimers();
  if (el) el.remove();

  el = document.createElement('div');
  el.className = 'app-toast';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.textContent = message;
  document.body.appendChild(el);

  // Commit the initial (hidden) state before flipping to `.show`, so the fade
  // entrance runs. Avoids requestAnimationFrame (throttled in background tabs).
  void el.offsetWidth;
  el.classList.add('show');

  const node = el;
  hideTimer = window.setTimeout(() => {
    node.classList.remove('show');
    removeTimer = window.setTimeout(() => {
      node.remove();
      if (el === node) el = null;
    }, FADE_MS);
  }, ms);
}
