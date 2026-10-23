from __future__ import annotations

from app.pricing import Config, _sold, price_row

TOLERANCE_LAKH = 0.001  # ₹100


def _typical_row() -> dict:
    row = _sold[(_sold["model"] == "Maruti Swift") & (_sold["age"] == 3)].iloc[0]
    return {
        "listing_id": "L999999",
        "reserve_price": 2.0,
        "model": row["model"],
        "segment": row["segment"],
        "age": int(row["age"]),
        "km": int(row["km"]),
        "city": row["city"],
        "owners": int(row["owners"]),
        "fuel": row["fuel"],
        "transmission": row["transmission"],
        "grade": row["grade"],
        "popularity": float(row["popularity"]),
    }


def test_breakdown_sums_to_max_bid():
    priced = price_row(_typical_row(), Config())
    assert priced.confidence != "low"
    b = priced.breakdown
    recomputed = b.predicted_retail - b.refurb - b.holding - b.fees - b.target_margin
    assert abs(recomputed - priced.max_bid) <= TOLERANCE_LAKH


def test_low_confidence_returns_no_price():
    row = _typical_row()
    row["age"] = 10
    row["km"] = 3_000  # implausible combo -> near-zero comparables
    priced = price_row(row, Config())
    assert priced.confidence == "low"
    assert priced.max_bid is None
    assert priced.n_comparables < 10


def test_config_change_moves_max_bid_down_as_margin_rises():
    row = _typical_row()
    low_margin = price_row(row, Config(target_margin=0.09))
    high_margin = price_row(row, Config(target_margin=0.14))
    assert low_margin.confidence != "low"
    assert high_margin.max_bid < low_margin.max_bid


def test_units_are_lakh_not_rupees():
    priced = price_row(_typical_row(), Config())
    # a used hatchback should be single-digit lakh, not six-digit rupees
    assert 0.5 < priced.predicted_retail < 20
