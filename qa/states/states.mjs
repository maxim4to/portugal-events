// Extra QA states not covered by qa/shoot.mjs. Run from the repo root with
// BASE=<site url> node qa/states/<script>.mjs; screenshots land in qa/out/.

import { chromium } from 'playwright';
const B = (process.env.BASE || 'http://localhost:4321/portugal-events') + '';
const out = 'qa/out/r6';
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH });
for (const theme of ['light', 'dark']) {
  // 1. sign-in toast after clicking a heart while signed out
  let p = await b.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: theme });
  await p.goto(B + '/places/', { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  await p.locator('.card-wrap').first().hover();
  await p.locator('.favorite-btn--card').first().click(); await p.waitForTimeout(500);
  await p.screenshot({ path: `${out}/toast--desktop--${theme}.png` });
  // 2. list scrolled to dividers / deep content
  await p.locator('[data-list-scroll]').evaluate((el) => (el.scrollTop = 2400)); await p.waitForTimeout(600);
  await p.screenshot({ path: `${out}/list-scrolled--desktop--${theme}.png` });
  await p.locator('[data-filter-bar], .filter-bar-top').first().evaluate((el) => (el.scrollTop = 900)).catch(() => {});
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}/sidebar-scrolled--desktop--${theme}.png` });
  await p.close();
  // 3. full detail pages
  for (const [vp, w, h] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
    for (const path of ['/places/tavira/', '/places/museu-nacional-de-arte-antiga/', '/events/serralves-joan-miro-2026/']) {
      p = await b.newPage({ viewport: { width: w, height: h }, colorScheme: theme });
      await p.goto(B + path, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
      await p.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });
      const name = path.split('/').filter(Boolean).join('_');
      await p.screenshot({ path: `${out}/full-${name}--${vp}--${theme}.png`, fullPage: true });
      await p.close();
    }
  }
}
await b.close();
