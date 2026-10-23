"""search.py — deterministic filter over auction_inventory.

Knows nothing about prices or models. The max_days_to_sell constraint is not
applied here — predicted_days_to_sell only exists after pricing.py has run,
so that filter is applied downstream in main.py.
"""

from __future__ import annotations

import pandas as pd

from app.schemas import Filters

GRADE_ORDER = ["A", "B", "C"]


def search(inventory: pd.DataFrame, filters: Filters) -> pd.DataFrame:
    df = inventory

    if filters.body_type:
        df = df[df["segment"] == filters.body_type]
    if filters.max_price_lakh is not None:
        df = df[df["reserve_price"] <= filters.max_price_lakh]
    if filters.min_price_lakh is not None:
        df = df[df["reserve_price"] >= filters.min_price_lakh]
    if filters.max_km is not None:
        df = df[df["km"] <= filters.max_km]
    if filters.min_year is not None:
        df = df[df["year"] >= filters.min_year]
    if filters.city:
        df = df[df["city"].str.lower() == filters.city.lower()]
    if filters.fuel:
        df = df[df["fuel"] == filters.fuel]
    if filters.transmission:
        df = df[df["transmission"] == filters.transmission]
    if filters.grade_min:
        allowed = GRADE_ORDER[: GRADE_ORDER.index(filters.grade_min) + 1]
        df = df[df["grade"].isin(allowed)]
    if filters.models:
        wanted = {m.lower() for m in filters.models}
        df = df[df["model"].str.lower().isin(wanted)]

    return df
