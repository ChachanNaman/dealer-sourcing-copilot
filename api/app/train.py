"""Trains the retail-price and days-to-sell models on sold_history.

Two independent GradientBoostingRegressor pipelines, per PRD §7. Persisted
with joblib to models/. Writes held-out MAE/MAPE to models/metrics.json —
these are the numbers the README must quote.
"""

from __future__ import annotations

import json
import os

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_absolute_percentage_error
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

NUM = ["age", "km", "owners", "popularity"]
CAT = ["model", "city", "fuel", "transmission", "grade", "segment"]
FEATURES = NUM + CAT

HERE = os.path.dirname(__file__)
DATA_DIR = os.path.join(HERE, "..", "data")
MODELS_DIR = os.path.join(HERE, "..", "models")


def _build_pipeline() -> Pipeline:
    return Pipeline(
        [
            (
                "prep",
                ColumnTransformer(
                    [("cat", OneHotEncoder(handle_unknown="ignore"), CAT)],
                    remainder="passthrough",
                ),
            ),
            (
                "gb",
                GradientBoostingRegressor(
                    n_estimators=300,
                    max_depth=3,
                    learning_rate=0.08,
                    random_state=7,
                ),
            ),
        ]
    )


def main() -> None:
    sold = pd.read_parquet(os.path.join(DATA_DIR, "sold.parquet"))
    x = sold[FEATURES]

    x_train, x_test, idx_train, idx_test = train_test_split(
        x, sold.index, test_size=0.2, random_state=7
    )

    y_price_train = sold.loc[idx_train, "retail_price"]
    y_price_test = sold.loc[idx_test, "retail_price"]
    y_dts_train = sold.loc[idx_train, "days_to_sell"]
    y_dts_test = sold.loc[idx_test, "days_to_sell"]

    price_model = _build_pipeline()
    price_model.fit(x_train, y_price_train)
    price_pred = price_model.predict(x_test)
    price_mae_lakh = mean_absolute_error(y_price_test, price_pred)
    price_mape = mean_absolute_percentage_error(y_price_test, price_pred)

    dts_model = _build_pipeline()
    dts_model.fit(x_train, y_dts_train)
    dts_pred = dts_model.predict(x_test)
    dts_mae = mean_absolute_error(y_dts_test, dts_pred)

    os.makedirs(MODELS_DIR, exist_ok=True)
    joblib.dump(price_model, os.path.join(MODELS_DIR, "price.joblib"))
    joblib.dump(dts_model, os.path.join(MODELS_DIR, "dts.joblib"))

    metrics = {
        "price_mae_rupees": round(price_mae_lakh * 100_000, 0),
        "price_mae_lakh": round(price_mae_lakh, 4),
        "price_mape_pct": round(price_mape * 100, 2),
        "dts_mae_days": round(dts_mae, 2),
        "n_train": int(len(x_train)),
        "n_test": int(len(x_test)),
    }
    with open(os.path.join(MODELS_DIR, "metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    print("=== Held-out metrics (n_test=%d) ===" % len(x_test))
    print(f"Retail price: MAE ₹{metrics['price_mae_rupees']:,.0f} ({metrics['price_mape_pct']}% MAPE)")
    print(f"Days to sell: MAE {metrics['dts_mae_days']} days")
    print(f"\nWrote models/price.joblib, models/dts.joblib, models/metrics.json")


if __name__ == "__main__":
    main()
