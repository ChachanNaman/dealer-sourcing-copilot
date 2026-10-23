# ARCHITECTURE.md

## Shape

```
Dealer types a sentence
        │
        ▼
┌─────────────────────┐
│ intent.py           │  LLM → strict JSON filters
│  (the ONLY LLM call)│  retry once, then keyword fallback
└──────────┬──────────┘
           │ filters (no price ever)
           ▼
┌─────────────────────┐
│ search.py           │  deterministic filter over auction_inventory
└──────────┬──────────┘
           │ candidate listings
           ▼
┌─────────────────────┐
│ pricing.py          │  GB model → predicted retail + days-to-sell
│                     │  cost formula → max_bid, margin, headroom
│                     │  comparables count → confidence
└──────────┬──────────┘
           │ priced candidates
           ▼
┌─────────────────────┐
│ ranking.py          │  drop headroom<=0 and confidence=="low"
│                     │  blended score 0.5 margin / 0.3 velocity / 0.2 conf
└──────────┬──────────┘
           ▼
     JSON response + trace_id
           │
           ▼
      React UI (cards, why-panel, economics)
```

**The boundary that matters:** `intent.py` is the only module that talks to an LLM. `pricing.py` is the only module that produces a number. They never touch each other. Any change that blurs this is a regression, not a feature.

## Files

```
dealer-copilot/
├─ CLAUDE.md  PRD.md  DESIGN.md  ARCHITECTURE.md  TASKS.md  README.md
├─ .claude/
│  └─ agents/design-reviewer.md
├─ design-refs/                 # cars24 screenshots + extracted tokens + your screenshots
│  ├─ cars24-home-desktop.png
│  ├─ cars24-tokens.json
│  └─ mine-desktop.png
├─ api/
│  ├─ app/
│  │  ├─ main.py                # FastAPI routes only, no logic
│  │  ├─ schemas.py             # pydantic: Filters(extra="forbid"), Result, Config
│  │  ├─ generate_data.py       # synthetic generator (exact spec in PRD §6-7)
│  │  ├─ train.py               # trains both models, writes metrics.json
│  │  ├─ intent.py              # LLM → Filters, retry, validate, fallback
│  │  ├─ search.py              # Filters → candidate rows
│  │  ├─ pricing.py             # predict, bid ceiling, comparables, confidence
│  │  ├─ ranking.py             # blended score
│  │  └─ trace.py               # in-memory dict trace_id → decision chain
│  ├─ data/                     # inventory.parquet, sold.parquet (gitignored)
│  ├─ models/                   # price.joblib, dts.joblib, metrics.json
│  ├─ evals/
│  │  ├─ queries.json           # 30 queries + expected filters
│  │  └─ run_evals.py
│  └─ tests/test_pricing.py     # arithmetic ties, confidence thresholds, units
├─ ui/
│  ├─ src/
│  │  ├─ index.css              # tokens (DESIGN.md §3)
│  │  ├─ lib/format.ts          # lakh(), rupee()
│  │  ├─ lib/api.ts             # typed fetch wrappers
│  │  ├─ hooks/useReducedMotion.ts
│  │  ├─ components/ui/         # copied-in + retokenised library components
│  │  └─ components/
│  │     ├─ SearchBar.tsx  FilterChips.tsx  EconomicsPanel.tsx
│  │     ├─ ResultCard.tsx  LowConfidenceCard.tsx  WhyPanel.tsx
│  │     ├─ Comparables.tsx  SkippedSummary.tsx  Header.tsx
│  │     └─ states/{Loading,Empty,Clarify}.tsx
│  └─ scripts/shoot.mjs         # playwright screenshots
└─ scripts/extract-tokens.mjs   # live cars24 computed-style extraction
```

## Module contracts

| Module | In | Out | Must not |
|---|---|---|---|
| `intent.py` | `str` | `Filters` | produce any price, call pricing, raise on bad LLM output |
| `search.py` | `Filters` | `list[Row]` | know about prices or models |
| `pricing.py` | `Row`, `Config` | `Priced` | call an LLM, format currency |
| `ranking.py` | `list[Priced]` | ordered list | re-predict anything |
| `main.py` | HTTP | JSON | contain business logic |

## Data flow details

- Models are loaded **once at startup** into module state. Never per request.
- Comparables are computed from `sold.parquet` held in memory (10k rows — trivial).
- `trace.py` is a plain dict with a 500-entry cap. No database in v1.
- `Config` (margin, holding, fees, refurb) travels in the `/recommend` body, so changing economics is a re-request, not server state. This is what makes the economics panel instant and stateless.
- The LLM call has a hard timeout (8s) and a keyword-parsing fallback, so the product works with no API key. Test that path explicitly — it's the path a reviewer hits if a key expires.

## Why this shape

Four reasons worth being able to say out loud in a conversation about this project:

1. **Auditable.** Any recommendation can be replayed from `/trace/{id}`. A pricing system you can't audit is a pricing system nobody deploys.
2. **The LLM is replaceable.** Swap the model, the provider, or drop to keyword parsing — the economics don't change, because language understanding and price computation are different subsystems.
3. **Failure is bounded.** A bad LLM parse yields wrong *filters* — the dealer sees them as chips and fixes them. It can never yield a wrong *bid*.
4. **Honest under thin data.** The confidence gate means the system declines rather than hallucinating a number. That's the difference between a demo and a tool.
