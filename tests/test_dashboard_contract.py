import json
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]


def test_dashboard_contains_only_supported_feature_sections():
    html = (ROOT / "dashboard" / "index.html").read_text(encoding="utf-8")
    assert 'id="poolChart"' in html
    assert 'id="seasonChart"' in html
    assert 'id="poolCards"' in html
    assert 'id="anomalyCards"' in html
    assert "Not a meteorological drought alert" in html
    assert "pixel-level" not in html.lower()


def test_dashboard_data_can_feed_pool_and_seasonal_views_without_new_inputs():
    data = json.loads((ROOT / "dashboard" / "dashboard_data.json").read_text(encoding="utf-8"))
    assert len(data["series"]) == 233
    assert len(data["pools"]) == 233
    assert len(data["projection"]) == 6
    pool_total = np.array([r["south_open_water_km2"] + r["north_open_water_km2"] for r in data["pools"]])
    lake_total = np.array([r["lake_open_water_km2"] for r in data["pools"]])
    assert np.allclose(pool_total, lake_total)
    for month in range(1, 13):
        values = [r["open_water_area_km2"] for r in data["series"] if int(r["date"][5:7]) == month]
        assert values
        assert np.isfinite(np.mean(values))
