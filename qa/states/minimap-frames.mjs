// Minimap first-second frames on a place page (OSRM delayed 600ms).
//   BASE=<url> node qa/states/minimap-frames.mjs <outDir>
import { chromium } from 'playwright';
import fs from 'node:fs';
const out = process.argv[2] || 'qa/out/minimap';
fs.mkdirSync(out, { recursive: true });
const B = process.env.BASE || 'http://localhost:4321/portugal-events';
const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.route('**/router.project-osrm.org/**', async (r) => { await new Promise((s) => setTimeout(s, 600)); await r.continue(); });
p.goto(B + '/places/tavira/').catch(() => {});
await p.waitForSelector('.minimap .leaflet-tile-pane', { state: 'attached', timeout: 15000 });
const box = await p.locator('.minimap').boundingBox();
for (let i = 0; i < 12; i++) {
  await p.screenshot({ path: `${out}/f${String(i).padStart(2, '0')}.png`, clip: box });
  await p.waitForTimeout(120);
}
await b.close();
