"""ranking.py — blended score over already-priced candidates.

Takes `list[Priced]` and returns an ordered `list[Priced]`. Never re-predicts
anything — pricing.py has already done that. Drops candidates with no
headroom or low confidence before scoring, per PRD §7.

Do not rank by ROI% alone: it biases toward cheap grade-C cars.
"""

from __future__ import annotations

from app.pricing import Priced

MARGIN_WEIGHT = 0.5
VELOCITY_WEIGHT = 0.3
CONFIDENCE_WEIGHT = 0.2
CONF_SCORE = {"high": 1.0, "medium": 0.6, "low": 0.0}


def _normalize(values: list[float]) -> list[float]:
    if not values:
        return []
    lo, hi = min(values), max(values)
    if hi == lo:
        return [1.0 for _ in values]
    return [(v - lo) / (hi - lo) for v in values]


def rank(candidates: list[Priced]) -> list[Priced]:
    eligible = [
        c
        for c in candidates
        if c.headroom is not None and c.headroom > 0 and c.confidence != "low"
    ]
    if not eligible:
        return []

    norm_margin = _normalize([c.expected_margin for c in eligible])
    norm_velocity = _normalize([1 / c.predicted_days_to_sell for c in eligible])

    scored = [
        (
            MARGIN_WEIGHT * nm
            + VELOCITY_WEIGHT * nv
            + CONFIDENCE_WEIGHT * CONF_SCORE[c.confidence],
            c,
        )
        for c, nm, nv in zip(eligible, norm_margin, norm_velocity)
    ]
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [c for _, c in scored]
