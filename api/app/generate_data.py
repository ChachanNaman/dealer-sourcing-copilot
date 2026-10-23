"""Synthetic auction-inventory and sold-history generator.

No CARS24 data is used or accessed. All relationships below (depreciation
curves, city/fuel/transmission premiums, popularity -> days-to-sell) are
invented to produce plausible, learnable correlations for the pricing models
trained in train.py. Prices are in lakh (INR 100,000) throughout.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

CURRENT_YEAR = 2026
N_INVENTORY = 4_000
N_SOLD = 10_000
SEED = 7

CITIES = ["Pune", "Mumbai", "Bengaluru", "Delhi", "Hyderabad", "Nashik"]
FUELS = ["petrol", "diesel", "cng"]
TRANSMISSIONS = ["manual", "automatic"]
GRADES = ["A", "B", "C"]

# model -> (segment, base_price_lakh at age 0, popularity_mean)
MODELS: dict[str, tuple[str, float, float]] = {
    "Maruti Alto": ("hatchback", 5.2, 0.55),
    "Maruti Swift": ("hatchback", 7.0, 0.80),
    "Maruti Baleno": ("hatchback", 7.8, 0.72),
    "Hyundai Grand i10": ("hatchback", 6.8, 0.60),
    "Hyundai i20": ("hatchback", 8.5, 0.70),
    "Tata Tiago": ("hatchback", 6.5, 0.58),
    "Maruti Dzire": ("sedan", 8.2, 0.75),
    "Honda Amaze": ("sedan", 8.6, 0.62),
    "Honda City": ("sedan", 13.5, 0.78),
    "Hyundai Verna": ("sedan", 13.0, 0.68),
    "Skoda Rapid": ("sedan", 10.5, 0.45),
    "Hyundai Creta": ("suv", 15.5, 0.85),
    "Kia Seltos": ("suv", 15.8, 0.80),
    "Tata Nexon": ("suv", 11.5, 0.76),
    "Mahindra XUV300": ("suv", 11.8, 0.60),
    "Maruti Brezza": ("suv", 11.2, 0.74),
    "Toyota Urban Cruiser": ("suv", 11.0, 0.55),
}

CITY_MULT = {
    "Mumbai": 1.05,
    "Bengaluru": 1.05,
    "Delhi": 1.02,
    "Pune": 1.00,
    "Hyderabad": 0.98,
    "Nashik": 0.92,
}
FUEL_MULT = {"diesel": 1.03, "petrol": 1.00, "cng": 0.95}
TRANS_MULT = {"automatic": 1.08, "manual": 1.00}
GRADE_PRICE_MULT = {"A": 1.05, "B": 1.00, "C": 0.90}
GRADE_DTS_MULT = {"A": 0.85, "B": 1.00, "C": 1.30}

MODEL_NAMES = list(MODELS.keys())


def _sample_rows(rng: np.random.Generator, n: int) -> pd.DataFrame:
    model = rng.choice(MODEL_NAMES, size=n)
    segment = np.array([MODELS[m][0] for m in model])
    base_price = np.array([MODELS[m][1] for m in model])
    popularity_mean = np.array([MODELS[m][2] for m in model])

    age = rng.integers(0, 11, size=n)
    year = CURRENT_YEAR - age

    avg_km_per_year = rng.normal(12_000, 2_500, size=n).clip(4_000, 22_000)
    km = (age * avg_km_per_year * rng.normal(1.0, 0.15, size=n)).clip(500, 250_000).astype(int)

    owners = np.clip(
        1 + rng.poisson(lam=age / 6.0, size=n) + (rng.random(n) < 0.05).astype(int),
        1,
        4,
    )

    city = rng.choice(CITIES, size=n)
    fuel = rng.choice(FUELS, size=n, p=[0.55, 0.33, 0.12])
    transmission = rng.choice(TRANSMISSIONS, size=n, p=[0.78, 0.22])
    grade = rng.choice(GRADES, size=n, p=[0.35, 0.45, 0.20])

    popularity = (popularity_mean + rng.normal(0, 0.08, size=n)).clip(0.05, 0.99)

    city_mult = np.array([CITY_MULT[c] for c in city])
    fuel_mult = np.array([FUEL_MULT[f] for f in fuel])
    trans_mult = np.array([TRANS_MULT[t] for t in transmission])
    grade_price_mult = np.array([GRADE_PRICE_MULT[g] for g in grade])
    grade_dts_mult = np.array([GRADE_DTS_MULT[g] for g in grade])

    depreciation = 0.855**age
    km_factor = (1 - (km / 300_000) * 0.30).clip(0.55, 1.0)
    owner_mult = (1 - (owners - 1) * 0.03).clip(0.85, 1.0)
    popularity_price_mult = 0.92 + 0.16 * popularity

    noise = rng.normal(1.0, 0.035, size=n)
    retail_price = (
        base_price
        * depreciation
        * km_factor
        * owner_mult
        * city_mult
        * fuel_mult
        * trans_mult
        * grade_price_mult
        * popularity_price_mult
        * noise
    ).clip(0.8, None)

    price_bracket = retail_price / base_price
    dts_noise = rng.normal(1.0, 0.18, size=n)
    days_to_sell = (
        30
        * (1.9 - popularity)
        * grade_dts_mult
        * (0.7 + 0.5 * price_bracket)
        * dts_noise
    ).clip(2, 95).astype(int)

    return pd.DataFrame(
        {
            "model": model,
            "segment": segment,
            "year": year,
            "age": age,
            "km": km,
            "city": city,
            "owners": owners,
            "fuel": fuel,
            "transmission": transmission,
            "grade": grade,
            "popularity": popularity.round(3),
            "retail_price": retail_price.round(3),
            "days_to_sell": days_to_sell,
        }
    )


def generate_inventory(rng: np.random.Generator) -> pd.DataFrame:
    df = _sample_rows(rng, N_INVENTORY)
    # reserve_price: auction floor, a noisy fraction of the "true" retail value
    reserve_mult = rng.normal(0.80, 0.07, size=len(df)).clip(0.55, 0.98)
    df["reserve_price"] = (df["retail_price"] * reserve_mult).round(3)
    df = df.drop(columns=["retail_price", "days_to_sell"])
    df.insert(0, "listing_id", [f"L{100000 + i}" for i in range(len(df))])
    return df


def generate_sold(rng: np.random.Generator) -> pd.DataFrame:
    return _sample_rows(rng, N_SOLD)


def _sanity_report(inventory: pd.DataFrame, sold: pd.DataFrame) -> None:
    print("=== Price distribution by segment (sold_history, lakh) ===")
    print(sold.groupby("segment")["retail_price"].describe()[["mean", "std", "min", "max"]])

    print("\n=== Mean days-to-sell overall and by segment ===")
    print(f"overall mean dts: {sold['days_to_sell'].mean():.1f} days")
    print(sold.groupby("segment")["days_to_sell"].mean())

    print("\n=== Grade split (sold_history) ===")
    print(sold["grade"].value_counts(normalize=True).round(3))

    print("\n=== City split (sold_history) ===")
    print(sold["city"].value_counts(normalize=True).round(3))

    print("\n=== Inventory reserve_price summary (lakh) ===")
    print(inventory["reserve_price"].describe()[["mean", "std", "min", "max"]])


def main() -> None:
    rng = np.random.default_rng(SEED)
    inventory = generate_inventory(rng)
    sold = generate_sold(rng)

    assert (inventory["reserve_price"] > 0).all(), "negative/zero reserve price found"
    assert (sold["retail_price"] > 0).all(), "negative/zero retail price found"
    assert (inventory["age"] >= 0).all(), "negative age in inventory"
    assert (sold["age"] >= 0).all(), "negative age in sold"
    assert set(inventory["model"]) == set(MODEL_NAMES), "inventory missing some models"
    assert set(sold["model"]) == set(MODEL_NAMES), "sold missing some models"

    out_dir = __file__.rsplit("/app/", 1)[0] + "/data"
    import os

    os.makedirs(out_dir, exist_ok=True)
    inventory.to_parquet(f"{out_dir}/inventory.parquet", index=False)
    sold.to_parquet(f"{out_dir}/sold.parquet", index=False)

    print(f"Wrote {len(inventory)} inventory rows and {len(sold)} sold rows to {out_dir}\n")
    _sanity_report(inventory, sold)


if __name__ == "__main__":
    main()
