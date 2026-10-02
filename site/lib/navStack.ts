// A small mirror of the session's history stack (pathnames by position), so
// the tab bar can return to a tab that is the previous/next history entry with
// history.back()/forward(). That restores the page from the back/forward cache
// — instant, nothing reloads — instead of navigating to it afresh.
//
// Each page stamps its position into history.state (`__navIdx`) the first time
// it loads; reloads and back/forward visits keep that stamp.

const STACK_KEY = 'nav-stack';
const IDX_KEY = 'nav-idx';

type NavState = { __navIdx?: number } | null;

function read(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(STACK_KEY) || '[]') as string[];
  } catch {
    return [];
  }
}

function write(stack: string[], idx: number) {
  try {
    sessionStorage.setItem(STACK_KEY, JSON.stringify(stack));
    sessionStorage.setItem(IDX_KEY, String(idx));
  } catch {}
}

function currentIdx(): number | null {
  const idx = (history.state as NavState)?.__navIdx;
  return typeof idx === 'number' ? idx : null;
}

/** Record this page in the stack. Call once per page load (and on pageshow). */
export function trackPage(): void {
  const stack = read();
  let idx = currentIdx();
  if (idx === null) {
    // A fresh entry sits right after the page we came from; anything that was
    // ahead of that page is gone from history now.
    let prev = -1;
    try {
      prev = Number(sessionStorage.getItem(IDX_KEY) ?? -1);
    } catch {}
    idx = Number.isFinite(prev) ? prev + 1 : 0;
    stack.length = Math.min(stack.length, idx);
    history.replaceState({ ...((history.state as object) ?? {}), __navIdx: idx }, '');
  }
  stack[idx] = location.pathname;
  write(stack, idx);
}

/**
 * Go to `pathname` through history if it is the adjacent entry. Returns false
 * when it isn't, so the caller navigates normally.
 */
export function stepTo(pathname: string): boolean {
  const idx = currentIdx();
  if (idx === null) return false;
  const stack = read();
  if (stack[idx - 1] === pathname) {
    history.back();
    return true;
  }
  if (stack[idx + 1] === pathname) {
    history.forward();
    return true;
  }
  return false;
}
