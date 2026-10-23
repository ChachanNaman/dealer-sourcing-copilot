from __future__ import annotations

import pandas as pd

from app.intent import canonicalize_model
from app.schemas import CANONICAL_MODELS


def test_model_name_aliases_resolve_case_insensitively():
    for alias in ["swift", "Swift", "maruti swift", "SWIFT"]:
        assert canonicalize_model(alias) == "Maruti Swift"


def test_short_form_aliases_resolve():
    assert canonicalize_model("creta") == "Hyundai Creta"
    assert canonicalize_model("i20") == "Hyundai i20"


def test_unresolved_model_name_is_dropped_not_searched():
    assert canonicalize_model("Definitely Not A Real Car") is None


def test_every_canonical_model_exists_in_inventory():
    inventory = pd.read_parquet("data/inventory.parquet")
    inventory_models = set(inventory["model"].unique())
    missing = [m for m in CANONICAL_MODELS if m not in inventory_models]
    assert not missing, f"canonical model(s) missing from inventory.parquet: {missing}"
