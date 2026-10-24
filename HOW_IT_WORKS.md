# How it works — the whole thing in plain English

A used-car dealer types what they want ("hatchbacks under 5 lakh near Pune").
The app finds matching auction cars and tells them **the most they should bid on
each one** — and shows the full reasoning. This file explains every piece: the
AI, the ML, the math, and where everything lives.

> All prices are in **lakh** (₹1 lakh = ₹100,000). So `4.48L` = ₹4,48,000.

---

## 1. The one big idea

Four different things do four different jobs. None of them does another's job:

| Step | Who does it | What it produces |
|---|---|---|
| **1. Understand the sentence** | **AI (an LLM)** | search filters only — *never* a price |
| **2. Find matching cars** | plain database filter | a list of cars |
| **3. Work out the bid** | **ML model + a formula** | the max bid, margin, etc. |
| **4. Decide what to show** | simple rules | ranking + "refuse if unsure" |

> **The AI parses language. A model computes the number. Rules make the
> decision. The dealer confirms it.**

Why split it this way? Because an AI that makes up prices can't be trusted with
₹2 lakh. Here the AI *can't* produce a price even if it tried — it's only
allowed to output filters, and that's checked twice in code. If the AI
misunderstands, the worst that happens is a wrong *filter* (which the dealer sees
as a chip and can delete), never a wrong *bid*.

---

## 2. The AI side (understanding the sentence)

- You type: *"diesel SUVs under 15L that I can flip in 3 weeks"*.
- That text is sent to an **LLM** (the model `openai/gpt-oss-120b`, running on
  **Groq**). It's told: "turn this into JSON filters, and never output a price."
- It returns something like:
  ```json
  { "body_type": "suv", "fuel": "diesel", "max_price_lakh": 15,
    "max_days_to_sell": 21 }
  ```
  ("3 weeks" → 21 days.)
- **Two safety checks** stop any price sneaking out: (a) the data shape forbids
  any extra field, and (b) the code scans the AI's output and rejects anything
  that looks like a price/bid/valuation.
- **If the AI is down, slow, or you have no API key**, a simple keyword parser
  does the same job (it reads "diesel", "suv", "15L", "3 weeks" with patterns).
  So the app *always* works, AI or not.

That's the **only** place AI is used. Everything after this is deterministic
math — same input always gives the same output.

---

## 3. The ML side (predicting two numbers)

Two machine-learning models were trained, each a **Gradient Boosting
Regressor** (an ensemble of 300 small decision trees that correct each other's
mistakes). They learn from **10,000 past sales**:

1. **Price model** → predicts what a car will **sell for** (retail price).
2. **Days-to-sell model** → predicts **how long** it'll take to sell.

Each car is described by 10 features:
- **Numbers:** age, km, number of owners, popularity.
- **Categories:** model, city, fuel, transmission, grade (A/B/C), body type.
  (Categories get "one-hot encoded" — turned into yes/no columns the model can use.)

**How good are they?** (measured on 2,000 cars the model never saw during training)
- Price: off by **₹19,121 on average** (that's **3.88%** — quite tight).
- Days to sell: off by **4.6 days on average**.

These numbers describe the model on *synthetic* data — they're a measure of the
machine, not a claim about the real used-car market.

---

## 4. The math (turning a prediction into a bid)

This is the core — a plain cost formula. The ML gives us the predicted selling
price and days-to-sell; the formula subtracts every cost a dealer faces, plus
the profit they want, and whatever's left is the **most they can safely bid**.

```
max bid = predicted retail
          − refurb cost          (fixing the car up)
          − holding cost         (money tied up while it sits unsold)
          − fees                 (auction + transfer)
          − your target margin   (the profit you want to keep)
```

Each cost:
- **Refurb** = predicted retail × a % that depends on grade: **A 1.4%, B 3.2%,
  C 6.5%** (worse condition = more repair).
- **Holding** = predicted days-to-sell × **₹120/day** (capital sitting idle).
- **Fees** = predicted retail × **1.5%**.
- **Target margin** = predicted retail × **9%** (the dealer's required profit).

Then two more numbers:
- **Headroom** = max bid − the auction's reserve price. *Positive = worth
  bidding* (you can pay below your ceiling and still profit). Negative = skip it.
- **ROI %** = expected profit ÷ max bid × 100.

### A real worked example (the #1 card on the live site)

**2023 Maruti Baleno, 30,304 km, Pune, Grade A.** The ML predicts it'll **sell
for ₹5.12L**. The formula:

| Line | Amount |
|---|---|
| Predicted retail | **₹5.12L** |
| − Refurb (Grade A, 1.4%) | −₹0.07L |
| − Holding (24 days × ₹120) | −₹0.03L |
| − Fees (1.5%) | −₹0.08L |
| − Your target margin (9%) | −₹0.46L |
| **= Max bid** | **₹4.48L** |

The auction's reserve is ₹4.00L, so **headroom = ₹4.48L − ₹4.00L = +₹0.48L** —
you can win it under your ceiling and still make your ~₹46,000 margin. That's why
it ranks #1. The "Why this number" panel on each card shows exactly this, and the
numbers always add up to the max bid (checked in code).

**The key honesty rule:** the max bid is built from predicted retail minus real
costs. The AI never touches any of this.

---

## 5. "I won't guess" — the confidence rule

Before pricing a car, the app checks **how many similar cars actually sold**
before (same model, within ±1 year of age, within ±30% of the km). Call it `n`:

- `n ≥ 30` → **high** confidence.
- `n ≥ 10` → **medium** (shown with a note: "based on 14 comparable sales").
- `n < 10` → **low** → **no price is shown at all.** You get a muted card saying
  "Only 4 comparable sales — not enough to price confidently" and just the
  observed price range.

This is the most important behaviour in the whole product: a tool that admits
what it doesn't know is trustworthy. Around **6% of cars** fall into "low" and
are honestly refused rather than guessed.

---

## 6. Ranking — which cars float to the top

Cars with no headroom or low confidence are dropped. The rest get a **blended
score** (not just "cheapest profit %", which would push junky grade-C cars up):

```
score = 0.5 × profit (in ₹)      ← big absolute margin matters most
      + 0.3 × turnover speed     ← sells fast = capital freed fast
      + 0.2 × confidence         ← trust the data (high=1.0, medium=0.6)
```

Only the **top 20** are shown; the rest are summarised ("40 more considered").

---

## 7. The economics panel (why the bids move live)

Those four assumptions — margin %, holding ₹/day, fees %, refurb multiplier —
aren't fixed. The slider panel lets each dealer set their own. When you drag
**target margin from 9% to 14%**, every max bid drops and the list re-orders
instantly.

How it stays instant: the economics are sent **with each request**, not stored
on the server. Changing a slider just re-runs the cheap formula (step 4) on the
already-predicted numbers — no re-training, no page reload.

---

## 8. Where everything is stored

There's **no database**. It's deliberately simple:

| Thing | Where it lives | Format |
|---|---|---|
| The cars (4,000 auction + 10,000 past sales) | `api/data/*.parquet` | columnar data files |
| The two trained ML models | `api/models/*.joblib` | saved Python model files |
| The accuracy numbers | `api/models/metrics.json` | plain JSON |
| Request traces (for "show your work") | server memory | a dict, last 500 kept |

All of this data is **synthetic** — generated by a seeded simulator
(`generate_data.py`), so it's identical every time and **no real CARS24 data was
used or touched**.

**Speed trick:** when the server starts, it predicts and finds comparables for
*all* 4,000 cars **once** and caches the results. So a live request is just
"filter the list + do the cheap arithmetic" — it responds in ~1 second even on a
tiny free server.

---

## 9. How it's wired together (the flow)

```
You type a sentence
      │
      ▼  (AI — the only AI step)
intent.py   → turns words into filters (never a price)
      │
      ▼
search.py   → filters the 4,000 cars down to matches
      │
      ▼  (ML + math)
pricing.py  → predicted retail & days-to-sell  →  max bid, margin, headroom
            → counts comparable sales → confidence (or "refuse")
      │
      ▼  (rules)
ranking.py  → drop the bad ones, blend-score the rest, keep top 20
      │
      ▼
  JSON sent to the browser  →  React UI draws the cards
```

- **Backend:** Python + FastAPI, hosted on **Render**. It serves the JSON.
- **Frontend:** React + Vite, hosted on **Vercel**. It draws the cards, the
  "why" panel, the economics sliders.
- **Keep-alive:** a GitHub Action pings the backend every 10 minutes so the free
  server never falls asleep — anyone opening the link gets instant results.

---

## 10. The thirty-second summary

1. **AI** reads your English and turns it into search filters — nothing more.
2. A plain **filter** finds matching cars.
3. An **ML model** predicts each car's selling price and days-to-sell.
4. A **formula** subtracts refurb + holding + fees + your margin → **max bid**.
5. If there's **too little sales history**, it **refuses to price** instead of guessing.
6. Cars are **ranked** by profit + speed + confidence; top 20 shown.
7. **You** set your own economics and confirm the bid — the app never bids for you.

The whole point: *AI understands, a model calculates, rules decide, the dealer
confirms.*
