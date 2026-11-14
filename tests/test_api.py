import pytest
from fastapi import HTTPException

from src import api


def test_health_and_overview_are_honest_about_historical_scope():
    health = api.health()
    overview = api.overview()
    assert health["area_observations"] == 233
    assert health["live_monitoring"] is False
    assert overview["latest_observation"]["date"] == "2020-05-01"


def test_supported_series_pool_and_seasonality_data_are_complete():
    series = api.series()["records"]
    pools = api.pool_series()["records"]
    seasonality = api.seasonality()["records"]
    assert len(series) == 233
    assert len(pools) == 233
    assert len(seasonality) == 12
    assert all(abs(row["south_open_water_km2"] + row["north_open_water_km2"] - row["lake_open_water_km2"]) < 1e-6 for row in pools)


def test_forecast_and_evidence_preserve_evaluation_limits():
    forecast = api.forecast()
    evidence = api.evidence()
    assert forecast["validated_horizon_months"] == 1
    assert len(forecast["forward_projection"]) == 6
    assert "rainfall attribution" in evidence["out_of_scope_without_new_data"]
    assert "pixel-level water gain/loss maps" in evidence["out_of_scope_without_new_data"]


def test_invalid_date_range_is_rejected():
    with pytest.raises(HTTPException) as error:
        api.series(start="2020-01-01", end="2019-01-01")
    assert error.value.status_code == 422
