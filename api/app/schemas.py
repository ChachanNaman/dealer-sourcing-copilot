"""schemas.py — pydantic v2 contracts for the API boundary.

`Filters.extra="forbid"` is half of the price-leakage guarantee (the other
half is the explicit assertion in intent.py): the LLM cannot smuggle a price
field past this model even if it tried.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Single source of truth for model names — must match generate_data.py's
# MODELS keys exactly. The guard test in tests/test_pricing.py checks this
# list against data/inventory.parquet so the two can't silently drift apart.
CANONICAL_MODELS: tuple[str, ...] = (
    "Maruti Alto",
    "Maruti Swift",
    "Maruti Baleno",
    "Hyundai Grand i10",
    "Hyundai i20",
    "Tata Tiago",
    "Maruti Dzire",
    "Honda Amaze",
    "Honda City",
    "Hyundai Verna",
    "Skoda Rapid",
    "Hyundai Creta",
    "Kia Seltos",
    "Tata Nexon",
    "Mahindra XUV300",
    "Maruti Brezza",
    "Toyota Urban Cruiser",
)


class Filters(BaseModel):
    model_config = ConfigDict(extra="forbid")

    body_type: Literal["hatchback", "sedan", "suv"] | None = None
    max_price_lakh: float | None = None
    min_price_lakh: float | None = None
    max_km: int | None = None
    min_year: int | None = None
    city: str | None = None
    fuel: Literal["petrol", "diesel", "cng"] | None = None
    transmission: Literal["manual", "automatic"] | None = None
    grade_min: Literal["A", "B", "C"] | None = None
    max_days_to_sell: int | None = None
    models: list[str] = Field(default_factory=list)
    clarification_needed: bool = False
    clarification_question: str | None = None

    @field_validator("models")
    @classmethod
    def _models_must_be_canonical(cls, v: list[str]) -> list[str]:
        invalid = [m for m in v if m not in CANONICAL_MODELS]
        if invalid:
            raise ValueError(f"unknown model name(s), not in CANONICAL_MODELS: {invalid!r}")
        return v


class Config(BaseModel):
    model_config = ConfigDict(extra="forbid")

    target_margin: float = 0.09
    holding_per_day: float = 0.0012
    fees: float = 0.015
    grade_refurb: dict[str, float] = Field(
        default_factory=lambda: {"A": 0.014, "B": 0.032, "C": 0.065}
    )


class Breakdown(BaseModel):
    predicted_retail: float
    refurb: float
    holding: float
    fees: float
    target_margin: float


class Comparable(BaseModel):
    title: str
    sold_at: float
    days_to_sell: int


class Result(BaseModel):
    listing_id: str
    title: str
    subtitle: str
    reserve_price: float
    max_bid: float | None
    expected_margin: float | None
    roi_pct: float | None
    predicted_days_to_sell: float
    confidence: Literal["high", "medium", "low"]
    headroom: float | None
    observed_range: tuple[float, float] | None = None
    reason: str | None = None
    breakdown: Breakdown | None
    comparables: list[Comparable]


class Skipped(BaseModel):
    low_confidence: int
    no_headroom: int


class RecommendRequest(BaseModel):
    query: str
    config: Config = Field(default_factory=Config)


class RecommendResponse(BaseModel):
    trace_id: str
    filters: Filters
    clarification: str | None
    results: list[Result]
    skipped: Skipped


class ParseRequest(BaseModel):
    query: str
