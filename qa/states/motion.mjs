// Motion check: slows animations to 10% via CDP and grabs frames mid-flight.
//   BASE=<url> node qa/states/motion.mjs [outDir]
import { chromium } from 'playwright';
import fs from 'node:fs';

const B = process.env.BASE || 'http://localhost:4321/portugal-events';
const out = process.argv[2] || 'qa/out/motion';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});

async function slowPage(ctx) {
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 0.1 });
  p.on('framenavigated', async () => {
    try { await cdp.send('Animation.setPlaybackRate', { playbackRate: 0.1 }); } catch {}
  });
  return p;
}
const hideBar = (p) => p.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' }).catch(() => {});
const frames = async (p, name, n, gap, clip) => {
  for (let i = 0; i < n; i++) {
    await p.screenshot({ path: `${out}/${name}-${i}.png`, clip });
    await p.waitForTimeout(gap);
  }
};

// 1. Theme reveal from the toggle.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  const p = await slowPage(ctx);
  await p.goto(B + '/places/', { waitUntil: 'networkidle' });
  await hideBar(p);
  await p.waitForTimeout(600);
  await p.locator('#theme-toggle').click();
  await frames(p, 'theme', 4, 900);
  await ctx.close();
}
// 2. Places → Events: nav thumb slides, content cross-fades.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await slowPage(ctx);
  await p.goto(B + '/places/', { waitUntil: 'networkidle' });
  await hideBar(p);
  await p.waitForTimeout(600);
  await p.locator('.nav-link', { hasText: 'Афиша' }).click();
  await frames(p, 'nav', 4, 600, { x: 0, y: 0, width: 1440, height: 260 });
  await ctx.close();
}
// 3. Phone: card photo morphs into the detail hero.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await slowPage(ctx);
  await p.goto(B + '/places/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  await p.locator('.card-wrap:not([hidden]) a.place-card').first().click();
  await frames(p, 'hero', 5, 700);
  await ctx.close();
}
// 4. Filter dropdown grows from its pill (tablet layout).
{
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 } });
  const p = await slowPage(ctx);
  await p.goto(B + '/places/', { waitUntil: 'networkidle' });
  await hideBar(p);
  await p.waitForTimeout(600);
  await p.locator('.fgroup-summary:visible').nth(2).click();
  await frames(p, 'menu', 3, 500, { x: 0, y: 60, width: 700, height: 460 });
  await ctx.close();
}
await browser.close();
console.log('frames in', out);
