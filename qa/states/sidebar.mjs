// Sidebar facets: folded region/tag lists, then expanded. BASE=<url> node qa/states/sidebar.mjs
import { chromium } from 'playwright';
const B = process.env.BASE || 'http://localhost:4321/portugal-events';
const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto(B + '/places/?tag=' + encodeURIComponent('вино'), { waitUntil: 'networkidle' });
await p.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });
await p.waitForTimeout(800);
const bar = p.locator('.filter-bar-top');
await bar.evaluate((el) => (el.scrollTop = 700));
await p.waitForTimeout(300);
await p.screenshot({ path: 'qa/out/f1/sidebar-folded.png', clip: { x: 0, y: 60, width: 300, height: 840 } });
await p.locator('[data-fgroup="region"] [data-expand]').click();
await p.waitForTimeout(300);
await p.screenshot({ path: 'qa/out/f1/sidebar-expanded.png', clip: { x: 0, y: 60, width: 300, height: 840 } });
await b.close();
