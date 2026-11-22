// Light haptic ticks for phone interactions.
//
// Android / Chrome: navigator.vibrate. iOS Safari has no vibrate API, but
// since iOS 18 toggling a native <input type="checkbox" switch> plays the
// system's selection haptic — so a hidden switch is flipped through its
// label (must happen inside a user gesture, which every caller is).
// No-ops on desktop, with reduced motion, and where neither works.

let label: HTMLLabelElement | null = null;
const coarse = () => window.matchMedia('(pointer: coarse)').matches;

function iosSwitch(): HTMLLabelElement | null {
  if (label) return label;
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.tabIndex = -1;
  input.setAttribute('aria-hidden', 'true');
  label = document.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  label.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
  label.append(input);
  document.body.append(label);
  return label;
}

export function haptic(kind: 'light' | 'medium' = 'light'): void {
  try {
    if (!coarse()) return;
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(kind === 'medium' ? 14 : 8);
      return;
    }
    iosSwitch()?.click();
  } catch {}
}

// Delegated: every press on these controls ticks once.
const SELECTOR = [
  '.chip',
  '.favorite-btn',
  '.visited-btn',
  '.ni-btn',
  '.more-btn',
  '[data-fsheet-open]',
  '[data-fsheet-close]',
  '[data-fsheet-reset]',
  '[data-sort-near]',
  '.nav-trigger',
  '.nav-pop a',
  '.area-btn',
  '.rail-item',
  '.pp-btn',
  '.pp-close',
  '.fgroup-expand',
  '.mbar-back',
  '[data-thumb]',
  '.reel-pill',
].join(',');

let wired = false;
export function initHaptics(): void {
  if (wired) return;
  wired = true;
  document.addEventListener(
    'click',
    (e) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.(SELECTOR)) haptic();
    },
    true,
  );
}
