# CLAUDE.md

Dealer Sourcing Co-pilot. One-day build, ship at the end of the day.
Read `PRD.md` for what to build, `ARCHITECTURE.md` for where things go, `DESIGN.md` before any UI work, `TASKS.md` for order.

## Model

**UI/UX work runs on Opus.** Before starting any task in `DESIGN.md`, or any frontend task in `TASKS.md`, switch: `/model opus`. Backend, data, model training and API work can stay on Sonnet.

The user has given full permission: install packages, run browsers, take screenshots, iterate. Don't ask for approval per step.

## Commands

```bash
# backend
cd api && uv run uvicorn app.main:app --reload --port 8000
python -m app.generate_data      # writes data/*.parquet
python -m app.train              # writes models/*.joblib + models/metrics.json
python evals/run_evals.py        # must print price leakage 0

# frontend
cd ui && npm run dev
npm run build                    # must pass before any commit
npm run lint

# verification
python -m pytest -q
node scripts/shoot.mjs           # screenshots into design-refs/mine-*.png
```

## Non-negotiable rules

1. **The LLM never produces a price.** It outputs filters only. The pydantic schema forbids extra keys, and `evals/run_evals.py` asserts zero price leakage. If you're tempted to let the model estimate a value, you've broken the product.
2. **All prices in lakh** (₹100,000) as floats, everywhere — data, model, API, UI. Convert to rupees only in the display helper.
3. **No number without an explanation.** If a figure appears in the UI, `/explain` must be able to break it down.
4. **Low confidence shows no price.** `< 10` comparables → no bid number, ever, including behind a disclaimer.
5. **Synthetic data, labelled.** The README's first screen says so. Never imply CARS24 data was used or accessed.
6. **Nothing auto-bids.** "Place bid" is a confirm dialog stub.

## Conventions

- Python: FastAPI + pydantic v2, type hints on every public function, `ruff` clean. No class where a function does.
- Frontend: Vite + React + TS, Tailwind, shadcn-style CSS variables (tokens only, **no raw hex, no `text-blue-500`**), `class-variance-authority` + `clsx` + `tailwind-merge`, `lucide-react`, `motion` (standalone), `sonner` for toasts.
- Components from reactbits / magicui / beui / toggles.dev / vengenceui are **copied into `ui/src/components/ui/` and rewritten to our tokens** — not installed as five dependencies, and never left carrying their own palette.
- All currency rendered through `lakh()` / `rupee()` helpers. All numeric columns `tabular-nums`.
- Secrets in `.env`, never committed. `.env.example` is committed.

## Workflow

- Plan before coding on anything touching the pricing engine or the LLM boundary. Explore → plan → code → verify → commit.
- **Verify, don't assume.** Backend change → run the eval script. UI change → build, screenshot, *look at the screenshot*, then run the design-reviewer subagent.
- Commit after each completed `TASKS.md` phase, with the phase name in the message.
- Run the whole demo script (the 4 example queries) after every phase that touches search, pricing or ranking. A regression there kills the demo and is invisible otherwise.
- If a number looks wrong, check units first — lakh vs rupee is the bug 90% of the time.

## Cut order if time runs short

Cut in this order: voice input → trace viewer UI → evals 30 queries down to 15 → dark mode polish.
**Never cut:** the "why this number" panel, the low-confidence refusal card, the deployed URL, the 60-second screen recording.
