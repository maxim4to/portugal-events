// Extra QA states not covered by qa/shoot.mjs. Run from the repo root with
// BASE=<site url> node qa/states/<script>.mjs; screenshots land in qa/out/.

import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH });
const out = 'qa/out/r5';
const cases = [
  ['portrait', { width: 390, height: 844 }],
  ['landscape', { width: 844, height: 390 }],
];
for (const [name, vp] of cases) {
  const p = await b.newPage({ viewport: vp, isMobile: true, hasTouch: true });
  await p.goto((process.env.BASE || 'http://localhost:4321/portugal-events') + '/places/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1000);
  const box = await p.locator('[data-map]').boundingBox();
  const cx = box.x + box.width / 2, top = Math.max(box.y + 80, 90);
  const drag = async (dy) => { await p.mouse.move(cx, top); await p.mouse.down(); await p.mouse.move(cx, top + dy, { steps: 15 }); await p.mouse.up(); await p.waitForTimeout(400); };
  // default zoom: drag far "south" (content moves up => drag up)
  for (let i = 0; i < 4; i++) await drag(-250 * (name==='landscape'?0.5:1));
  await p.screenshot({ path: `${out}/south-${name}-z0.png` });
  // zoom in 2 levels via map API-free approach: double click twice
  await p.mouse.dblclick(cx, top + 40); await p.waitForTimeout(500);
  await p.mouse.dblclick(cx, top + 40); await p.waitForTimeout(700);
  for (let i = 0; i < 8; i++) await drag(-250 * (name==='landscape'?0.5:1));
  await p.screenshot({ path: `${out}/south-${name}-z2.png` });
  const z = await p.evaluate(() => document.querySelector('.leaflet-container') && document.querySelector('.leaflet-proxy') ? getComputedStyle(document.querySelector('.leaflet-proxy')).transform : 'n/a');
  console.log(name, z);
  await p.close();
}
await b.close();
