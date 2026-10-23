// Phase 8 verification captures: desktop + mobile in light & dark, plus a
// reduced-motion desktop shot to prove motion is actually killed. Dev server +
// API must be up. Run from repo root: node ui/scripts/shoot-phase8.mjs
import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, "..", "..", "design-refs");
const URL = "http://localhost:5173";
const SEL = 'input[aria-label="Describe what you want to source"]';
const QUERY = "hatchbacks under 5 lakh under 60k km near Pune";

const browser = await chromium.launch();

async function shoot({ name, vp, dark, reduced }) {
  const ctx = await browser.newContext({
    viewport: vp,
    deviceScaleFactor: 2,
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  if (dark) await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.fill(SEL, QUERY);
  await page.keyboard.press("Enter");
  await page.waitForSelector("article", { timeout: 15000 });
  // wait past the 600ms ticker + stagger so the frame is settled
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
  console.log(`${name}.png`);
  await ctx.close();
}

await shoot({ name: "mine-desktop", vp: { width: 1440, height: 900 }, dark: false });
await shoot({ name: "mine-desktop-dark", vp: { width: 1440, height: 900 }, dark: true });
await shoot({ name: "mine-mobile", vp: { width: 390, height: 844 }, dark: false });
await shoot({ name: "mine-mobile-dark", vp: { width: 390, height: 844 }, dark: true });
await shoot({ name: "mine-reduced", vp: { width: 1440, height: 900 }, dark: false, reduced: true });

await browser.close();
