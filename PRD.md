# PRD — Dealer Sourcing Co-pilot

**Status:** v1, one-day build
**Owner:** Naman Chachan
**Goal:** a working, deployed, demo-able product in one day.

---

## 1. Problem

CARS24 runs **8,000+ used-car auctions per day**. Public research on their dealer app shows:

- A dealer scrolls to roughly the **25th car in a ~50-second session**, then leaves
- **Auto-bid is used in only 7 of every 100 auctions**
- Dealers who do use auto-bid **set caps below their own valuation** (values a car at ₹4L, caps at ₹3.7L)

Dealer *support* is already automated at CARS24 (their Dealer Experience Bot cut manual tickets 50%, turnaround 32 hrs → 30 min). Dealer *decisions* are not. A dealer has thousands of cars, under a minute of attention, and no price intelligence — so they bid on feel, or don't bid at all.

**This is not a browsing problem. It is a pricing-confidence problem.**

---

## 2. Solution

A dealer describes what they want in plain English. The system:

1. Converts the sentence into structured search filters (LLM)
2. Searches auction inventory deterministically (SQL)
3. Computes a **recommended maximum bid** for each car (ML model + cost formula — **not** the LLM)
4. Ranks by expected profit, turnover speed and confidence
5. Shows the comparable sales and cost breakdown behind every number
6. Refuses to quote a price when there isn't enough comparable data

**Core design rule — this is the whole point of the product:**

> **The LLM parses language. A model computes the number. Rules make the decision. The dealer confirms it.**

The language model never outputs a price, a valuation, or a bid. Enforced by schema and by assertion.

---

## 3. Users

| User | Need |
|---|---|
| **Primary — used-car dealer** | "Which of today's 8,000 auctions should I bid on, and what's my ceiling?" |
| Secondary — demo viewer (CARS24 engineer) | "Does this person understand where AI belongs in a system?" |

---

## 4. Scope

### In scope (v1)
- Natural-language query → structured filters
- Deterministic inventory search
- Retail price model + days-to-sell model
- Bid ceiling with configurable dealer economics
- Blended ranking
- "Why this number" explanation with comparables
- Confidence gating (refuses to price thin data)
- Clarifying question on ambiguous queries
- Request tracing
- Eval harness (script, not UI)

### Explicitly out of scope — state this in the README
- Real auction integration, live bidding, payments
- Authentication, multi-tenant, user accounts
- Per-dealer personalisation learned from real sell-through history (designed for, not implemented)
- Condition grade inferred from photos (grade is a given field)
- Mobile app

---

## 5. User stories

**US1 — Plain-language sourcing**
As a dealer, I type "hatchbacks under 5 lakh, under 60k km near Pune that I can flip in 3 weeks" and get matching auction cars.
*Acceptance:*
- Query returns results in < 3 seconds
- Extracted filters are visible to the user
- The time constraint ("3 weeks") hard-filters `predicted_days_to_sell <= 21`

**US2 — Recommended maximum bid**
As a dealer, each result shows a max bid I should not exceed.
*Acceptance:*
- Every priced result shows `max_bid`, `expected_margin`, `roi_pct`, `predicted_days_to_sell`
- `max_bid` is produced by the pricing module, never by the LLM
- Results where `max_bid <= reserve_price` are excluded and counted in `skipped.no_headroom`

**US3 — Show your work**
As a dealer, I can see why a bid number is what it is.
*Acceptance:*
- "Why this number" reveals: predicted retail, refurb, holding, fees, target margin
- At least 3 comparable historical sales are listed with price and days-to-sell
- The breakdown arithmetic visibly sums to `max_bid`

**US4 — My economics, not generic ones**
As a dealer, I can set my own margin target, holding cost, fees and refurb assumptions.
*Acceptance:*
- 4 controls: target margin %, holding cost ₹/day, fees %, refurb multiplier by grade
- Changing any control re-computes and re-ranks without a page reload
- Defaults: margin 9%, holding ₹120/day, fees 1.5%, refurb A/B/C = 1.4% / 3.2% / 6.5%

**US5 — Refuse rather than guess**
As a dealer, I am told when the system cannot price a car confidently.
*Acceptance:*
- `< 10` comparable sales → `confidence: "low"` → **no bid number shown**
- Instead shows: "Only N comparable sales — not enough to price confidently" + the observed price range
- Low-confidence cars are excluded from ranking and counted in `skipped.low_confidence`

**US6 — Ask rather than assume**
As a dealer, a vague query gets a question, not a wrong answer.
*Acceptance:*
- A query with no budget AND no model AND no city sets `clarification_needed: true`
- Exactly one short question is returned; no results are shown
- The question appears in the UI as a prompt the user can answer inline

**US7 — Nothing happens without me**
As a dealer, the system never places a bid.
*Acceptance:*
- "Place bid" is a stub that shows a confirmation dialog and does nothing else
- No endpoint mutates auction state

**US8 — Traceable decisions**
As a reviewer, I can see exactly how a result was produced.
*Acceptance:*
- Every `/recommend` call returns a `trace_id`
- `GET /trace/{id}` returns: raw query, raw LLM output, parsed filters, candidate count, scoring inputs, final output

---

## 6. Data model

**Units: all prices in lakh (₹100,000). Keep this consistent everywhere or the numbers break.**

### `auction_inventory`
| Field | Type | Notes |
|---|---|---|
| listing_id | str | `L100000`-style |
| model | str | e.g. "Maruti Swift" |
| segment | str | hatchback / sedan / suv |
| year | int | |
| age | int | `2026 - year` |
| km | int | |
| city | str | Pune, Mumbai, Bengaluru, Delhi, Hyderabad, Nashik |
| owners | int | 1–4 |
| fuel | str | petrol / diesel / cng |
| transmission | str | manual / automatic |
| grade | str | A / B / C inspection condition |
| popularity | float | 0–1 model demand index |
| reserve_price | float | lakh |

### `sold_history`
Same fields minus `listing_id` and `reserve_price`, plus:
| Field | Type |
|---|---|
| retail_price | float (lakh) |
| days_to_sell | int |

**Volumes:** 4,000 inventory rows, 10,000 sold rows. Generated, not scraped. **The README must say "synthetic data, no CARS24 data used or accessed" in the first screen.**

---

## 7. The pricing engine (exact spec)

Two gradient-boosting models trained on `sold_history`:

```python
NUM = ["age", "km", "owners", "popularity"]
CAT = ["model", "city", "fuel", "transmission", "grade", "segment"]

Pipeline([
  ("prep", ColumnTransformer([("cat", OneHotEncoder(handle_unknown="ignore"), CAT)],
                             remainder="passthrough")),
  ("gb", GradientBoostingRegressor(n_estimators=300, max_depth=3,
                                   learning_rate=0.08, random_state=7)),
])
```
Target 1: `retail_price`. Target 2: `days_to_sell`. Persist with joblib to `models/`.

**Reference benchmark (verified on this data generator — your numbers should land near these):**
- Retail price: **MAE ≈ ₹22,500, MAPE ≈ 4.2%**
- Days to sell: **MAE ≈ 5.0 days**

### Bid ceiling

```python
DEFAULTS = {
  "grade_refurb":    {"A": 0.014, "B": 0.032, "C": 0.065},  # × predicted retail
  "holding_per_day": 0.0012,   # lakh/day  (₹120/day)
  "fees":            0.015,    # 1.5% auction + transfer
  "target_margin":   0.09,     # dealer's required net margin
}

pred_retail = price_model.predict(x)
pred_dts    = dts_model.predict(x)

refurb  = pred_retail * grade_refurb[grade]
holding = pred_dts * holding_per_day
fees    = pred_retail * fees_pct

max_bid     = pred_retail - refurb - holding - fees - (pred_retail * target_margin)
exp_margin  = pred_retail - max_bid - refurb - holding - fees
headroom    = max_bid - reserve_price          # > 0 → worth bidding
roi_pct     = exp_margin / max_bid * 100
```

**Expected behaviour across 4,000 listings (verified):** ~67% have positive headroom, median headroom ≈ ₹24,000, median expected margin ≈ ₹45,000 (≈10.5% ROI). If your run is wildly off, a constant is wrong.

### Confidence

```python
comps = sold[(sold.model == car.model)
           & (sold.age.between(car.age - 1, car.age + 1))
           & (sold.km.between(car.km * 0.7, car.km * 1.3))]

n >= 30 → "high"   |   n >= 10 → "medium"   |   n < 10 → "low" (no price shown)
```

### Ranking

```python
candidates = [c for c in matches if c.headroom > 0 and c.confidence != "low"]

score = (0.5 * norm(exp_margin)      # absolute rupees
       + 0.3 * norm(1 / pred_dts)    # capital turnover
       + 0.2 * conf_weight)          # high=1.0, medium=0.6
```
**Do not rank by ROI% alone** — it biases toward cheap grade-C cars.

---

## 8. LLM intent parsing

### Output schema (strict)
```json
{
  "body_type": "hatchback | sedan | suv | null",
  "max_price_lakh": 5.0,
  "min_price_lakh": null,
  "max_km": 60000,
  "min_year": null,
  "city": "Pune",
  "fuel": "petrol | diesel | cng | null",
  "transmission": "manual | automatic | null",
  "grade_min": "A | B | C | null",
  "max_days_to_sell": 21,
  "models": ["Maruti Swift"],
  "clarification_needed": false,
  "clarification_question": null
}
```

### Prompt
```
You convert a used-car dealer's request into search filters.

RULES
- Output ONLY valid JSON matching the schema. No prose, no markdown fences.
- NEVER output a price estimate, valuation, or bid amount. You extract
  constraints only. Pricing is handled by a separate model.
- Any field not stated -> null. Do not invent values.
- "flip in N weeks" / "move fast" -> max_days_to_sell (weeks x 7).
- Lakh is the unit. "5L", "5 lakh", "500000" all -> 5.0
- If the request is too ambiguous to search (no budget AND no model AND
  no city), set clarification_needed=true and ask ONE short question.

SCHEMA
{schema}

REQUEST
{user_query}
```

### Validation — non-negotiable
1. `json.loads` → on failure, retry **once** with the error appended
2. Validate with a pydantic model, `extra="forbid"`
3. Assert no price-like key outside `max_price_lakh` / `min_price_lakh`
4. Two failures → fall back to keyword matching and surface a notice

---

## 9. API

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | liveness |
| POST | `/parse` | `{query}` → filters + trace_id |
| POST | `/search` | `{filters}` → listing ids |
| POST | `/recommend` | `{query, config}` → **the main endpoint** |
| GET | `/explain/{listing_id}` | breakdown + comparables |
| GET | `/trace/{trace_id}` | full decision trace |

### `POST /recommend` response
```json
{
  "trace_id": "t_8f2a",
  "filters": { "body_type": "hatchback", "max_price_lakh": 5.0, "...": "..." },
  "clarification": null,
  "results": [{
    "listing_id": "L100167",
    "title": "2018 Maruti Swift",
    "subtitle": "96,060 km · Pune · Grade C · Petrol · Manual",
    "reserve_price": 1.85,
    "max_bid": 1.97,
    "expected_margin": 0.22,
    "roi_pct": 11.2,
    "predicted_days_to_sell": 26,
    "confidence": "high",
    "headroom": 0.12,
    "breakdown": {
      "predicted_retail": 2.42, "refurb": 0.16, "holding": 0.03,
      "fees": 0.04, "target_margin": 0.22
    },
    "comparables": [
      {"title": "2018 Maruti Swift · 91k km · Pune", "sold_at": 2.45, "days_to_sell": 24}
    ]
  }],
  "skipped": { "low_confidence": 7, "no_headroom": 23 }
}
```

---

## 10. Acceptance criteria (the build is done when all pass)

- [ ] `POST /recommend` with *"hatchbacks under 5 lakh under 60k km near Pune"* returns ≥ 5 ranked results in < 3s
- [ ] Every result's `breakdown` arithmetic sums to its `max_bid` (± ₹100)
- [ ] A low-comparable car returns **no** `max_bid` and a reason string
- [ ] *"need stock"* returns `clarification_needed: true` and zero results
- [ ] Changing target margin 9% → 14% changes `max_bid` on every card and re-orders the list
- [ ] Eval script prints: field accuracy over 30 queries, **and price-leakage count = 0**
- [ ] `models/metrics.json` contains real held-out MAE/MAPE for both models
- [ ] `GET /trace/{id}` returns the full chain for any recommendation
- [ ] Frontend is deployed and loads on a phone browser
- [ ] README's first screen says the data is synthetic

---

## 11. Eval harness

`evals/queries.json` — 30 hand-written dealer queries with expected filters.
`evals/run_evals.py` prints:
```
Intent parsing : 30 queries, XX% field accuracy (NNN/NNN fields)
Failures       : <list with query + diff>
Price leakage  : 0/30
Price model    : MAE ₹X (Y% MAPE) on held-out n=2000
DTS model      : MAE Z days
```
Write these numbers into the README. **Measured beats claimed.**

---

## 12. Constraints

- **One day.** If behind at the UI stage, cut: voice input → trace viewer UI → eval count 30 → 15. Never cut: the "why" panel, confidence refusal, or the demo recording.
- Synthetic data only. No scraping CARS24.
- No secrets in the repo. `.env.example` only.
- The LLM call must have a timeout and a deterministic fallback — the product must still work if the API key is missing (keyword parsing path).
