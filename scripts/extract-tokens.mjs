// Extract real computed styles from the live cars24.com and write the
// frequency tables to design-refs/cars24-tokens.json. That file — not DESIGN.md,
// not any brand directory — is the source of truth for colour, radius, type
// scale and shadow. Run from repo root: node scripts/extract-tokens.mjs
//
// playwright lives in ui/node_modules; resolve it from there (see shoot-cars24.mjs).
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '..', 'ui', 'package.json'));
const { chromium } = require('playwright');

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

async function extract(page) {
  return page.evaluate(() => {
    const freq = (vals) =>
      Object.entries(vals.reduce((a, v) => ((a[v] = (a[v] || 0) + 1), a), {}))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 14);
    const els = [...document.querySelectorAll('*')].slice(0, 4000);
    const bg = [], fg = [], radius = [], font = [], size = [], weight = [], shadow = [];
    for (const el of els) {
      const s = getComputedStyle(el);
      if (s.backgroundColor !== 'rgba(0, 0, 0, 0)') bg.push(s.backgroundColor);
      fg.push(s.color);
      if (s.borderRadius !== '0px') radius.push(s.borderRadius);
      font.push(s.fontFamily);
      size.push(s.fontSize);
      weight.push(s.fontWeight);
      if (s.boxShadow !== 'none') shadow.push(s.boxShadow);
    }
    return {
      bg: freq(bg), fg: freq(fg), radius: freq(radius),
      font: freq(font), size: freq(size), weight: freq(weight), shadow: freq(shadow),
    };
  });
}

const browser = await chromium.launch();
const result = {};
for (const [key, url] of [
  ['home', 'https://www.cars24.com'],
  ['listing', 'https://www.cars24.com/buy-used-cars-pune/'],
]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent: UA, locale: 'en-IN' });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  } catch (e) {
    console.error(`WARN goto ${url}: ${e.message}`);
  }
  await page.waitForTimeout(3000);
  result[key] = await extract(page);
  result[key].url = url;
  await ctx.close();
}
await browser.close();

const outPath = path.join(here, '..', 'design-refs', 'cars24-tokens.json');
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
