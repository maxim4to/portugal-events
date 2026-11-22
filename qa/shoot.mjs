// Visual QA harness for the redesign.
//
//   node qa/shoot.mjs <outDir> <baseUrl> [filter]
//   e.g. node qa/shoot.mjs qa/out/after http://localhost:4321/portugal-events places--desktop
//
// Screenshots every page/state at every viewport and theme, and writes
// <outDir>/report.json with layout defects:
//   overflowX  — the document scrolls horizontally
//   offscreen  — elements sticking out of the viewport (outside scroll containers)
//   clipped    — text elements whose content is cut (scrollWidth > clientWidth
//                without an intentional ellipsis / line-clamp)
//   errors     — console errors and uncaught exceptions
// Env: THEMES=light,dark  VIEWPORTS=desktop,mobile  FULL=1 (full-page shots)
//      CHROME_PATH=<executable> (defaults to Playwright's own browser)
import { chromium } from 'playwright';
import fs from 'node:fs';

const [out, base, filter = ''] = process.argv.slice(2);
if (!out || !base) {
  console.error('usage: node qa/shoot.mjs <outDir> <baseUrl> [filter]');
  process.exit(2);
}
fs.mkdirSync(out, { recursive: true });

// [name, path, optional action run after load]
const clickFirstMarker = async (page) => {
  const m = page.locator('.leaflet-marker-icon').first();
  if (await m.count()) await m.click({ force: true }).catch(() => {});
  await page.waitForTimeout(500);
};
const hoverFirstCard = async (page) => {
  const c = page.locator('[data-place-card], [data-item-card]').first();
  if (await c.count()) await c.hover().catch(() => {});
  await page.waitForTimeout(300);
};
const openFirstFilter = async (page) => {
  const f = page.locator('.fgroup-summary:visible').first();
  if (await f.count()) await f.click().catch(() => {});
  await page.waitForTimeout(500);
};
const pages = [
  ['places', '/places/'],
  ['places-hover', '/places/', hoverFirstCard],
  ['places-filtered', '/places/?type=beach&region=algarve'],
  ['places-empty', '/places/?type=karting&drive=60&tag=купание'],
  ['places-popup', '/places/', clickFirstMarker],
  ['places-filtermenu', '/places/', openFirstFilter],
  ['place-detail', '/places/tavira/'],
  ['place-detail-museum', '/places/museu-nacional-de-arte-antiga/'],
  ['events', '/events/'],
  ['event-detail', '/events/serralves-joan-miro-2026/'],
  ['profile', '/profile/'],
];
const allViewports = [
  ['wide', 1920, 1080],
  ['desktop', 1440, 900],
  ['laptop', 1280, 800],
  ['bp1100', 1100, 800],
  ['bp1099', 1099, 800],
  ['tablet', 820, 1180],
  ['bp761', 761, 900],
  ['mobile', 390, 844],
];
const vpFilter = process.env.VIEWPORTS?.split(',');
const viewports = vpFilter ? allViewports.filter(([n]) => vpFilter.includes(n)) : allViewports;
const themes = (process.env.THEMES || 'light,dark').split(',');

const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
);
const report = [];
for (const [vpName, w, h] of viewports) {
  for (const theme of themes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: theme });
    for (const [name, path, action] of pages) {
      const id = `${name}--${vpName}--${theme}`;
      if (filter && !filter.split(',').some((f) => id.includes(f))) continue;
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 160)));
      page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.slice(0, 160)));
      try {
        await page.goto(base + path, { waitUntil: 'networkidle', timeout: 30000 });
      } catch (e) {
        errors.push('goto: ' + e.message.slice(0, 100));
      }
      await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' }).catch(() => {});
      await page.waitForTimeout(700);
      if (action) await action(page);
      const m = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const label = (el) =>
          el.tagName.toLowerCase() +
          (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/)[0] : '');
        const inScroller = (el) => {
          for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
            const o = getComputedStyle(p).overflowX;
            if (o !== 'visible') return true;
          }
          return false;
        };
        const offscreen = [], clipped = [];
        for (const el of document.querySelectorAll('body *')) {
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
          if (el.closest('.leaflet-container')) continue;
          const r = el.getBoundingClientRect();
          if (!r.width) continue;
          if ((r.right > vw + 1 || r.left < -1) && !inScroller(el)) offscreen.push(`${label(el)} [${Math.round(r.left)}..${Math.round(r.right)}]`);
          const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
          if (!hasText || r.width <= 2 || r.height <= 2) continue; // sr-only & friends
          const intentional = cs.textOverflow === 'ellipsis' || /\d/.test(cs.webkitLineClamp || '');
          let cut = !intentional && cs.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1;
          // Text spilling out of an ancestor that clips it (overflow:hidden card).
          if (!cut && !intentional) {
            for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
              const pcs = getComputedStyle(p);
              if (pcs.textOverflow === 'ellipsis' || /\d/.test(pcs.webkitLineClamp || '')) break;
              // A horizontal scroller (pill rows): off-edge content is reachable.
              if (pcs.overflowX === 'auto' || pcs.overflowX === 'scroll') break;
              if (pcs.overflowX === 'hidden' || pcs.overflowX === 'clip') {
                const pr = p.getBoundingClientRect();
                if (r.right > pr.right + 1 || r.left < pr.left - 1) cut = true;
                break;
              }
            }
          }
          if (cut) clipped.push(`${label(el)} "${el.textContent.trim().slice(0, 30)}"`);
        }
        return { overflowX: document.documentElement.scrollWidth > vw, offscreen: offscreen.slice(0, 6), clipped: [...new Set(clipped)].slice(0, 6) };
      });
      await page.screenshot({ path: `${out}/${id}.png`, fullPage: process.env.FULL === '1' });
      report.push({ id, ...m, errors: errors.slice(0, 4) });
      await page.close();
    }
    await ctx.close();
  }
}
await browser.close();
fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
let bad = 0;
for (const r of report) {
  if (r.overflowX || r.offscreen.length || r.clipped.length || r.errors.length) {
    bad++;
    console.log(r.id, JSON.stringify({ o: r.overflowX || undefined, off: r.offscreen.length ? r.offscreen : undefined, clip: r.clipped.length ? r.clipped : undefined, err: r.errors.length ? r.errors : undefined }));
  }
}
console.log(`shots: ${report.length}, with defects: ${bad}`);
