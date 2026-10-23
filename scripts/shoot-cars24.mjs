// One-off: capture CARS24 reference screenshots into design-refs/.
// Run from repo root: node scripts/shoot-cars24.mjs
// playwright lives in ui/node_modules (it's a devDependency of the UI), so we
// resolve it from there rather than adding a second copy at the repo root.
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '..', 'ui', 'package.json'));
const { chromium } = require('playwright');

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const outDir = path.join(here, '..', 'design-refs');
const shots = [
  { url: 'https://www.cars24.com', vp: { width: 1440, height: 900 }, out: 'cars24-home-desktop.png' },
  { url: 'https://www.cars24.com', vp: { width: 390, height: 844 }, out: 'cars24-home-mobile.png' },
  { url: 'https://www.cars24.com/buy-used-cars-pune/', vp: { width: 1440, height: 900 }, out: 'cars24-listing.png' },
];

const browser = await chromium.launch();
for (const { url, vp, out } of shots) {
  const ctx = await browser.newContext({ viewport: vp, userAgent: UA, locale: 'en-IN' });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  } catch (e) {
    console.error(`WARN goto ${url}: ${e.message} — capturing whatever rendered`);
  }
  await page.waitForTimeout(3500); // let lazy hero / cards settle
  await page.screenshot({ path: path.join(outDir, out), fullPage: true });
  console.log(`${out}  <-  ${url}  (title: ${JSON.stringify(await page.title())})`);
  await ctx.close();
}
await browser.close();
