// Phone list sheet transitions with real touch input (CDP), checking that the
// map view survives them: half → full → half, half → peek → half.
//   node qa/sheet-touch.mjs <outDir> <baseUrl>
import { chromium } from 'playwright';
import fs from 'node:fs';
const [out, base] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await page.goto(base + '/places/', { waitUntil: 'networkidle' });
await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });
await page.waitForTimeout(1200);
const touch = async (type, x, y) =>
  cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
async function dragHandle(toY) {
  const h = await page.locator('[data-sheet-handle]').boundingBox();
  const x = 195, y0 = h.y + 12;
  await touch('touchStart', x, y0);
  const steps = 12;
  for (let i = 1; i <= steps; i++) { await touch('touchMove', x, y0 + ((toY - y0) * i) / steps); await page.waitForTimeout(16); }
  await touch('touchEnd', x, toY);
  await page.waitForTimeout(900);
}
const state = async (label) => {
  const s = await page.evaluate(() => ({
    sheet: document.querySelector('[data-explorer]')?.dataset.sheet,
    count: document.querySelector('[data-sheet-count]')?.textContent,
    proxy: getComputedStyle(document.querySelector('.leaflet-proxy')).transform,
    showAll: !document.querySelector('[data-show-all]')?.hidden,
  }));
  await page.screenshot({ path: `${out}/sheet-${label}.png` });
  console.log(label, JSON.stringify(s));
  return s;
};
await state('0-half');
await dragHandle(40);   await state('1-full');
await dragHandle(330);  await state("2-back-half");
await dragHandle(800);  await state('3-peek');
await dragHandle(330);  await state("4-back-half");
await browser.close();
