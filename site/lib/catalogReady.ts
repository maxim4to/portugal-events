// Holds the catalog hidden (via the `data-user-loading` attribute on the
// explorer root) until we know the signed-in state and — for a signed-in user —
// their first `visited` and `favorites` snapshots have been applied. Without
// this the list paints immediately with every place, then reflows a beat later
// once the profile loads: visited places sink below the divider and the
// favorites filter pops in. Waiting for that data means one clean paint, already
// ordered, with no visible jump.
//
// Inert unless the root actually carries `data-user-loading` (set only on the
// places catalog, the one list that reorders on profile load).

import { isFirebaseConfigured } from './firebase';
import { onAuthChange } from './auth';

// Never hold the UI hostage to a slow or broken database — reveal regardless
// after this long, accepting a possible reflow over an indefinitely blank page.
const SAFETY_REVEAL_MS = 2500;

export function awaitUserData(root: HTMLElement): void {
  if (!root.hasAttribute('data-user-loading')) return;

  let done = false;
  const reveal = () => {
    if (done) return;
    done = true;
    root.removeAttribute('data-user-loading');
    // The map laid out while hidden (opacity:0 keeps its size, but be safe);
    // let it re-measure now that the pane is visible.
    window.dispatchEvent(new Event('resize'));
  };

  // Not configured → nothing user-specific to wait for; show immediately.
  if (!isFirebaseConfigured()) {
    reveal();
    return;
  }

  let signedIn: boolean | null = null;
  let gotVisited = false;
  let gotFavorites = false;

  const maybeReveal = () => {
    // Signed out: no per-user data to load. Signed in: wait for both sets, so
    // the divider/order and the favorites state are final before the first paint.
    if (signedIn === false) reveal();
    else if (signedIn && gotVisited && gotFavorites) reveal();
  };

  // Both controllers dispatch these once their first snapshot is reflected. For
  // a signed-in user that snapshot is an async DB read, so it lands after this
  // listener is attached.
  document.addEventListener('visited:changed', () => {
    gotVisited = true;
    maybeReveal();
  });
  document.addEventListener('favorites:changed', () => {
    gotFavorites = true;
    maybeReveal();
  });
  onAuthChange((user) => {
    signedIn = !!user;
    maybeReveal();
  });

  window.setTimeout(reveal, SAFETY_REVEAL_MS);
}
