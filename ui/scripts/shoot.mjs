// Screenshot our own running UI (dev server on :5173) after a real query,
// into design-refs/mine-*.png. Run from repo root with the dev server up:
//   node ui/scripts/shoot.mjs
import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, "..", "..", "design-refs");
const URL = process.env.UI_URL ?? "http://localhost:5173";
const QUERY = "hatchbacks under 5 lakh under 60k km near Pune";

const browser = await chromium.launch();

for (const [label, vp] of [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844 }],
]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.fill('input[aria-label="Describe what you want to source"]', QUERY);
  await page.keyboard.press("Enter");
  // wait for at least one result card to render
  try {
    await page.waitForSelector("article", { timeout: 15000 });
  } catch {
    console.error(`${label}: no result cards appeared within 15s`);
  }
  await page.waitForTimeout(800);
  // viewport shot (matches DESIGN.md's 1440x900 / 390x844) for readable review
  await page.screenshot({ path: path.join(outDir, `mine-${label}.png`) });
  // plus a shot scrolled to the first result card so the centrepiece is visible
  const card = await page.$("article");
  if (card) {
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(outDir, `mine-${label}-cards.png`) });
  }
  console.log(`mine-${label}.png + mine-${label}-cards.png written`);
  await ctx.close();
}

await browser.close();
