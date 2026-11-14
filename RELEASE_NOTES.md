# NUN Lake Chad — Final Release

## Included scope

- Historical monthly open surface-water monitoring: 2001-01 to 2020-05.
- Northern Pool, Southern Pool, and reconciled Lake Total comparison.
- Monthly seasonal climatology and relative water-extent anomaly.
- Seasonally adjusted Mann–Kendall/Sen trend evidence.
- A saved Random Forest and chronological holdout evaluation.
- Validated one-month-ahead forecast plus clearly labelled six-month recursive projection.
- FastAPI backend, download endpoints, dashboard, automated tests, and model documentation.

## Release verification

- 233 complete monthly Lake Chad observations.
- 233 complete north/south pool observations; every record reconciles to the lake total.
- 29 held-out months for model evaluation.
- Six forward-projection records beginning immediately after the final observation.
- Automated test suite: 6 passed.
- Dashboard JavaScript syntax and data contract checked before packaging.

## Scope boundaries

The project does not claim pixel-level water maps, NDWI/MNDWI imagery, rainfall
attribution, cloud QA, or live monitoring. Those capabilities require inputs
that are not part of this release.
