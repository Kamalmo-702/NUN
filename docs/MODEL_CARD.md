# NUN Lake Chad water-area forecast model

## Purpose

One-month-ahead forecasting of **open surface-water area (km²)** for Lake Chad.
It is a monitoring and forecasting aid, not a measurement of total inundation,
storage, depth, rainfall, or a causal climate model.

## Data and target

The target is `MODo`, the authors' monthly open-water area series. The source
workbook was published by Li et al. (2021) under CC BY 4.0. It contains a
continuous monthly MODo record from 2001-01 through 2020-05. Source workbook
MD5: `aeac6fd6db3ace5368c49124aad77334`.

## Training protocol

Rows before 2018-01 were used for fitting. 2018-01 through 2020-05 were held
out chronologically and never used for model selection. Inputs are lagged water
area (1, 2, 3, 6, and 12 months), seasonal sine/cosine terms, and elapsed time.
This makes the forecast conditional on the latest observed water-area record.

## Result

Selected operational estimator: `random_forest`.
Held-out test metrics: MAE 233.317 km²; RMSE
304.989 km²; R² 0.8823.
The seasonal-naive benchmark MAE is 267.317 km².

## Limits

The latest source observation is 2020-05. The forecast in `artifacts/six_month_forward_projection.csv` is
therefore a historical forward projection from that point, not present-day
monitoring. Replace the input series with a newly processed, quality-controlled
observation series before operational deployment. Errors can increase during
unusual floods, droughts, cloud-contaminated inputs, or regime shifts.
