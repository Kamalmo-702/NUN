"""Create the dashboard's static payload from the packaged, verified artefacts."""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    area = pd.read_csv(ROOT / "data" / "lake_chad_open_water_monthly.csv", parse_dates=["date"])
    pools = pd.read_csv(ROOT / "data" / "lake_chad_north_south_open_water_monthly.csv", parse_dates=["date"])
    projection = pd.read_csv(ROOT / "models" / "six_month_forward_projection.csv", parse_dates=["date"])
    model = json.loads((ROOT / "models" / "training_results.json").read_text(encoding="utf-8"))
    if not ((pools.south_open_water_km2 + pools.north_open_water_km2).round(6) == pools.lake_open_water_km2.round(6)).all():
        raise RuntimeError("Refusing to build dashboard payload: pool total does not reconcile")
    payload = {
        "metadata": model["source"] | model["coverage"],
        "series": [
            {"date": row.date.strftime("%Y-%m-%d"), "open_water_area_km2": round(float(row.open_water_area_km2), 3)}
            for row in area.itertuples()
        ],
        "pools": [
            {
                "date": row.date.strftime("%Y-%m-%d"),
                "south_open_water_km2": round(float(row.south_open_water_km2), 3),
                "north_open_water_km2": round(float(row.north_open_water_km2), 3),
                "lake_open_water_km2": round(float(row.lake_open_water_km2), 3),
            }
            for row in pools.itertuples()
        ],
        "projection": [
            {"date": row.date.strftime("%Y-%m-%d"), "forecast_open_water_area_km2": round(float(row.forecast_open_water_area_km2), 3)}
            for row in projection.itertuples()
        ],
        "model": model,
    }
    destination = ROOT / "dashboard" / "dashboard_data.json"
    destination.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {destination} with {len(payload['series'])} observations and {len(payload['pools'])} pool records.")


if __name__ == "__main__":
    main()
