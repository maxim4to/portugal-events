// Desktop detail overlay: behaviour checks + screenshots.
//   BASE=<url> node qa/states/overlay.mjs [outDir]
import { chromium } from 'playwright';
import fs from 'node:fs';

const B = process.env.BASE || 'http://localhost:4321/portugal-events';
const out = process.argv[2] || 'qa/out/overlay';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) fails++; };
const hideBar = (p) => p.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' }).catch(() => {});
const isOpen = (p) => p.evaluate(() => document.querySelector('[data-detail-overlay]')?.open ?? false);
const settle = (p, ms = 700) => p.waitForTimeout(ms);

for (const theme of ['light', 'dark']) {
  for (const [vp, w, h] of [['desktop', 1440, 900], ['bp1100', 1100, 800]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: theme });
    const p = await ctx.newPage();
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    const listUrl = B + '/places/?type=beach';
    await p.goto(listUrl, { waitUntil: 'networkidle' });
    await hideBar(p);
    await settle(p);
    await p.locator('[data-list-scroll]').evaluate((el) => (el.scrollTop = 900));
    await settle(p, 300);
    const histBefore = await p.evaluate(() => history.length);
    const card = p.locator('.card-wrap:not([hidden]) a.place-card').nth(4);
    const href = await card.getAttribute('href');
    await card.scrollIntoViewIfNeeded();
    await settle(p, 200);
    const scrollBefore = await p.locator('[data-list-scroll]').evaluate((el) => el.scrollTop);
    await card.click();
    await settle(p, 120);
    await p.screenshot({ path: `${out}/opening--${vp}--${theme}.png` });
    await settle(p, 1400);
    await p.screenshot({ path: `${out}/open--${vp}--${theme}.png` });
    const tag = `${vp}/${theme}`;
    ok(await isOpen(p), `${tag}: overlay opens on card click`);
    ok(p.url().endsWith(href), `${tag}: URL becomes the detail URL`);
    ok((await p.evaluate(() => history.length)) === histBefore + 1, `${tag}: one history entry per open`);
    const embedded = await p.frameLocator('.do-frame').locator('html[data-embed]').count();
    ok(embedded === 1, `${tag}: frame is in embed mode`);
    const headerHidden = await p.frameLocator('.do-frame').locator('.site-header').evaluate((e) => getComputedStyle(e).display === 'none').catch(() => false);
    ok(headerHidden, `${tag}: frame hides site header`);

    if (vp === 'desktop') {
      // Esc inside the frame closes.
      await p.frameLocator('.do-frame').locator('body').click({ position: { x: 600, y: 20 } });
      await p.keyboard.press('Escape');
      await settle(p);
      ok(!(await isOpen(p)), `${tag}: Esc inside frame closes`);
      ok(p.url() === listUrl, `${tag}: URL back to list with filters (${p.url()})`);
      const scroll = await p.locator('[data-list-scroll]').evaluate((el) => el.scrollTop);
      ok(Math.abs(scroll - scrollBefore) < 2, `${tag}: list scroll kept (${scrollBefore} → ${scroll})`);
      const pressed = await p.locator('.chip[data-type="beach"][aria-pressed="true"]').count();
      ok(pressed === 1, `${tag}: filter still pressed`);

      // Backdrop click closes; Forward reopens; Back closes.
      await card.click();
      await settle(p, 900);
      await p.mouse.click(8, h / 2);
      await settle(p);
      ok(!(await isOpen(p)), `${tag}: backdrop click closes`);
      await p.goForward();
      await settle(p, 900);
      ok(await isOpen(p), `${tag}: Forward reopens`);
      await p.goBack();
      await settle(p);
      ok(!(await isOpen(p)) && p.url() === listUrl, `${tag}: Back closes`);

      // × button closes.
      await card.click();
      await settle(p, 900);
      await p.locator('[data-do-close]').click();
      await settle(p);
      ok(!(await isOpen(p)), `${tag}: × closes`);

      // Map popup link opens the overlay too.
      await p.locator('.leaflet-marker-icon').first().click({ force: true });
      await settle(p, 500);
      const pop = p.locator('a.map-pop');
      if (await pop.count()) {
        await pop.click();
        await settle(p, 900);
        ok(await isOpen(p), `${tag}: map popup opens overlay`);
        await p.keyboard.press('Escape');
        await settle(p);
      }

      // Cmd-click: new tab, no overlay.
      const [popup] = await Promise.all([ctx.waitForEvent('page', { timeout: 3000 }).catch(() => null), card.click({ modifiers: ['Meta'] })]);
      await settle(p, 400);
      ok(!(await isOpen(p)) && popup, `${tag}: cmd-click opens a tab, not the overlay`);
      await popup?.close();

      // Reload while open = full page.
      await card.click();
      await settle(p, 900);
      await p.reload({ waitUntil: 'networkidle' });
      await hideBar(p);
      const full = await p.locator('.site-header').isVisible();
      ok(full && !(await p.locator('[data-detail-overlay][open]').count()), `${tag}: reload shows the full detail page`);
    }
    ok(errors.length === 0, `${tag}: no page errors ${errors.join(' | ')}`);
    await ctx.close();
  }
}

// Events explorer uses the same overlay.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(B + '/events/', { waitUntil: 'networkidle' });
  await settle(p);
  const a = p.locator('a[data-item-card]:not([hidden])').first();
  const href = await a.getAttribute('href');
  await a.click();
  await settle(p, 1200);
  ok(await isOpen(p), 'events: card opens overlay');
  ok(p.url().endsWith(href), 'events: URL becomes the event URL');
  await p.screenshot({ path: `${out}/events-open--desktop--light.png` });
  await p.keyboard.press('Escape');
  await settle(p);
  ok(!(await isOpen(p)) && p.url().endsWith('/events/'), 'events: Esc closes back to the list');
  await ctx.close();
}

// Phone: plain navigation.
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
await p.goto(B + '/places/', { waitUntil: 'networkidle' });
await settle(p);
const a = p.locator('.card-wrap:not([hidden]) a.place-card').first();
const href = await a.getAttribute('href');
await Promise.all([p.waitForURL('**' + href), a.click()]);
ok(!(await p.locator('[data-detail-overlay][open]').count()), 'phone: card navigates, no overlay');
await browser.close();
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
