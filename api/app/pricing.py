"""pricing.py — the only module that produces a number.

Given a candidate car row and a dealer Config, predicts retail price and
days-to-sell (via the GB models trained in train.py), computes bid-ceiling
economics, counts comparable sales, and assigns a confidence tier. Never
calls an LLM. Never formats currency — everything here stays in lakh; rupee
formatting is a UI-layer concern only.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field

import joblib
import pandas as pd

HERE = os.path.dirname(__file__)
MODELS_DIR = os.path.join(HERE, "..", "models")
DATA_DIR = os.path.join(HERE, "..", "data")

FEATURES = [
    "age",
    "km",
    "owners",
    "popularity",
    "model",
    "city",
    "fuel",
    "transmission",
    "grade",
    "segment",
]

# Loaded once at import time, per ARCHITECTURE.md — never per request.
_price_model = joblib.load(os.path.join(MODELS_DIR, "price.joblib"))
_dts_model = joblib.load(os.path.join(MODELS_DIR, "dts.joblib"))
_sold = pd.read_parquet(os.path.join(DATA_DIR, "sold.parquet"))


@dataclass
class Config:
    target_margin: float = 0.09
    holding_per_day: float = 0.0012
    fees: float = 0.015
    grade_refurb: dict[str, float] = field(
        default_factory=lambda: {"A": 0.014, "B": 0.032, "C": 0.065}
    )


@dataclass
class Breakdown:
    predicted_retail: float
    refurb: float
    holding: float
    fees: float
    target_margin: float


@dataclass
class Comparable:
    model: str
    km: int
    city: str
    retail_price: float
    days_to_sell: int


@dataclass
class Priced:
    listing_id: str | None
    reserve_price: float | None
    predicted_retail: float
    predicted_days_to_sell: float
    max_bid: float | None
    expected_margin: float | None
    roi_pct: float | None
    headroom: float | None
    confidence: str
    n_comparables: int
    observed_range: tuple[float, float] | None
    breakdown: Breakdown | None
    comparables: list[Comparable]


def _comparable_rows(model: str, age: int, km: int) -> pd.DataFrame:
    return _sold[
        (_sold["model"] == model)
        & (_sold["age"].between(age - 1, age + 1))
        & (_sold["km"].between(km * 0.7, km * 1.3))
    ]


def _confidence(n: int) -> str:
    if n >= 30:
        return "high"
    if n >= 10:
        return "medium"
    return "low"


def price_row(row: dict, config: Config) -> Priced:
    x = pd.DataFrame([{k: row[k] for k in FEATURES}])
    pred_retail = float(_price_model.predict(x)[0])
    pred_dts = float(_dts_model.predict(x)[0])

    comps = _comparable_rows(row["model"], row["age"], row["km"])
    n = len(comps)
    confidence = _confidence(n)
    observed_range = (
        (round(float(comps["retail_price"].min()), 3), round(float(comps["retail_price"].max()), 3))
        if n > 0
        else None
    )
    top_comps = [
        Comparable(
            model=c["model"],
            km=int(c["km"]),
            city=c["city"],
            retail_price=round(float(c["retail_price"]), 3),
            days_to_sell=int(c["days_to_sell"]),
        )
        for c in comps.sort_values("days_to_sell").head(5).to_dict("records")
    ]

    listing_id = row.get("listing_id")
    reserve_price = row.get("reserve_price")

    if confidence == "low":
        return Priced(
            listing_id=listing_id,
            reserve_price=reserve_price,
            predicted_retail=round(pred_retail, 3),
            predicted_days_to_sell=round(pred_dts, 1),
            max_bid=None,
            expected_margin=None,
            roi_pct=None,
            headroom=None,
            confidence=confidence,
            n_comparables=n,
            observed_range=observed_range,
            breakdown=None,
            comparables=top_comps,
        )

    grade = row["grade"]
    refurb = pred_retail * config.grade_refurb[grade]
    holding = pred_dts * config.holding_per_day
    fees = pred_retail * config.fees
    target_margin_amt = pred_retail * config.target_margin

    max_bid = pred_retail - refurb - holding - fees - target_margin_amt
    expected_margin = pred_retail - max_bid - refurb - holding - fees
    roi_pct = (expected_margin / max_bid * 100) if max_bid > 0 else None
    headroom = (max_bid - reserve_price) if reserve_price is not None else None

    breakdown = Breakdown(
        predicted_retail=round(pred_retail, 3),
        refurb=round(refurb, 3),
        holding=round(holding, 3),
        fees=round(fees, 3),
        target_margin=round(target_margin_amt, 3),
    )

    return Priced(
        listing_id=listing_id,
        reserve_price=reserve_price,
        predicted_retail=round(pred_retail, 3),
        predicted_days_to_sell=round(pred_dts, 1),
        max_bid=round(max_bid, 3),
        expected_margin=round(expected_margin, 3),
        roi_pct=round(roi_pct, 2) if roi_pct is not None else None,
        headroom=round(headroom, 3) if headroom is not None else None,
        confidence=confidence,
        n_comparables=n,
        observed_range=observed_range,
        breakdown=breakdown,
        comparables=top_comps,
    )
