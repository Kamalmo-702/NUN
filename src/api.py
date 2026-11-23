"""Read-only API for the delivered Lake Chad open-water training package.

Every endpoint is derived only from the packaged CSV, model, and evaluation
artefacts. It deliberately exposes no rainfall, raster-map, or live-monitoring
claim because those inputs are not present in this package.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
import os

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from scipy.stats import kendalltau, theilslopes

# Project root (the folder that contains data/, models/ and frontend/).
ROOT = Path(__file__).resolve().parent.parent

DATA_DIR = ROOT / "data"
MODEL_DIR = ROOT / "models"
AREA_FILE = DATA_DIR / "lake_chad_open_water_monthly.csv"
POOLS_FILE = DATA_DIR / "lake_chad_north_south_open_water_monthly.csv"
RESULTS_FILE = MODEL_DIR / "training_results.json"
MODEL_FILE = MODEL_DIR / "lake_chad_water_area_model.joblib"
PROJECTION_FILE = MODEL_DIR / "six_month_forward_projection.csv"
HOLDOUT_FILE = MODEL_DIR / "chronological_holdout_predictions.csv"

app = FastAPI(
    title="NUN Lake Chad Water Monitoring API",
    version="1.0.0",
    description="Historical open-water monitoring and validated one-month-ahead forecasting.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000", "http://127.0.0.1:8000",
        "http://localhost:5173", "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


def records(frame: pd.DataFrame) -> list[dict]:
    clean = frame.copy()
    for column in clean.columns:
        if pd.api.types.is_datetime64_any_dtype(clean[column]):
            clean[column] = clean[column].dt.strftime("%Y-%m-%d")
        elif pd.api.types.is_float_dtype(clean[column]):
            clean[column] = clean[column].round(3)
    return json.loads(clean.to_json(orient="records"))


@lru_cache(maxsize=1)
def area() -> pd.DataFrame:
    frame = pd.read_csv(AREA_FILE, parse_dates=["date"]).sort_values("date").reset_index(drop=True)
    if frame.empty or frame.isna().any().any():
        raise RuntimeError("The packaged area series is empty or incomplete")
    return frame


@lru_cache(maxsize=1)
def pools() -> pd.DataFrame:
    frame = pd.read_csv(POOLS_FILE, parse_dates=["date"]).sort_values("date").reset_index(drop=True)
    expected = frame["south_open_water_km2"] + frame["north_open_water_km2"]
    if not np.allclose(expected, frame["lake_open_water_km2"], atol=1e-6):
        raise RuntimeError("Pool total does not reconcile to lake total")
    return frame


@lru_cache(maxsize=1)
def results() -> dict:
    return json.loads(RESULTS_FILE.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def forecast_projection() -> pd.DataFrame:
    return pd.read_csv(PROJECTION_FILE, parse_dates=["date"])


@lru_cache(maxsize=1)
def model_bundle() -> dict:
    return joblib.load(MODEL_FILE)


def model_loaded() -> bool:
    """Never let a model-loading problem take the whole health endpoint down."""
    try:
        return bool(model_bundle().get("estimator"))
    except Exception:  # noqa: BLE001
        return False


def date_filtered(frame: pd.DataFrame, start: str | None, end: str | None) -> pd.DataFrame:
    try:
        start_date = pd.Timestamp(start) if start else None
        end_date = pd.Timestamp(end) if end else None
    except (TypeError, ValueError) as error:
        raise HTTPException(status_code=422, detail="Use ISO dates: YYYY-MM-DD") from error
    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=422, detail="start must be on or before end")
    if start_date:
        frame = frame.loc[frame.date >= start_date]
    if end_date:
        frame = frame.loc[frame.date <= end_date]
    return frame


def seasonal_trend(frame: pd.DataFrame, value_column: str) -> dict:
    copy = frame[["date", value_column]].copy()
    copy["anomaly"] = copy[value_column] - copy.groupby(copy.date.dt.month)[value_column].transform("mean")
    years = (copy.date - copy.date.min()).dt.days.to_numpy() / 365.25
    tau = kendalltau(years, copy.anomaly.to_numpy())
    slope = theilslopes(copy.anomaly.to_numpy(), years)
    return {
        "method": "Mann-Kendall tau on monthly seasonal anomalies; Sen slope",
        "tau": round(float(tau.statistic), 5),
        "p_value": round(float(tau.pvalue), 6),
        "sen_slope_km2_per_year": round(float(slope.slope), 3),
        "slope_95pct_low": round(float(slope.low_slope), 3),
        "slope_95pct_high": round(float(slope.high_slope), 3),
    }


@app.get("/api/health")
def health() -> dict:
    data, pool_data = area(), pools()
    return {
        "status": "ok",
        "product": "NUN Lake Chad Open-Water Monitoring",
        "area_observations": len(data),
        "pool_observations": len(pool_data),
        "model_loaded": model_loaded(),
        "latest_observation": data.date.max().strftime("%Y-%m-%d"),
        "live_monitoring": False,
    }


@app.get("/api/overview")
def overview() -> dict:
    data, pool_data, report = area(), pools(), results()
    latest = data.iloc[-1]
    previous = data.iloc[-2]
    same_month_last_year = data.iloc[-13]
    latest_pools = pool_data.iloc[-1]
    return {
        "observation_status": "archived_historical_observation",
        "latest_observation": {"date": latest.date.strftime("%Y-%m-%d"), "open_water_area_km2": round(float(latest.open_water_area_km2), 3)},
        "month_over_month": {"change_km2": round(float(latest.open_water_area_km2 - previous.open_water_area_km2), 3), "change_pct": round(float((latest.open_water_area_km2 / previous.open_water_area_km2 - 1) * 100), 3)},
        "year_over_year": {"change_km2": round(float(latest.open_water_area_km2 - same_month_last_year.open_water_area_km2), 3), "change_pct": round(float((latest.open_water_area_km2 / same_month_last_year.open_water_area_km2 - 1) * 100), 3)},
        "latest_pools_km2": {"south": round(float(latest_pools.south_open_water_km2), 3), "north": round(float(latest_pools.north_open_water_km2), 3), "south_share_pct": round(float(latest_pools.south_open_water_km2 / latest_pools.lake_open_water_km2 * 100), 3), "north_share_pct": round(float(latest_pools.north_open_water_km2 / latest_pools.lake_open_water_km2 * 100), 3)},
        "coverage": report["coverage"],
        "selected_model": report["selected_model"],
        "selected_metrics": report["selected_metrics"],
    }


@app.get("/api/series")
def series(start: str | None = None, end: str | None = None) -> dict:
    frame = date_filtered(area(), start, end)
    return {"variable": "open_surface_water_area_km2", "observation_type": "archived", "records": records(frame)}


@app.get("/api/pools")
def pool_series(start: str | None = None, end: str | None = None) -> dict:
    frame = date_filtered(pools(), start, end)
    return {"units": "km2", "reconciliation": "south + north = lake total", "records": records(frame)}


@app.get("/api/seasonality")
def seasonality() -> dict:
    frame = area().copy()
    frame["month"] = frame.date.dt.month
    grouped = frame.groupby("month").open_water_area_km2.agg(["count", "mean", "median", "min", "max", "std"]).reset_index()
    grouped.insert(1, "month_name", [pd.Timestamp(2000, month, 1).strftime("%B") for month in grouped.month])
    return {"units": "km2", "records": records(grouped)}


@app.get("/api/anomalies")
def anomalies(start: str | None = None, end: str | None = None) -> dict:
    frame = area().copy()
    climatology = frame.groupby(frame.date.dt.month).open_water_area_km2.transform("mean")
    frame["seasonal_expected_km2"] = climatology
    frame["anomaly_km2"] = frame.open_water_area_km2 - climatology
    frame["anomaly_pct"] = frame.anomaly_km2 / climatology * 100
    return {"reference": "2001-01 to 2020-05 monthly climatology", "records": records(date_filtered(frame, start, end))}


@app.get("/api/trends")
def trends() -> dict:
    report = results()
    pool_data = pools()
    return {
        "lake": report["trend"],
        "south_pool": seasonal_trend(pool_data, "south_open_water_km2"),
        "north_pool": seasonal_trend(pool_data, "north_open_water_km2"),
        "interpretation_rule": "p < 0.05 indicates statistical evidence of a monotonic trend in seasonally adjusted monthly anomalies.",
    }


@app.get("/api/forecast")
def forecast() -> dict:
    report = results()
    projection = forecast_projection()
    return {
        "target": "open_surface_water_area_km2",
        "model": report["selected_model"],
        "validated_horizon_months": 1,
        "validation": report["selected_metrics"],
        "first_step_forecast": records(projection.head(1))[0],
        "forward_projection": records(projection),
        "forward_projection_notice": "Only the one-month-ahead task was evaluated on held-out data. Later steps are recursive projections and must not be presented with the one-month validation score.",
    }


@app.get("/api/evidence")
def evidence() -> dict:
    report = results()
    return {
        "source": report["source"],
        "coverage": report["coverage"],
        "training_protocol": report["protocol"],
        "model_comparison": report["models"],
        "selected_model": report["selected_model"],
        "data_capabilities": ["historical monthly open-water monitoring", "north-versus-south comparison", "seasonality and anomalies", "trend evidence", "one-month-ahead forecast"],
        "out_of_scope_without_new_data": ["pixel-level water gain/loss maps", "NDWI or MNDWI imagery", "rainfall attribution", "current live monitoring", "per-scene cloud or quality flags"],
    }


@app.get("/api/discoveries")
def discoveries() -> dict:
    report = results()
    pool_data = pools()
    latest = pool_data.iloc[-1]
    return {
        "cards": [
            {"id": "lake-trend", "region": "Lake Chad", "variable": "Open surface-water area", "evidence": report["trend"], "reliability": "high for the archived monthly record"},
            {"id": "south-trend", "region": "Southern Pool", "variable": "Open surface-water area", "evidence": seasonal_trend(pool_data, "south_open_water_km2"), "reliability": "high for the archived monthly record"},
            {"id": "north-trend", "region": "Northern Pool", "variable": "Open surface-water area", "evidence": seasonal_trend(pool_data, "north_open_water_km2"), "reliability": "high for the archived monthly record"},
            {"id": "latest-pools", "region": "Lake Chad", "variable": "Pool distribution", "evidence": {"date": latest.date.strftime("%Y-%m-%d"), "south_open_water_km2": round(float(latest.south_open_water_km2), 3), "north_open_water_km2": round(float(latest.north_open_water_km2), 3)}, "reliability": "archived observation"},
        ]
    }


@app.get("/api/download/open-water.csv", response_class=FileResponse)
def download_open_water() -> FileResponse:
    return FileResponse(AREA_FILE, media_type="text/csv", filename="lake_chad_open_water_monthly.csv")


@app.get("/api/download/pools.csv", response_class=FileResponse)
def download_pools() -> FileResponse:
    return FileResponse(POOLS_FILE, media_type="text/csv", filename="lake_chad_north_south_open_water_monthly.csv")


@app.get("/api/download/evaluation.csv", response_class=FileResponse)
def download_evaluation() -> FileResponse:
    return FileResponse(HOLDOUT_FILE, media_type="text/csv", filename="chronological_holdout_predictions.csv")


@app.get("/api/download/training-results.json", response_class=FileResponse)
def download_training_results() -> FileResponse:
    return FileResponse(RESULTS_FILE, media_type="application/json", filename="training_results.json")


# The integrated release places the Vite production build in frontend/dist.
# Mount it last so all /api routes above remain authoritative.
FRONTEND_DIST = ROOT / "frontend" / "dist"
if FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
