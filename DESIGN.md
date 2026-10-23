# DESIGN.md — Dealer Sourcing Co-pilot

**Read this before writing a single line of UI code.**

---

## 0. MODEL RULE — read first

**For every task in this file — design tokens, layout, components, motion, polish, design review — switch to Opus.**

If you are not on Opus when you reach UI work, stop and switch:
```
/model opus
```
Backend, data generation, model training and API plumbing can run on Sonnet. UI/UX runs on Opus. The design-review subagent (`.claude/agents/design-reviewer.md`) is pinned to Opus already.

The user has given **full permission** to inspect, screenshot, install packages, run browsers and iterate without asking for approval at each step. Don't stop to ask "should I proceed" — proceed.

---

## 1. STEP ONE — inspect the real CARS24 site. Do not skip this.

**Do not trust any hex code you find in a brand directory, including the ones below.** CARS24 **rebranded**: the all-caps wordmark became sentence-case "Cars24", the logo became an open circle, and the old blue was replaced with a brighter, more vibrant one. Published brand-asset sites still serve the pre-rebrand palette, so copying them gives you a site that looks like 2022.

Legacy values — **reference only, treat as probably wrong:** `#0059a3`, `#f8931f`, `#EF6E0B`, `#465166`.

### What to do instead

Use the `playwright-cli` skill (or `playwright` directly) and extract the live values yourself:

```bash
npx playwright screenshot --viewport-size=1440,900 --full-page \
  https://www.cars24.com design-refs/cars24-home-desktop.png
npx playwright screenshot --viewport-size=390,844 --full-page \
  https://www.cars24.com design-refs/cars24-home-mobile.png
npx playwright screenshot --viewport-size=1440,900 --full-page \
  "https://www.cars24.com/buy-used-cars-pune/" design-refs/cars24-listing.png
```

Then pull real computed styles:

```js
// scripts/extract-tokens.mjs  — run with: node scripts/extract-tokens.mjs
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('https://www.cars24.com', { waitUntil: 'networkidle' });

const out = await p.evaluate(() => {
  const freq = (vals) => Object.entries(vals.reduce((a, v) => (a[v] = (a[v] || 0) + 1, a), {}))
    .sort((a, b) => b[1] - a[1]).slice(0, 14);
  const els = [...document.querySelectorAll('*')].slice(0, 4000);
  const bg = [], fg = [], radius = [], font = [], size = [], weight = [], shadow = [];
  for (const el of els) {
    const s = getComputedStyle(el);
    if (s.backgroundColor !== 'rgba(0, 0, 0, 0)') bg.push(s.backgroundColor);
    fg.push(s.color);
    if (s.borderRadius !== '0px') radius.push(s.borderRadius);
    font.push(s.fontFamily); size.push(s.fontSize); weight.push(s.fontWeight);
    if (s.boxShadow !== 'none') shadow.push(s.boxShadow);
  }
  return { bg: freq(bg), fg: freq(fg), radius: freq(radius), font: freq(font),
           size: freq(size), weight: freq(weight), shadow: freq(shadow) };
});
console.log(JSON.stringify(out, null, 2));
await b.close();
```

**Write the result to `design-refs/cars24-tokens.json` and commit it.** That file — not this document, not a brand directory — is the source of truth for color, radius, type scale and shadow. Convert the top values into the CSS variables in §3.

If the site blocks you or Playwright can't run, say so explicitly in the README and fall back to the palette in §3 — but try first.

### Also capture
- Their **car listing card**: image ratio, where price sits, how specs are chipped, badge placement, corner radius, shadow depth
- Their **filter rail**: control style, spacing rhythm, how active filters are shown
- Their **button hierarchy**: primary fill, secondary outline, exact radius and height
- Their **empty / loading states** if reachable

Put every screenshot in `design-refs/`. You will diff your own UI against these later.

---

## 2. Design intent

This is a **money tool for a working dealer**, not a consumer car marketplace. CARS24's consumer site is bright, friendly and photo-led. Your product is the same *brand language* applied to a *decision surface*:

- Same color family, radius, type feel, warmth → it looks like it belongs in their ecosystem
- Denser information, more numbers, more restraint → it looks like a tool, not a landing page
- **The number is the hero.** Max bid is the biggest thing on every card. Everything else supports it.
- **Every number is clickable to its reason.** If a figure can't be explained, it shouldn't be shown.
- Confidence is visual, not a footnote. Low confidence looks different, not just labelled different.

One-line test for any screen you build: *would a dealer trust this with ₹2 lakh of his own money?*

---

## 3. Token system

Match the existing convention from the previous project: **Tailwind + shadcn-style CSS variables, no shadcn components.**

`src/index.css`:
```css
@layer base {
  :root {
    /* === REPLACE from design-refs/cars24-tokens.json === */
    --background:        0 0% 100%;
    --foreground:        222 20% 18%;
    --card:              0 0% 100%;
    --card-foreground:   222 20% 18%;
    --muted:             220 16% 96%;
    --muted-foreground:  220 10% 46%;
    --border:            220 16% 90%;
    --input:             220 16% 90%;
    --ring:              210 95% 52%;

    --primary:            210 95% 52%;   /* post-rebrand brighter blue */
    --primary-foreground: 0 0% 100%;

    --accent:             28 92% 54%;    /* CTA / highlight */
    --accent-foreground:  0 0% 100%;

    /* semantic — product-specific, not from their site */
    --profit:   152 60% 38%;   /* positive margin, headroom */
    --caution:  38 92% 50%;    /* thin margin, slow mover */
    --danger:   0 72% 51%;     /* no headroom, do not bid */
    --unknown:  220 10% 60%;   /* low confidence — deliberately grey, never green */

    --radius: 0.875rem;        /* replace with their real card radius */
  }

  .dark {
    --background:        222 24% 8%;
    --foreground:        210 20% 96%;
    --card:              222 22% 11%;
    --card-foreground:   210 20% 96%;
    --muted:             222 18% 16%;
    --muted-foreground:  220 10% 62%;
    --border:            222 18% 20%;
    --input:             222 18% 20%;
    --ring:              210 95% 58%;
    --primary:            210 95% 58%;
    --primary-foreground: 222 40% 10%;
    --accent:             28 92% 58%;
    --accent-foreground:  222 40% 10%;
    --profit:   152 55% 50%;
    --caution:  38 92% 58%;
    --danger:   0 72% 60%;
    --unknown:  220 10% 55%;
  }
}
```

Rules:
- **Never** a raw hex or `text-blue-500` in a component. Tokens only.
- Dark mode is built from the start, not retrofitted.
- Type: system font stack, same as the previous project. No webfont — it costs a round trip and CARS24's own stack is close enough.
- Spacing: 4px base. Use `2 / 3 / 4 / 6 / 8 / 12` and nothing in between.
- Numbers use `font-variant-numeric: tabular-nums` everywhere. Non-negotiable — jittering digits in a price column destroys trust.

### Money formatting
One helper, used everywhere:
```ts
// ₹1.97L  |  ₹22,464  |  ₹45K
export const lakh = (v: number) => `₹${v.toFixed(2)}L`;
export const rupee = (v: number) =>
  `₹${Math.round(v).toLocaleString('en-IN')}`;
```
Never print `1.9700000000000002`. Never mix lakh and rupee in the same visual row.

---

## 4. Component library sourcing

You have five libraries. **Use them for motion and texture, not for structure.** The layout and the cards are yours; these supply the moments.

| Source | Use it for | Where exactly |
|---|---|---|
| **reactbits.dev** — `https://reactbits.dev/get-started/index` | Text reveal + animated backgrounds. He already uses `ogl`, so WebGL components will run. | Hero/landing headline reveal; a single subtle animated gradient or aurora behind the search bar. **Nowhere near the results list.** |
| **magicui.design/docs/components** | `NumberTicker` for the max-bid figure, `AnimatedShinyText` for the confidence badge, `BorderBeam` on the top-ranked card, `Marquee` for the comparables strip, `BlurFade` for card entry. | The results area. These are the highest-value imports in the whole build. |
| **beui.dev/components/motion** | Motion primitives and transition presets — use these instead of hand-writing `motion` variants. | Card enter/exit, filter-panel expand, "why" drawer slide. |
| **toggles.dev** | The dark-mode toggle, and the manual/automatic + fuel segmented switches. | Header, filter rail. |
| **vengenceui.com/components** | Fill gaps — tooltip, skeleton, dialog, empty state — whatever's missing. | Utility layer. |

Hard rules:
1. **Copy source in, don't npm-install five libraries.** These are copy-paste component sets. Each component goes into `src/components/ui/<name>.tsx`, rewritten to use *your* tokens, not the library's hardcoded colors. A component that still carries its origin palette is a bug.
2. **One hero animation maximum.** A dealer scanning 20 cards does not want 20 animated borders. `BorderBeam` goes on rank #1 only.
3. **Nothing animates a number while it's being read.** `NumberTicker` runs once on arrival, 600ms, then it is static. No loop, no re-trigger on scroll.
4. If a component needs a dependency he doesn't have, prefer rewriting it with `motion` (already installed) over adding a package.

---

## 5. Screens

### 5.1 Header
Left: wordmark "Dealer Co-pilot" + a small `synthetic data` pill (honest, and it looks deliberate). Right: dark toggle (toggles.dev), economics button.

### 5.2 Search
Single wide input, generous height (56px), radius from tokens, subtle animated background behind it (reactbits). Placeholder rotates through real dealer phrasings:
> "hatchbacks under 5 lakh, under 60k km near Pune, flip in 3 weeks"
> "Creta or Seltos, automatic, Bengaluru, fast mover"
> "cheap grade A sedans I can turn in 2 weeks"

Below: 3–4 example-query chips. Click fills and submits. **These chips are the demo.** They must return good results — test them.

On submit: show the extracted filters as removable chips with a `BlurFade`. This is the trust moment — the dealer sees the machine understood him. If a filter is wrong he removes it and the list re-ranks.

### 5.3 Economics panel
Slide-over, not a modal. Four controls: target margin %, holding ₹/day, fees %, refurb multiplier. Each shows its current value inline. On change, debounce 250ms, re-fetch, and animate the affected numbers. The panel stays open so the dealer can watch bids move — that's the feature.

### 5.4 Result card — the centrepiece

Layout:
```
┌────────────────────────────────────────────────────────────┐
│ [#1]  2018 Maruti Swift                        ● high conf │
│       96,060 km · Pune · Grade C · Petrol · Manual         │
│                                                            │
│       MAX BID            ₹1.97L          ← NumberTicker,   │
│                                            largest type    │
│                                            on the screen   │
│       reserve ₹1.85L   ·   headroom +₹12,000               │
│                                                            │
│  ┌─ margin ──────┐ ┌─ ROI ────┐ ┌─ days to sell ──┐        │
│  │ ₹22,000       │ │ 11.2%    │ │ 26              │        │
│  └───────────────┘ └──────────┘ └─────────────────┘        │
│                                                            │
│  Why this number ⌄                      [ Place bid ]      │
└────────────────────────────────────────────────────────────┘
```

- Max bid: largest type on the page, `tabular-nums`, `NumberTicker` on first paint only
- Headroom: `--profit` when positive. Negative-headroom cards never render — they're in `skipped`
- Confidence dot: green `--profit` for high, amber `--caution` for medium. Medium cards get a one-line note: *"based on 14 comparable sales"*
- Rank #1 gets `BorderBeam`. Nothing else does.
- Cards enter staggered, 40ms apart, `BlurFade`, cap the stagger at 8 cards so the list doesn't feel slow

### 5.5 Low-confidence card — design this properly, it's the most interesting screen

Visually downgraded on purpose: muted background, **no bid number at all**, grey everything.
```
┌────────────────────────────────────────────────────────────┐
│  2019 Hyundai Verna                        ○ not enough    │
│  41,200 km · Nashik · Grade B                 data         │
│                                                            │
│  Only 4 comparable sales in the last 90 days.              │
│  Not enough to price this confidently.                     │
│  Observed range: ₹6.1L – ₹7.4L                             │
│                                                            │
│  [ Show anyway ]                                           │
└────────────────────────────────────────────────────────────┘
```
Never green, never a ticker, never a fake number behind a disclaimer. **A product that admits what it doesn't know is the single most convincing thing in this demo.** Give this card real design attention.

### 5.6 "Why this number" drawer
Expands in place (beui motion preset), does not navigate away.

Waterfall, each row animating in 60ms apart:
```
Predicted retail                 ₹2.42L
− Refurb (grade C, 6.5%)        −₹0.16L
− Holding (26 days × ₹120)      −₹0.03L
− Fees (1.5%)                   −₹0.04L
− Your target margin (9%)       −₹0.22L
─────────────────────────────────────────
Max bid                          ₹1.97L
```
Below it: 3–5 comparable sales as compact rows (model · age · km · city · sold price · days). A horizontal `Marquee` works well here if there are more than 5.

The arithmetic must visibly add up. A dealer will check it with a calculator. If it doesn't tie, the demo is over.

### 5.7 Clarification state
No results. Centered card, friendly:
> "Quick question — what's your budget, or which models are you after?"

With an inline input that appends to the original query and re-submits. This is a feature, not an error — style it as a conversation, not a validation failure.

### 5.8 Skipped summary
Below the list, quiet, muted:
> *23 cars skipped — no margin at your targets. 7 skipped — not enough comparable data.*

Clickable to reveal. This makes the system feel like it did work, not like it found only 12 cars.

### 5.9 Empty / loading
- Loading: skeleton cards matching the real card's exact geometry. Not a spinner.
- Zero matches: suggest the loosest filter to drop ("try raising the budget to ₹6L" — compute which single relaxation yields most results).

---

## 6. Motion spec

| Element | Motion | Duration | Easing |
|---|---|---|---|
| Card enter | blur + fade + 8px rise | 320ms | `[0.22, 1, 0.36, 1]` |
| Card stagger | 40ms, max 8 | — | — |
| Max bid number | count up from 0 | 600ms, once | ease-out |
| Why drawer | height + fade | 260ms | `[0.22, 1, 0.36, 1]` |
| Waterfall rows | fade + 4px rise | 180ms, 60ms apart | ease-out |
| Filter chip remove | scale 0.9 + fade | 150ms | ease-in |
| Economics re-compute | numbers crossfade, no layout shift | 400ms | ease-in-out |
| Hero background | continuous, very slow, low contrast | — | — |

Rules: nothing over 600ms except the background. Respect `prefers-reduced-motion` — wrap it once in a hook and gate every animation through it. **No layout shift during re-computation**: reserve the number's width with `tabular-nums` + a `min-w` so changing ₹1.97L → ₹2.11L doesn't move anything.

---

## 7. Responsive

Build desktop-first (that's the demo), but it **must not break on a phone** — he's sending this over WhatsApp, so it will be opened on a phone first, probably before anyone opens it on a laptop.

- `< 640px`: cards full-width, stat row wraps to 2+1, economics becomes a bottom sheet, hero background off (battery + legibility)
- `640–1024px`: single column, wider cards
- `> 1024px`: filter summary left rail, results right

Test at 390×844 before you call it done.

---

## 8. Verification loop — this is the part that makes it actually look good

After every meaningful UI change:

1. `npm run build` — must pass with zero errors
2. Screenshot your own page at 1440×900 and 390×844 via Playwright into `design-refs/mine-*.png`
3. **Look at both screenshots yourself** (read the image, don't assume)
4. Diff against `design-refs/cars24-*.png` on: radius, shadow depth, spacing rhythm, type scale, color temperature
5. Run the design-reviewer subagent:
   ```
   > use the design-reviewer subagent to review design-refs/mine-desktop.png
     against design-refs/cars24-home-desktop.png and the rules in DESIGN.md
   ```
6. Fix what it flags. Repeat until it returns nothing material.

**Do not ship UI you have not looked at in a screenshot.** Writing CSS and assuming is the single biggest cause of bad output here.

### Self-check before done
- [ ] No hardcoded hex or Tailwind color literal in any component
- [ ] Every component rewritten to local tokens (no library palette left over)
- [ ] All numbers `tabular-nums`
- [ ] Dark mode checked on every screen, not just the home screen
- [ ] `prefers-reduced-motion` kills all motion
- [ ] 390px wide: nothing overflows, nothing overlaps, no horizontal scroll
- [ ] Low-confidence card looks deliberately different, shows no number
- [ ] Waterfall arithmetic ties to max bid exactly
- [ ] Rank #1 is the only card with a beam
- [ ] Lighthouse ≥ 90 performance on desktop

---

## 9. Don't

- Don't use CARS24's logo, wordmark or brand assets. Match the *design language*; use your own name. Lifting their logo turns "look what I built" into "look what I copied".
- Don't claim affiliation anywhere in the UI.
- Don't animate more than one thing per card.
- Don't put a loading spinner where a skeleton belongs.
- Don't let the LLM's parsed filters render as raw JSON in the UI. Chips.
- Don't ship a UI with placeholder lorem text in any state, including states the demo doesn't hit.
