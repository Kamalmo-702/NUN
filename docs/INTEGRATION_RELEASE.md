# Integrated frontend and backend release

This release combines the supplied NUN React interface with the verified Lake
Chad backend in one deployable application.

## Integration contract

| User-facing section | API endpoint |
|---|---|
| Overview | `/api/overview`, `/api/series`, `/api/trends` |
| Water History | `/api/series`, `/api/trends` |
| Pool Intelligence | `/api/pools`, `/api/trends` |
| Seasonal Anomaly | `/api/seasonality`, `/api/anomalies` |
| Forecast | `/api/forecast`, `/api/series` |
| Evidence & Trust | `/api/evidence` |
| Discoveries | `/api/discoveries` |
| Downloads | `/api/download/*` |

## Production behavior

`src/api.py` serves `frontend/dist` from `/` after it declares all API routes.
The React build therefore requests same-origin `/api/*` paths in production;
there is no hard-coded localhost URL or runtime requirement for a separate
frontend host.

## Data safeguards

- All displayed measurements are read from backend responses or packaged model
  artefacts; the interface does not create data values.
- The UI labels the record as archived, not live.
- Forecast language distinguishes the validated first month from the five
  recursive forward projections.
- The seasonal signal is labelled as an open-water anomaly, not a drought
  diagnosis.
