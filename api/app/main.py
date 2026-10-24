"""main.py — FastAPI routes only. No business logic lives here."""

from __future__ import annotations

import os

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app import intent, pricing, ranking, search, trace
from app.schemas import (
    Breakdown,
    Comparable,
    Filters,
    ParseRequest,
    RecommendRequest,
    RecommendResponse,
    Result,
    Skipped,
)

app = FastAPI(title="Dealer Sourcing Co-pilot API")

# Allow the Vercel production domain and every preview deploy (*.vercel.app,
# which changes each push) plus local dev. No credentials are used, so this is
# an origin allowlist only.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://.*\.vercel\.app|http://localhost:\d+",
    allow_methods=["*"],
    allow_headers=["*"],
)

HERE = os.path.dirname(__file__)
_inventory = pd.read_parquet(os.path.join(HERE, "..", "data", "inventory.parquet"))

# Price the config-independent parts of the whole inventory once at startup, so
# each request is a cheap filter + arithmetic (critical on the free-tier CPU).
pricing.precompute(_inventory)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/parse")
def parse(body: ParseRequest) -> dict:
    parsed = intent.parse_intent(body.query)
    trace_id = trace.new_trace_id()
    trace.record(
        trace_id,
        query=body.query,
        raw_llm_output=parsed.raw_llm_output,
        filters=parsed.filters.model_dump(),
        used_fallback=parsed.used_fallback,
    )
    return {
        "trace_id": trace_id,
        "filters": parsed.filters.model_dump(),
        "used_fallback": parsed.used_fallback,
        "notice": parsed.notice,
    }


@app.post("/search")
def search_endpoint(filters: Filters) -> dict:
    matches = search.search(_inventory, filters)
    return {"listing_ids": matches["listing_id"].tolist(), "count": len(matches)}


def _title_subtitle(row: dict) -> tuple[str, str]:
    title = f"{row['year']} {row['model']}"
    subtitle = (
        f"{row['km']:,} km · {row['city']} · Grade {row['grade']} · "
        f"{row['fuel'].capitalize()} · {row['transmission'].capitalize()}"
    )
    return title, subtitle


def _to_result(p: pricing.Priced, row: dict) -> Result:
    title, subtitle = _title_subtitle(row)
    comparables = [
        Comparable(
            title=f"{c.model} · {c.km // 1000}k km · {c.city}",
            sold_at=c.retail_price,
            days_to_sell=c.days_to_sell,
        )
        for c in p.comparables
    ]
    reason = (
        f"Only {p.n_comparables} comparable sales — not enough to price confidently."
        if p.confidence == "low"
        else None
    )
    breakdown = (
        Breakdown(
            predicted_retail=p.breakdown.predicted_retail,
            refurb=p.breakdown.refurb,
            holding=p.breakdown.holding,
            fees=p.breakdown.fees,
            target_margin=p.breakdown.target_margin,
        )
        if p.breakdown
        else None
    )
    return Result(
        listing_id=p.listing_id,
        title=title,
        subtitle=subtitle,
        reserve_price=row["reserve_price"],
        max_bid=p.max_bid,
        expected_margin=p.expected_margin,
        roi_pct=p.roi_pct,
        predicted_days_to_sell=p.predicted_days_to_sell,
        confidence=p.confidence,
        headroom=p.headroom,
        observed_range=p.observed_range,
        reason=reason,
        breakdown=breakdown,
        comparables=comparables,
    )


@app.post("/recommend", response_model=RecommendResponse)
def recommend(body: RecommendRequest) -> RecommendResponse:
    trace_id = trace.new_trace_id()
    if body.filters is not None:
        # Dealer edited a filter chip — use the filters as given, skip the LLM.
        filters = body.filters
        raw_llm_output = None
    else:
        parsed = intent.parse_intent(body.query)
        filters = parsed.filters
        raw_llm_output = parsed.raw_llm_output

    if filters.clarification_needed:
        trace.record(
            trace_id,
            query=body.query,
            raw_llm_output=raw_llm_output,
            filters=filters.model_dump(),
            clarification=filters.clarification_question,
            candidate_count=0,
            scoring_inputs=[],
            final_output=[],
        )
        return RecommendResponse(
            trace_id=trace_id,
            filters=filters,
            clarification=filters.clarification_question,
            results=[],
            skipped=Skipped(low_confidence=0, no_headroom=0),
        )

    matches = search.search(_inventory, filters)
    pricing_config = pricing.Config(
        target_margin=body.config.target_margin,
        holding_per_day=body.config.holding_per_day,
        fees=body.config.fees,
        grade_refurb=body.config.grade_refurb,
    )

    match_rows = matches.to_dict("records")
    priced = [pricing.price_row(row, pricing_config) for row in match_rows]

    if filters.max_days_to_sell is not None:
        priced = [p for p in priced if p.predicted_days_to_sell <= filters.max_days_to_sell]

    low_confidence = sum(1 for p in priced if p.confidence == "low")
    no_headroom = sum(
        1 for p in priced if p.confidence != "low" and (p.headroom is None or p.headroom <= 0)
    )
    eligible = sum(
        1 for p in priced if p.confidence != "low" and p.headroom is not None and p.headroom > 0
    )

    ranked = ranking.rank(priced)
    beyond_top = max(0, eligible - len(ranked))

    rows_by_id = {row["listing_id"]: row for row in match_rows}
    results = [_to_result(p, rows_by_id[p.listing_id]) for p in ranked]

    # Surface a small sample of refused (low-confidence) cars so the UI can show
    # the "not enough data" card — the honesty screen. The full count is in
    # skipped.low_confidence.
    low_conf_sample = [
        _to_result(p, rows_by_id[p.listing_id])
        for p in priced
        if p.confidence == "low"
    ][:4]

    trace.record(
        trace_id,
        query=body.query,
        raw_llm_output=raw_llm_output,
        filters=filters.model_dump(),
        candidate_count=len(matches),
        scoring_inputs=[
            {
                "listing_id": p.listing_id,
                "expected_margin": p.expected_margin,
                "predicted_days_to_sell": p.predicted_days_to_sell,
                "confidence": p.confidence,
            }
            for p in priced
        ],
        final_output=[r.listing_id for r in results],
    )

    return RecommendResponse(
        trace_id=trace_id,
        filters=filters,
        clarification=None,
        results=results,
        low_confidence_results=low_conf_sample,
        skipped=Skipped(
            low_confidence=low_confidence,
            no_headroom=no_headroom,
            beyond_top=beyond_top,
        ),
    )


@app.get("/explain/{listing_id}", response_model=Result)
def explain(listing_id: str) -> Result:
    row = _inventory[_inventory["listing_id"] == listing_id]
    if row.empty:
        raise HTTPException(status_code=404, detail="listing not found")
    row_dict = row.iloc[0].to_dict()
    priced = pricing.price_row(row_dict, pricing.Config())
    return _to_result(priced, row_dict)


@app.get("/trace/{trace_id}")
def get_trace(trace_id: str) -> dict:
    t = trace.get(trace_id)
    if t is None:
        raise HTTPException(status_code=404, detail="trace not found")
    return t
