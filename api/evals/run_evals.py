"""run_evals.py — intent-parsing accuracy, price-leakage check, model metrics.

Run from api/: `uv run python evals/run_evals.py`
"""

from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import intent

FIELDS = [
    "body_type",
    "max_price_lakh",
    "min_price_lakh",
    "max_km",
    "min_year",
    "city",
    "fuel",
    "transmission",
    "grade_min",
    "max_days_to_sell",
    "models",
    "clarification_needed",
]

HERE = os.path.dirname(__file__)


def _fields_match(got, expected) -> bool:
    if isinstance(expected, list):
        return set(got) == set(expected)
    return got == expected


def main() -> None:
    with open(os.path.join(HERE, "queries.json")) as f:
        cases = json.load(f)

    total_fields = 0
    correct_fields = 0
    failures: list[dict] = []
    price_leaks = 0

    for case in cases:
        query = case["query"]
        expected = case["expected"]
        result = intent.parse_intent(query)
        if result.price_leak_detected:
            price_leaks += 1

        got = result.filters.model_dump()
        diffs = {}
        for field in FIELDS:
            total_fields += 1
            if _fields_match(got[field], expected[field]):
                correct_fields += 1
            else:
                diffs[field] = {"expected": expected[field], "got": got[field]}

        if diffs:
            failures.append({"query": query, "diffs": diffs})

    accuracy_pct = correct_fields / total_fields * 100

    print(f"Intent parsing : {len(cases)} queries, {accuracy_pct:.1f}% field accuracy ({correct_fields}/{total_fields} fields)")

    print(f"Failures       : {len(failures)}")
    for failure in failures:
        print(f"  - {failure['query']!r}")
        for field, diff in failure["diffs"].items():
            print(f"      {field}: expected={diff['expected']!r} got={diff['got']!r}")

    print(f"Price leakage  : {price_leaks}/{len(cases)}")

    metrics_path = os.path.join(HERE, "..", "models", "metrics.json")
    if os.path.exists(metrics_path):
        with open(metrics_path) as f:
            metrics = json.load(f)
        print(
            f"Price model    : MAE ₹{metrics['price_mae_rupees']:,.0f} "
            f"({metrics['price_mape_pct']}% MAPE) on held-out n={metrics['n_test']}"
        )
        print(f"DTS model      : MAE {metrics['dts_mae_days']} days")
    else:
        print("Price model    : models/metrics.json not found — run train.py first")


if __name__ == "__main__":
    main()
