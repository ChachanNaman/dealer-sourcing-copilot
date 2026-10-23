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
import logging
import os
import re
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

from app.schemas import CANONICAL_MODELS, Filters

# Load api/.env explicitly so this works regardless of the server's or the
# eval script's current working directory.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

logger = logging.getLogger(__name__)

TIMEOUT_S = 8.0
GROQ_BASE_URL = "https://api.groq.com/openai/v1"
GROQ_MODEL = "openai/gpt-oss-120b"  # llama-3.3-70b-versatile was retired; closest current large instruct model with json_mode support

ALLOWED_PRICE_KEYS = {"max_price_lakh", "min_price_lakh"}
_PRICE_PATTERN = re.compile(r"price|bid|valuat|worth|\bcost\b", re.IGNORECASE)

CITIES = ["Pune", "Mumbai", "Bengaluru", "Delhi", "Hyderabad", "Nashik"]
BODY_TYPES = ["hatchback", "sedan", "suv"]
FUELS = ["petrol", "diesel", "cng"]

PROMPT_TEMPLATE = """You convert a used-car dealer's request into search filters.

RULES
- Output ONLY valid JSON matching the schema. No prose, no markdown fences.
- NEVER output a price estimate, valuation, or bid amount. You extract
  constraints only. Pricing is handled by a separate model.
- Any field not stated -> null. Do not invent values.
- "flip in N weeks" / "move fast" -> max_days_to_sell (weeks x 7).
- Lakh is the unit. "5L", "5 lakh", "500000" all -> 5.0
- "models" may ONLY contain values from this exact list — copy the string
  exactly as written here, including the brand. Never invent a model name,
  never drop the brand prefix:
  {model_list}
- Count how many fields above are non-null/non-empty (models counts as one
  field if the list is non-empty). If fewer than 2, the request is too vague
  to search — set clarification_needed=true and ask ONE short question.
  Otherwise leave it false.

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


def canonicalize_model(raw: str) -> str | None:
    """Resolves a (possibly partial/mis-cased) model string to its exact
    canonical name. Exact case-insensitive match first, then unique
    case-insensitive substring match ("swift" -> "Maruti Swift"). Returns
    None if nothing matches or more than one canonical name matches."""
    raw_lower = raw.strip().lower()
    for name in CANONICAL_MODELS:
        if name.lower() == raw_lower:
            return name
    matches = [name for name in CANONICAL_MODELS if raw_lower in name.lower()]
    if len(matches) == 1:
        return matches[0]
    return None


def canonicalize_models(raw_models: list[str]) -> tuple[list[str], list[str]]:
    """Maps each raw string to a canonical model name, deduplicated.
    Returns (canonical_names, dropped_raw_strings) — dropped entries are
    ambiguous or unrecognised and must never reach search."""
    canonical: list[str] = []
    dropped: list[str] = []
    for raw in raw_models:
        resolved = canonicalize_model(raw)
        if resolved is None:
            dropped.append(raw)
        elif resolved not in canonical:
            canonical.append(resolved)
    return canonical, dropped


def _model_short_form(name: str) -> str:
    return name.split(" ", 1)[1] if " " in name else name


_MODEL_SHORT_FORMS = [_model_short_form(name) for name in CANONICAL_MODELS]


def _extract_model_candidates(q: str) -> list[str]:
    """Finds brand-less mentions too: a dealer typing "swift" should match,
    not just "maruti swift". Candidates are canonicalized by the caller."""
    candidates = []
    for short in _MODEL_SHORT_FORMS:
        if re.search(r"\b" + re.escape(short.lower()) + r"\b", q):
            candidates.append(short)
    return candidates


def _call_groq(prompt: str, api_key: str) -> str:
    from openai import OpenAI

    client = OpenAI(api_key=api_key, base_url=GROQ_BASE_URL, timeout=TIMEOUT_S)
    resp = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
        response_format={"type": "json_object"},
    )
    return resp.choices[0].message.content or ""


def _call_llm(prompt: str) -> str:
    groq_key = os.getenv("GROQ_API_KEY")
    if groq_key:
        return _call_groq(prompt, groq_key)
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

    model_candidates = _extract_model_candidates(q)
    models, dropped_models = canonicalize_models(model_candidates)
    if dropped_models:
        logger.warning("keyword_fallback dropped unresolved model mention(s): %r", dropped_models)

    meaningful_count = sum(
        1
        for v in [
            body_type, max_price_lakh, min_price_lakh, max_km, min_year,
            city, fuel, transmission, grade_min, max_days_to_sell,
        ]
        if v is not None
    ) + (1 if models else 0)
    clarification_needed = meaningful_count < 2
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
    if not os.getenv("GROQ_API_KEY"):
        return ParseResult(
            filters=keyword_fallback(query),
            raw_llm_output=None,
            used_fallback=True,
            price_leak_detected=False,
            notice="No LLM API key configured — used keyword fallback.",
        )

    model_list = "\n".join(f"  - {name}" for name in CANONICAL_MODELS)
    schema_json = json.dumps(Filters.model_json_schema(), indent=2)
    prompt = PROMPT_TEMPLATE.format(schema=schema_json, user_query=query, model_list=model_list)

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
            if isinstance(raw.get("models"), list):
                canonical_models, dropped = canonicalize_models(raw["models"])
                if dropped:
                    logger.warning(
                        "LLM model name(s) could not be canonicalized and were dropped: %r (query=%r)",
                        dropped,
                        query,
                    )
                raw["models"] = canonical_models
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
            logger.warning("intent parse attempt %d failed for query %r: %s", attempt, query, e)
            continue

    fallback = keyword_fallback(query)
    return ParseResult(
        filters=fallback,
        raw_llm_output=last_raw,
        used_fallback=True,
        price_leak_detected=price_leak_detected,
        notice=f"LLM parsing failed twice ({last_error}) — used keyword fallback.",
    )
