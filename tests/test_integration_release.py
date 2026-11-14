from src.api import AREA_FILE, FRONTEND_DIST, HOLDOUT_FILE, POOLS_FILE, RESULTS_FILE, app


def test_integrated_frontend_and_api_routes_are_served():
    assert FRONTEND_DIST.is_dir()
    assert "<div id=\"root\"></div>" in (FRONTEND_DIST / "index.html").read_text(encoding="utf-8")
    assert all(path.is_file() for path in (AREA_FILE, POOLS_FILE, HOLDOUT_FILE, RESULTS_FILE))
    route_names = {getattr(route, "name", None) for route in app.routes}
    assert "frontend" in route_names
