# TASKS.md — one-day build order

Work top to bottom. Commit at the end of each phase. `/clear` between phases to keep context clean.
**Switch to Opus at Phase 5 and stay there through Phase 8.**

---

## Phase 0 — Setup (30 min)

- [ ] `git init`, repo scaffold per `ARCHITECTURE.md`
- [ ] `api/`: `uv init`, add fastapi, uvicorn, pandas, pyarrow, scikit-learn, joblib, pydantic, python-dotenv, openai/anthropic client, pytest, ruff
- [ ] `ui/`: `npm create vite@latest ui -- --template react-ts`, add tailwind, cva, clsx, tailwind-merge, lucide-react, motion, sonner, ogl, vite-plugin-pwa
- [ ] `.env.example`, `.gitignore` (data/, models/, .env, node_modules)
- [ ] **Commit: "scaffold"**

## Phase 1 — Data (45 min)

- [ ] `generate_data.py` exactly per PRD §6–7: 4,000 inventory + 10,000 sold rows
- [ ] Sanity-print: price distribution by segment, mean days-to-sell, grade split, city split
- [ ] Gate: no negative prices, no age < 0, every model present in both tables
- [ ] **Commit: "synthetic data generator"**

## Phase 2 — Models (45 min)

- [ ] `train.py`: two pipelines (price, days-to-sell), 80/20 split, GB params from PRD §7
- [ ] Write real held-out MAE/MAPE to `models/metrics.json`
- [ ] Gate: price MAE within ~₹30k and MAPE under ~6%; DTS MAE under ~7 days. If far off, the generator or the feature list is wrong — fix before moving on
- [ ] **Commit: "pricing + days-to-sell models"**

## Phase 3 — Pricing engine (1 hr)

- [ ] `pricing.py`: predict → refurb/holding/fees/margin → `max_bid`, `exp_margin`, `headroom`, `roi_pct`
- [ ] Comparables lookup + confidence gate (30 / 10 thresholds)
- [ ] `ranking.py`: filter `headroom > 0` and `confidence != "low"`, blended score 0.5/0.3/0.2
- [ ] `tests/test_pricing.py`: breakdown sums to max_bid ±₹100; low-confidence returns no price; config change moves max_bid in the right direction; units are lakh
- [ ] Gate: run over all 4,000 listings — expect roughly 67% positive headroom, median margin near ₹45k. Eyeball the top 5 (if they're all ₹2L grade-C beaters, your ranking is ROI-biased — recheck the weights)
- [ ] **Commit: "pricing engine + ranking"**

## Phase 4 — LLM + API (1 hr 15 min)

- [ ] `schemas.py`: `Filters` with `extra="forbid"`, `Config`, `Result`
- [ ] `intent.py`: prompt from PRD §8, `json.loads` → retry once with error → pydantic validate → keyword fallback
- [ ] Price-leakage assertion: no price-like key outside `max_price_lakh` / `min_price_lakh`
- [ ] `search.py`, `trace.py`
- [ ] `main.py`: `/health`, `/parse`, `/search`, `/recommend`, `/explain/{id}`, `/trace/{id}`
- [ ] `evals/queries.json` (30 queries) + `run_evals.py`
- [ ] Gate: evals print field accuracy and **price leakage 0/30**. Test the no-API-key fallback path explicitly
- [ ] **Commit: "intent parsing + API"**

---

## ⚠️ SWITCH TO OPUS NOW — `/model opus`

Read `DESIGN.md` fully before Phase 5.

---

## Phase 5 — Design extraction (45 min)

- [ ] `npx playwright` screenshots of cars24.com: desktop, mobile, a listing page → `design-refs/`
- [ ] `scripts/extract-tokens.mjs` → `design-refs/cars24-tokens.json`
- [ ] Convert the extracted values into `ui/src/index.css` tokens (light + dark)
- [ ] Write down in a comment which values came from the live site and which you had to invent
- [ ] **Commit: "design tokens from live cars24 inspection"**

## Phase 6 — UI skeleton (1 hr 15 min)

- [ ] `lib/format.ts`, `lib/api.ts`, `hooks/useReducedMotion.ts`
- [ ] Header + dark toggle (toggles.dev, retokenised)
- [ ] SearchBar + rotating placeholder + example chips
- [ ] FilterChips, EconomicsPanel (slide-over, 4 controls, debounced)
- [ ] ResultCard with the real layout from DESIGN.md §5.4 — static first, no motion yet
- [ ] Loading skeletons matching card geometry
- [ ] Gate: `npm run build` clean; end-to-end query renders real results from the API
- [ ] **Commit: "ui skeleton, live end to end"**

## Phase 7 — The three screens that sell it (1 hr 15 min)

- [ ] `WhyPanel` with the waterfall + comparables. **Verify the arithmetic ties.**
- [ ] `LowConfidenceCard` — muted, no number, observed range, "show anyway"
- [ ] `Clarify` state with inline answer input
- [ ] `SkippedSummary`
- [ ] Gate: all four example chips produce good results; at least one query surfaces a low-confidence card; the vague query triggers clarification
- [ ] **Commit: "why panel, confidence refusal, clarification"**

## Phase 8 — Motion + polish (1 hr)

- [ ] magicui: `NumberTicker` on max bid (once, 600ms), `BorderBeam` on rank #1 only, `BlurFade` card entry
- [ ] beui motion presets for drawer + panel
- [ ] reactbits: one subtle animated background behind the search bar, desktop only
- [ ] `prefers-reduced-motion` gate on everything
- [ ] Dark mode pass on **every** screen
- [ ] 390×844 pass — no overflow, no overlap, no horizontal scroll
- [ ] Screenshot desktop + mobile → run the `design-reviewer` subagent → fix what it flags → repeat
- [ ] Gate: Lighthouse ≥ 90 desktop; design-reviewer returns nothing material
- [ ] **Commit: "motion + design review pass"**

## Phase 9 — Ship (45 min)

- [ ] `README.md`: what it is, the one-line design principle, **"synthetic data — no CARS24 data used or accessed"** in the first screen, real metrics from `models/metrics.json`, eval numbers, architecture diagram, how to run
- [ ] Deploy: API to Railway/Render, UI to Vercel. Set `VITE_API_URL`. Test the live URL on a phone.
- [ ] Record a **60-second screen capture**: type a query → results appear → open "why this number" → change target margin and watch bids move → show the low-confidence refusal. No narration needed; the screen does it.
- [ ] Push to GitHub, public, with the recording as a GIF in the README
- [ ] **Commit: "ship"**

## Phase 10 — Final check (15 min)

- [ ] Open the live URL on a phone, cold, as if you'd just received the link
- [ ] Run all four example queries on the live deploy
- [ ] Confirm nothing in the UI or README implies affiliation with CARS24
- [ ] Confirm the README's claimed numbers match `models/metrics.json` exactly — don't round up, don't "about"

---

## Time budget

| Phase | Time | Running |
|---|---|---|
| 0 Setup | 0:30 | 0:30 |
| 1 Data | 0:45 | 1:15 |
| 2 Models | 0:45 | 2:00 |
| 3 Pricing | 1:00 | 3:00 |
| 4 LLM + API | 1:15 | 4:15 |
| 5 Design extraction | 0:45 | 5:00 |
| 6 UI skeleton | 1:15 | 6:15 |
| 7 Key screens | 1:15 | 7:30 |
| 8 Motion + polish | 1:00 | 8:30 |
| 9 Ship | 0:45 | 9:15 |
| 10 Final check | 0:15 | 9:30 |

Behind at 6:15? Cut from Phase 8 (motion), not Phase 7 (the screens that make the point).
