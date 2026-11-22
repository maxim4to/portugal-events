// Extra QA states not covered by qa/shoot.mjs. Run from the repo root with
// BASE=<site url> node qa/states/<script>.mjs; screenshots land in qa/out/.

import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH });
const AV = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#7a9cc6"/><circle cx="32" cy="26" r="12" fill="#e8d3bf"/></svg>');
for (const [vp, w, h] of [['desktop', 1440, 900], ['mobile', 390, 844]]) for (const theme of ['light', 'dark']) {
  const p = await b.newPage({ viewport: { width: w, height: h }, colorScheme: theme });
  await p.goto((process.env.BASE || 'http://localhost:4321/portugal-events') + '/places/', { waitUntil: 'networkidle' }); await p.waitForTimeout(1000);
  await p.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });
  await p.evaluate((av) => {
    const q = (s) => document.querySelector(s), qa = (s) => [...document.querySelectorAll(s)];
    const auth = q('[data-auth]'); if (auth) auth.hidden = false;
    const si = q('[data-auth-signin]'); if (si) si.hidden = true;
    const u = q('[data-auth-user]'); if (u) u.hidden = false;
    const a = q('[data-auth-avatar]'); if (a) a.src = av;
    const fav = q('[data-favorites]'); if (fav) { fav.hidden = false; const c = fav.querySelector('[data-fav-count]'); if (c) c.textContent = '12'; }
    qa('[data-visited-control], [data-ni-filter-control], .visited-group').forEach((e) => (e.hidden = false));
    const cards = qa('.card-wrap');
    cards[0].querySelector('.favorite-btn')?.setAttribute('aria-pressed', 'true');
    cards[1].querySelector('.favorite-btn')?.setAttribute('aria-pressed', 'true');
    cards[1].querySelector('.visited-btn, [class*="visited-btn"]')?.setAttribute('aria-pressed', 'true');
    cards[2].dataset.orderVisited = 'true'; cards[3].dataset.orderVisited = 'true';
    cards[4].dataset.orderNotinterested = 'true';
    cards[4].querySelector('[class*="ni-btn"]')?.setAttribute('aria-pressed', 'true');
    const vs = q('[data-visited-sep]'); if (vs) vs.hidden = false;
    const ns = q('[data-ni-sep]'); if (ns) ns.hidden = false;
    const tab = q('[data-tab-avatar]'); if (tab) { tab.src = av; tab.hidden = false; }
  }, AV);
  await p.waitForTimeout(400);
  await p.screenshot({ path: `qa/out/r6/signedin-top--${vp}--${theme}.png` });
  // scroll to dividers
  await p.evaluate(() => { const s = document.querySelector('[data-visited-sep]'); s?.scrollIntoView({ block: 'center' }); });
  await p.waitForTimeout(400);
  await p.screenshot({ path: `qa/out/r6/signedin-dividers--${vp}--${theme}.png` });
  if (vp === 'desktop') { await p.locator('[data-auth-menu-toggle]').click().catch(() => {}); await p.waitForTimeout(300); await p.screenshot({ path: `qa/out/r6/signedin-menu--${vp}--${theme}.png`, clip: { x: 900, y: 0, width: 540, height: 260 } }); }
  await p.close();
}
await b.close();
