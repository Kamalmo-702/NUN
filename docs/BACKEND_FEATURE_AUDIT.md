# Backend feature-to-data audit

This backend uses only files included in this repository. No external service,
imagery, rainfall feed, or fabricated record is required at runtime.

| Feature | Endpoint | Packaged data | Scope guard |
|---|---|---|---|
| Latest archived observation and change | `/api/overview` | `data/lake_chad_open_water_monthly.csv` | Labels the observation as archived, not live. |
| Historical water-area series | `/api/series` | 233 monthly MODo observations | Date filtering rejects inverted ranges. |
| North–south comparison | `/api/pools` | 233 reconciled pool observations | Backend verifies north + south = lake total. |
| Seasonal profile and anomaly | `/api/seasonality`, `/api/anomalies` | Monthly area series | Climatology is explicitly limited to 2001-01–2020-05. |
| Statistical trend evidence | `/api/trends`, `/api/discoveries` | Monthly area and pool series | Mann–Kendall/Sen calculations remove monthly seasonality first. |
| Forecast and model quality | `/api/forecast` | Saved Random Forest, holdout results, six-step projection | Only one-month-ahead performance is labelled validated. |
| Evidence and downloads | `/api/evidence`, `/api/download/*` | Results JSON and source CSVs | States all missing capabilities explicitly. |

## Explicit exclusions

The repository deliberately does **not** expose pixel-level change maps, NDWI,
MNDWI, rainfall attribution, cloud QA, or live alerts. Those features require
inputs that are absent from this package and must not be simulated.
