# NUN — Lake Chad Water Monitoring

This repository is intentionally scoped to Lake Chad **open surface-water area**.
It contains no vegetation product or vegetation model.

## Run the integrated application

```bash
pip install -r requirements.txt
uvicorn src.api:app --port 8001
```

Open `http://127.0.0.1:8001` for the integrated NUN interface. The FastAPI app
serves the verified React production build from `frontend/dist` and its API from
the same origin. Open `http://127.0.0.1:8001/docs` for the interactive API documentation.
The main endpoints are `/api/overview`, `/api/series`, `/api/pools`,
`/api/seasonality`, `/api/anomalies`, `/api/trends`, `/api/forecast`, and
`/api/evidence`.

## Frontend development

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm dev
```

The frontend development server uses `frontend/.env.development` to connect to
the API on port 8001. For a production rebuild, omit that environment variable
so the generated application calls same-origin `/api` routes, then run
`pnpm build` from `frontend`.

The application is historical: its latest source observation is 2020-05. See
`docs/MODEL_CARD.md` for source, validation, and deployment limits.

If the model artefacts are regenerated, rebuild the static dashboard payload:

```bash
python src/build_dashboard_payload.py
```

## Verify the backend

```bash
python -m pytest tests -q
```

The audited feature-to-data mapping is in `docs/BACKEND_FEATURE_AUDIT.md`.
