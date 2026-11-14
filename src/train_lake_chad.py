"""Build a reproducible Lake Chad water-area training package from the authors' dataset.

The target is the study's MODo monthly open-surface-water area (km²), not a
synthetic reconstruction and not total inundation under aquatic vegetation.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from scipy.stats import kendalltau, theilslopes
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


SOURCE_MD5 = "aeac6fd6db3ace5368c49124aad77334"
FEATURES = ["lag_1", "lag_2", "lag_3", "lag_6", "lag_12", "month_sin", "month_cos", "trend_years"]
SPLIT_DATE = pd.Timestamp("2018-01-01")


def md5(path: Path) -> str:
    digest = hashlib.md5()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def metrics(observed: pd.Series, predicted: np.ndarray) -> dict[str, float]:
    return {
        "mae_km2": round(float(mean_absolute_error(observed, predicted)), 3),
        "rmse_km2": round(float(np.sqrt(mean_squared_error(observed, predicted))), 3),
        "r2": round(float(r2_score(observed, predicted)), 4),
        "mean_absolute_percentage_error_pct": round(
            float(np.mean(np.abs((observed.to_numpy() - predicted) / observed.to_numpy())) * 100), 3
        ),
    }


def make_features(series: pd.DataFrame) -> pd.DataFrame:
    result = series.copy()
    for lag in (1, 2, 3, 6, 12):
        result[f"lag_{lag}"] = result["open_water_area_km2"].shift(lag)
    month = result["date"].dt.month
    result["month_sin"] = np.sin(2 * np.pi * month / 12)
    result["month_cos"] = np.cos(2 * np.pi * month / 12)
    result["trend_years"] = (result["date"] - result["date"].min()).dt.days / 365.25
    return result.dropna(subset=FEATURES + ["open_water_area_km2"]).reset_index(drop=True)


def forecast(model, history: pd.DataFrame, start_date: pd.Timestamp, months: int) -> pd.DataFrame:
    values = dict(zip(history["date"].dt.to_period("M").astype(str), history["open_water_area_km2"]))
    first_date = history["date"].min()
    rows: list[dict[str, object]] = []
    for date in pd.date_range(start_date, periods=months, freq="MS"):
        key = str(date.to_period("M"))
        def lag(n: int) -> float:
            return float(values[str((date - pd.DateOffset(months=n)).to_period("M"))])
        feature = pd.DataFrame([{
            "lag_1": lag(1), "lag_2": lag(2), "lag_3": lag(3), "lag_6": lag(6), "lag_12": lag(12),
            "month_sin": np.sin(2 * np.pi * date.month / 12),
            "month_cos": np.cos(2 * np.pi * date.month / 12),
            "trend_years": (date - first_date).days / 365.25,
        }])
        value = max(0.0, float(model.predict(feature[FEATURES])[0]))
        values[key] = value
        rows.append({"date": date.strftime("%Y-%m-%d"), "forecast_open_water_area_km2": round(value, 3)})
    return pd.DataFrame(rows)


def render_model_card(result: dict, forecast_file: str) -> str:
    return f"""# NUN Lake Chad water-area forecast model

## Purpose

One-month-ahead forecasting of **open surface-water area (km²)** for Lake Chad.
It is a monitoring and forecasting aid, not a measurement of total inundation,
storage, depth, rainfall, or a causal climate model.

## Data and target

The target is `MODo`, the authors' monthly open-water area series. The source
workbook was published by Li et al. (2021) under CC BY 4.0. It contains a
continuous monthly MODo record from 2001-01 through 2020-05. Source workbook
MD5: `{SOURCE_MD5}`.

## Training protocol

Rows before 2018-01 were used for fitting. 2018-01 through 2020-05 were held
out chronologically and never used for model selection. Inputs are lagged water
area (1, 2, 3, 6, and 12 months), seasonal sine/cosine terms, and elapsed time.
This makes the forecast conditional on the latest observed water-area record.

## Result

Selected operational estimator: `{result['selected_model']}`.
Held-out test metrics: MAE {result['selected_metrics']['mae_km2']} km²; RMSE
{result['selected_metrics']['rmse_km2']} km²; R² {result['selected_metrics']['r2']}.
The seasonal-naive benchmark MAE is {result['benchmark_metrics']['mae_km2']} km².

## Limits

The latest source observation is 2020-05. The forecast in `{forecast_file}` is
therefore a historical forward projection from that point, not present-day
monitoring. Replace the input series with a newly processed, quality-controlled
observation series before operational deployment. Errors can increase during
unusual floods, droughts, cloud-contaminated inputs, or regime shifts.
"""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=Path("work/DatasetOfLakeChad.xlsx"))
    parser.add_argument("--out", type=Path, default=Path("outputs/NUN_LakeChad_Professional_Training"))
    args = parser.parse_args()
    source, out = args.source.resolve(), args.out.resolve()
    if not source.exists():
        raise FileNotFoundError(source)
    if md5(source).lower() != SOURCE_MD5:
        raise ValueError("Source workbook checksum does not match the published file")
    out.mkdir(parents=True, exist_ok=True)
    (out / "data").mkdir(exist_ok=True)
    (out / "artifacts").mkdir(exist_ok=True)
    shutil.copy2(Path(__file__), out / "train_lake_chad.py")
    (out / "requirements.txt").write_text("pandas\nopenpyxl\nnumpy\nscipy\nscikit-learn\njoblib\n", encoding="utf-8")
    shutil.copy2(source, out / "data" / source.name)

    monthly = pd.read_excel(source, sheet_name="Monthly dataset")
    monthly["date"] = pd.to_datetime(monthly["date"])
    area = monthly.loc[monthly["MODo"].notna(), ["date", "MODo"]].rename(columns={"MODo": "open_water_area_km2"})
    area = area.sort_values("date").reset_index(drop=True)
    expected = pd.date_range(area.date.min(), area.date.max(), freq="MS")
    if not area.date.equals(pd.Series(expected)):
        raise ValueError("MODo is not a continuous monthly series; do not silently impute it")
    area.to_csv(out / "data" / "lake_chad_open_water_monthly.csv", index=False)

    pools = pd.read_excel(source, sheet_name="South_North")
    pools["date"] = pd.to_datetime(pools["date"])
    pools = pools.loc[:, ["date", "MODo_south", "MODo_north", "MODo"]].rename(columns={
        "MODo_south": "south_open_water_km2", "MODo_north": "north_open_water_km2", "MODo": "lake_open_water_km2"
    })
    pools.to_csv(out / "data" / "lake_chad_north_south_open_water_monthly.csv", index=False)

    data = make_features(area)
    train, test = data.loc[data.date < SPLIT_DATE].copy(), data.loc[data.date >= SPLIT_DATE].copy()
    if len(test) < 24 or len(train) < 120:
        raise ValueError("Chronological split unexpectedly too small")
    x_train, y_train = train[FEATURES], train["open_water_area_km2"]
    x_test, y_test = test[FEATURES], test["open_water_area_km2"]
    candidates = {
        "ridge": Pipeline([("scale", StandardScaler()), ("model", Ridge(alpha=10.0))]),
        "random_forest": RandomForestRegressor(n_estimators=600, min_samples_leaf=2, max_features=0.85, random_state=42, n_jobs=-1),
    }
    predictions: dict[str, np.ndarray] = {"seasonal_naive": x_test["lag_12"].to_numpy()}
    fitted = {}
    for name, estimator in candidates.items():
        fitted[name] = estimator.fit(x_train, y_train)
        predictions[name] = fitted[name].predict(x_test)
    scores = {name: metrics(y_test, prediction) for name, prediction in predictions.items()}
    selected_name = min(candidates, key=lambda name: scores[name]["mae_km2"])
    selected = candidates[selected_name].fit(data[FEATURES], data["open_water_area_km2"])
    joblib.dump({"estimator": selected, "features": FEATURES, "target": "open_water_area_km2", "training_end": str(area.date.max().date())}, out / "artifacts" / "lake_chad_water_area_model.joblib")
    backtest = test[["date", "open_water_area_km2"]].copy()
    backtest["seasonal_naive_km2"] = predictions["seasonal_naive"]
    for name in candidates:
        backtest[f"{name}_km2"] = predictions[name]
    backtest.to_csv(out / "artifacts" / "chronological_holdout_predictions.csv", index=False)
    future = forecast(selected, area, area.date.max() + pd.offsets.MonthBegin(1), 6)
    future.to_csv(out / "artifacts" / "six_month_forward_projection.csv", index=False)

    anomalies = area.assign(anomaly=lambda f: f.open_water_area_km2 - f.groupby(f.date.dt.month).open_water_area_km2.transform("mean"))
    x = (anomalies.date - anomalies.date.min()).dt.days.to_numpy() / 365.25
    sen = theilslopes(anomalies.anomaly.to_numpy(), x)
    tau = kendalltau(x, anomalies.anomaly.to_numpy())
    trend = {"method": "Mann-Kendall tau on monthly seasonal anomalies; Sen slope", "tau": round(float(tau.statistic), 5), "p_value": round(float(tau.pvalue), 6), "sen_slope_km2_per_year": round(float(sen.slope), 3), "slope_95pct_low": round(float(sen.low_slope), 3), "slope_95pct_high": round(float(sen.high_slope), 3)}
    result = {
        "product": "NUN Lake Chad Open-Water Forecast",
        "source": {"citation": "Li, H. (2021), figshare, DOI 10.6084/m9.figshare.12678995.v3", "license": "CC BY 4.0", "workbook_md5": SOURCE_MD5, "variable": "MODo monthly open surface water area"},
        "coverage": {"start": str(area.date.min().date()), "end": str(area.date.max().date()), "observations": int(len(area)), "units": "km2"},
        "protocol": {"training_end_exclusive": str(SPLIT_DATE.date()), "test_start": str(SPLIT_DATE.date()), "test_end": str(test.date.max().date()), "test_observations": int(len(test)), "forecast_type": "one-month-ahead conditional on prior observed area"},
        "models": scores,
        "selected_model": selected_name,
        "selected_metrics": scores[selected_name],
        "benchmark_metrics": scores["seasonal_naive"],
        "trend": trend,
    }
    (out / "artifacts" / "training_results.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    (out / "MODEL_CARD.md").write_text(render_model_card(result, "artifacts/six_month_forward_projection.csv"), encoding="utf-8")
    dashboard = {
        "metadata": result["source"] | result["coverage"],
        "series": [dict(date=row.date.strftime("%Y-%m-%d"), open_water_area_km2=round(float(row.open_water_area_km2), 3)) for row in area.itertuples()],
        "pools": [dict(date=row.date.strftime("%Y-%m-%d"), south_open_water_km2=round(float(row.south_open_water_km2), 3), north_open_water_km2=round(float(row.north_open_water_km2), 3), lake_open_water_km2=round(float(row.lake_open_water_km2), 3)) for row in pools.itertuples()],
        "projection": future.to_dict(orient="records"),
        "model": result,
    }
    (out / "dashboard_data.json").write_text(json.dumps(dashboard, indent=2), encoding="utf-8")
    (out / "README.md").write_text("# NUN professional Lake Chad training package\n\nRun `python train_lake_chad.py` from the repository root to recreate the package. Read `MODEL_CARD.md` before using the projection.\n", encoding="utf-8")
    repo = out / "NUN-water-monitoring"
    (repo / "dashboard").mkdir(parents=True, exist_ok=True)
    (repo / "data").mkdir(exist_ok=True)
    (repo / "models").mkdir(exist_ok=True)
    (repo / "src").mkdir(exist_ok=True)
    (repo / "docs").mkdir(exist_ok=True)
    shutil.copy2(out / "index.html", repo / "dashboard" / "index.html")
    shutil.copy2(out / "dashboard_data.json", repo / "dashboard" / "dashboard_data.json")
    shutil.copy2(out / "data" / "lake_chad_open_water_monthly.csv", repo / "data" / "lake_chad_open_water_monthly.csv")
    shutil.copy2(out / "data" / "lake_chad_north_south_open_water_monthly.csv", repo / "data" / "lake_chad_north_south_open_water_monthly.csv")
    shutil.copy2(out / "data" / source.name, repo / "data" / source.name)
    shutil.copy2(out / "artifacts" / "lake_chad_water_area_model.joblib", repo / "models" / "lake_chad_water_area_model.joblib")
    shutil.copy2(out / "artifacts" / "training_results.json", repo / "models" / "training_results.json")
    shutil.copy2(out / "artifacts" / "chronological_holdout_predictions.csv", repo / "models" / "chronological_holdout_predictions.csv")
    shutil.copy2(out / "artifacts" / "six_month_forward_projection.csv", repo / "models" / "six_month_forward_projection.csv")
    shutil.copy2(out / "train_lake_chad.py", repo / "src" / "train_lake_chad.py")
    shutil.copy2(out / "MODEL_CARD.md", repo / "docs" / "MODEL_CARD.md")
    shutil.copy2(out / "requirements.txt", repo / "requirements.txt")
    (repo / ".gitignore").write_text("__pycache__/\n*.py[cod]\n.venv/\n.DS_Store\n", encoding="utf-8")
    (repo / "README.md").write_text("""# NUN — Lake Chad Water Monitoring

This repository is intentionally scoped to Lake Chad **open surface-water area**.
It contains no vegetation product or vegetation model.

## Run

```bash
pip install -r requirements.txt
python src/train_lake_chad.py --source data/DatasetOfLakeChad.xlsx
cd dashboard && python -m http.server 8000
```

Open `http://localhost:8000`. The dashboard is historical: its latest source
observation is 2020-05. See `docs/MODEL_CARD.md` for source, validation, and
deployment limits.
""", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
