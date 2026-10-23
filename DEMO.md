# DEMO.md — what gets sent

The build only matters if the 60 seconds someone spends on it lands. Build these assets as part of Phase 9, not as an afterthought.

## The four demo queries

These are hardcoded as the example chips. **Test every one on the live deploy.** If any returns a weak list, fix the query text or the data, not the demo.

1. `hatchbacks under 5 lakh, under 60k km near Pune, flip in 3 weeks`
   → should return 8–15 cars, several with headroom above ₹20k
2. `Creta or Seltos, automatic, Bengaluru, fast mover`
   → should return a tighter list with low days-to-sell
3. `cheap grade A sedans I can turn in 2 weeks`
   → should surface at least one **low-confidence refusal** card
4. `need stock`
   → should return the **clarification question**, zero results

Queries 3 and 4 are the ones that make the product look thought-through. Don't let them break.

## The 60-second recording

Single take, no narration, no cuts. Order:

| Time | What's on screen |
|---|---|
| 0–8s | Type query 1. Filters appear as chips. |
| 8–20s | Ranked cards land. Camera rests on the top card's max bid. |
| 20–35s | Open "Why this number." The waterfall ties to the bid. Comparables below. |
| 35–48s | Open economics, drag target margin 9% → 14%. Every bid drops, list re-orders. |
| 48–60s | Scroll to the low-confidence card. It shows no number and says why. |

Export as MP4 and as a GIF. GIF goes in the README; MP4 goes on WhatsApp.

## The WhatsApp message

Short. Link first, context second, no pitch.

> Built a thing over the weekend — a sourcing co-pilot for dealers on auction inventory.
> You describe what you want in plain English, it finds matching cars and computes a max bid per car — predicted retail minus refurb, holding, fees and your margin target. Every number opens into its own breakdown with comparables, and it refuses to quote a price when there aren't enough comparable sales.
> Synthetic data, no real inventory. Live: <url> · Code: <repo>
> [attach the 60s clip]

Rules for the message:
- Lead with what it does, not what it's built with
- Say "synthetic data" in the message itself, not only in the README
- No ask. No "would love your feedback on whether there's a role." The build is the ask.
- One link, one repo, one clip. Three attachments is a pitch deck.

## README must contain

- One-line description
- The design principle: *the LLM parses language, a model computes the number, rules make the decision, the dealer confirms it*
- **"Synthetic data — no CARS24 data was used or accessed"** in the first screen of text
- Real measured numbers, copied from `models/metrics.json` — price MAE/MAPE, DTS MAE, eval field accuracy, price leakage 0
- The architecture diagram from `ARCHITECTURE.md`
- The GIF
- How to run locally
- A short "what I'd do next" — per-dealer sell-through personalisation, photo-based grade inference, live auction integration

## Honesty rules — hold these

- Never state or imply CARS24 uses a particular technology unless you have a public source for it
- Never imply affiliation, partnership or that this was built for them
- Never present synthetic-data metrics as real-world performance. They measure the model, not the market.
- If someone asks how accurate it is on real data, the answer is "unknown — this is synthetic; the architecture is the point." That answer is more impressive than a made-up number.
