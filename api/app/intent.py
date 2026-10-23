"""intent.py — the ONLY module that talks to an LLM.

Converts a dealer's natural-language request into strict Filters JSON.
Retries once on invalid output, then falls back to keyword parsing — either
on two failures or because no API key is configured. The product must work
with no key at all; test that path explicitly.

Never produces a price. Enforced twice: the Filters schema forbids extra
keys, and _assert_no_price_leakage rejects any price-shaped key in the raw
JSON before it ever reaches pydantic.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass

from app.schemas import Filters

TIMEOUT_S = 8.0
ANTHROPIC_MODEL = "claude-haiku-4-5-20251001"
OPENAI_MODEL = "gpt-4o-mini"

ALLOWED_PRICE_KEYS = {"max_price_lakh", "min_price_lakh"}
_PRICE_PATTERN = re.compile(r"price|bid|valuat|worth|\bcost\b", re.IGNORECASE)

CITIES = ["Pune", "Mumbai", "Bengaluru", "Delhi", "Hyderabad", "Nashik"]
BODY_TYPES = ["hatchback", "sedan", "suv"]
FUELS = ["petrol", "diesel", "cng"]
MODEL_NAMES = [
    "Maruti Alto", "Maruti Swift", "Maruti Baleno", "Hyundai Grand i10",
    "Hyundai i20", "Tata Tiago", "Maruti Dzire", "Honda Amaze", "Honda City",
    "Hyundai Verna", "Skoda Rapid", "Hyundai Creta", "Kia Seltos",
    "Tata Nexon", "Mahindra XUV300", "Maruti Brezza", "Toyota Urban Cruiser",
]

PROMPT_TEMPLATE = """You convert a used-car dealer's request into search filters.

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
"""


@dataclass
class ParseResult:
    filters: Filters
    raw_llm_output: str | None
    used_fallback: bool
    price_leak_detected: bool
    notice: str | None


def _assert_no_price_leakage(raw: dict) -> None:
    for key in raw:
        if key in ALLOWED_PRICE_KEYS:
            continue
        if _PRICE_PATTERN.search(key):
            raise ValueError(f"price-like key leaked from LLM output: {key!r}")


def _clean_json_text(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _call_anthropic(prompt: str, api_key: str) -> str:
    from anthropic import Anthropic

    client = Anthropic(api_key=api_key)
    msg = client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=500,
        timeout=TIMEOUT_S,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text


def _call_openai(prompt: str, api_key: str) -> str:
    from openai import OpenAI

    client = OpenAI(api_key=api_key, timeout=TIMEOUT_S)
    resp = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
    )
    return resp.choices[0].message.content or ""


def _call_llm(prompt: str) -> str:
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")
    if anthropic_key:
        return _call_anthropic(prompt, anthropic_key)
    if openai_key:
        return _call_openai(prompt, openai_key)
    raise RuntimeError("no LLM API key configured")


def _weeks_to_days(query: str) -> int | None:
    m = re.search(r"(\d+)\s*weeks?\b", query, re.IGNORECASE)
    if m:
        return int(m.group(1)) * 7
    m = re.search(r"(?:flip|sells?|sold|move)\s+in\s+(\d+)\s*days?\b", query, re.IGNORECASE)
    if m:
        return int(m.group(1))
    return None


def _extract_max_km(q: str) -> tuple[int | None, str]:
    """Returns (max_km, query_with_km_phrase_removed) so the price regex
    downstream can't mistake "60k km" for a price of 60 lakh."""
    m = re.search(r"([\d,]+)\s*(k)?\s*km\b", q)
    if not m:
        return None, q
    number = int(m.group(1).replace(",", ""))
    max_km = number * 1000 if m.group(2) else number
    return max_km, q[: m.start()] + " " + q[m.end() :]


def _extract_price_bounds(q: str) -> tuple[float | None, float | None]:
    between = re.search(r"between\s+([\d.]+)\s+and\s+([\d.]+)\s*lakh", q)
    if between:
        return float(between.group(2)), float(between.group(1))

    max_price = None
    min_price = None
    under = re.search(r"under\s+(?:₹\s*)?([\d.]+)\s*(?:l\b|lakh|lakhs)?", q)
    if under:
        max_price = float(under.group(1))
    above = re.search(r"above\s+(?:₹\s*)?([\d.]+)\s*(?:l\b|lakh|lakhs)?", q)
    if above:
        min_price = float(above.group(1))
    return max_price, min_price


def keyword_fallback(query: str) -> Filters:
    q = query.lower()

    body_type = next((b for b in BODY_TYPES if b in q or f"{b}s" in q), None)
    city = next((c for c in CITIES if c.lower() in q), None)
    fuel = next((f for f in FUELS if f in q), None)
    transmission = "automatic" if re.search(r"automatic|\bauto\b", q) else (
        "manual" if "manual" in q else None
    )
    grade_min = None
    grade_match = re.search(r"grade\s+([abc])\b", q)
    if grade_match:
        grade_min = grade_match.group(1).upper()

    max_km, q_no_km = _extract_max_km(q)

    min_year = None
    year_match = re.search(r"(20\d{2})\s*(?:or newer|and newer|\+)", q)
    if year_match:
        min_year = int(year_match.group(1))

    max_price_lakh, min_price_lakh = _extract_price_bounds(q_no_km)
    max_days_to_sell = _weeks_to_days(q)

    models = [m for m in MODEL_NAMES if m.lower() in q]

    clarification_needed = not (max_price_lakh or min_price_lakh or models or city)
    clarification_question = (
        "Could you share a budget, a city, or a model you're interested in?"
        if clarification_needed
        else None
    )

    return Filters(
        body_type=body_type,
        max_price_lakh=max_price_lakh,
        min_price_lakh=min_price_lakh,
        max_km=max_km,
        min_year=min_year,
        city=city,
        fuel=fuel,
        transmission=transmission,
        grade_min=grade_min,
        max_days_to_sell=max_days_to_sell,
        models=models,
        clarification_needed=clarification_needed,
        clarification_question=clarification_question,
    )


def parse_intent(query: str) -> ParseResult:
    if not os.getenv("ANTHROPIC_API_KEY") and not os.getenv("OPENAI_API_KEY"):
        return ParseResult(
            filters=keyword_fallback(query),
            raw_llm_output=None,
            used_fallback=True,
            price_leak_detected=False,
            notice="No LLM API key configured — used keyword fallback.",
        )

    schema_json = json.dumps(Filters.model_json_schema(), indent=2)
    prompt = PROMPT_TEMPLATE.format(schema=schema_json, user_query=query)

    last_error: str | None = None
    last_raw: str | None = None
    price_leak_detected = False

    for attempt in range(2):
        try:
            raw_text = _call_llm(
                prompt
                if attempt == 0
                else f"{prompt}\n\nYour previous output was invalid JSON: {last_error}\nReturn ONLY corrected JSON."
            )
            last_raw = raw_text
            cleaned = _clean_json_text(raw_text)
            raw = json.loads(cleaned)
            try:
                _assert_no_price_leakage(raw)
            except ValueError:
                price_leak_detected = True
                raise
            filters = Filters.model_validate(raw)
            return ParseResult(
                filters=filters,
                raw_llm_output=raw_text,
                used_fallback=False,
                price_leak_detected=price_leak_detected,
                notice=None,
            )
        except Exception as e:  # noqa: BLE001 — any LLM/network/parse failure falls back, never crashes
            last_error = str(e)
            continue

    fallback = keyword_fallback(query)
    return ParseResult(
        filters=fallback,
        raw_llm_output=last_raw,
        used_fallback=True,
        price_leak_detected=price_leak_detected,
        notice=f"LLM parsing failed twice ({last_error}) — used keyword fallback.",
    )
