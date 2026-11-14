import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas import (
    ConditionsResponse,
    HealthResponse,
    PoiCollection,
    RouteResponse,
)

client = TestClient(app)

VALID_ROUTE_BODY = {
    "start": [137.4417, -4.5895],
    "goal": [137.3800, -4.7200],
    "max_slope_deg": 20,
    "speed_flat_m_s": 1.0,
}


def test_route_ok():
    r = client.post("/api/route", json=VALID_ROUTE_BODY)
    assert r.status_code == 200
    assert RouteResponse.model_validate(r.json()).status == "ok"


def test_route_defaults_accepted():
    r = client.post("/api/route", json={"start": [137.44, -4.58], "goal": [137.38, -4.72]})
    assert r.status_code == 200


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"start": [137.44, -4.58]},
        {"start": [137.44], "goal": [137.38, -4.72]},
        {"start": "a", "goal": [137.38, -4.72]},
        {**VALID_ROUTE_BODY, "max_slope_deg": "steep"},
        {**VALID_ROUTE_BODY, "max_slope_deg": 0},
        {**VALID_ROUTE_BODY, "speed_flat_m_s": -1},
        {**VALID_ROUTE_BODY, "speed_flat_m_s": 1e-300},
        {**VALID_ROUTE_BODY, "max_slope_deg": 1e9},
        {**VALID_ROUTE_BODY, "start": [1e308, 1e308]},
        {**VALID_ROUTE_BODY, "goal": [137.38, -91]},
    ],
)
def test_route_invalid_request_is_422(body):
    assert client.post("/api/route", json=body).status_code == 422


@pytest.mark.parametrize(
    "raw",
    [
        '{"start": [NaN, -4.59], "goal": [137.38, -4.72]}',
        '{"start": [137.44, -4.59], "goal": [137.38, -4.72], "max_slope_deg": Infinity}',
    ],
)
def test_route_nan_and_infinity_are_422_not_500(raw):
    r = client.post("/api/route", content=raw, headers={"content-type": "application/json"})
    assert r.status_code == 422


def test_route_accepts_negative_east_longitude():
    body = {**VALID_ROUTE_BODY, "start": [137.4417 - 360.0, -4.5895]}
    assert client.post("/api/route", json=body).json()["status"] == "ok"


def test_conditions():
    for url in ("/api/conditions", "/api/conditions?sol=3000"):
        r = client.get(url)
        assert r.status_code == 200
        ConditionsResponse.model_validate(r.json())


def test_poi():
    r = client.get("/api/poi")
    assert r.status_code == 200
    assert len(PoiCollection.model_validate(r.json()).features) >= 1


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert HealthResponse.model_validate(r.json()).status == "ok"


def test_cors_allows_configured_origin():
    r = client.get("/api/health", headers={"Origin": "http://localhost:5173"})
    assert r.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_health_reports_terrain_kind_and_grid():
    from app.core.geo import bounds
    from app.deps import get_terrain

    terrain = get_terrain()
    data = client.get("/api/health").json()
    assert data["terrain"] == terrain.kind == "synthetic"
    assert data["cell_size_m"] == terrain.grid.cell_size_m
    assert data["bounds"] == [round(v, 4) for v in bounds(terrain.grid)]


def test_health_falls_back_to_synthetic_when_dem_file_is_missing(monkeypatch, tmp_path):
    monkeypatch.setenv("DEM_PATH", str(tmp_path / "missing.tif"))
    assert client.get("/api/health").json()["terrain"] == "synthetic"


def test_health_reports_real_terrain_when_dem_loads(monkeypatch, tmp_path):
    import numpy as np
    import rasterio

    from app.core import constants as c
    from app.core.geo import make_grid

    grid = make_grid(c.DEM_BOUNDS, 500.0)
    path = tmp_path / "dem.tif"
    profile = {"driver": "GTiff", "dtype": "float32", "count": 1, "nodata": float("nan")}
    with rasterio.open(path, "w", height=grid.n_rows, width=grid.n_cols, **profile) as dst:
        dst.write(np.full(grid.shape, -4490.0, dtype=np.float32), 1)
        dst.update_tags(
            **{
                c.DEM_TAG_LON0: grid.lon0,
                c.DEM_TAG_LAT_TOP: grid.lat_top,
                c.DEM_TAG_LAT_TS: grid.lat_ts,
                c.DEM_TAG_CELL_SIZE_M: grid.cell_size_m,
            }
        )
    monkeypatch.setenv("DEM_PATH", str(path))
    data = client.get("/api/health").json()
    assert data["terrain"] == "real"
    assert data["cell_size_m"] == 500.0


def _route(**overrides):
    body = {**VALID_ROUTE_BODY, **overrides}
    r = client.post("/api/route", json=body)
    assert r.status_code == 200
    return r.json()


def test_route_is_real_and_valid():
    data = _route()
    assert data["status"] == "ok"
    coords = data["path"]["coordinates"]
    assert len(coords) > 2
    assert len(data["profile"]) <= 300
    assert data["profile"][0]["dist_m"] == 0
    assert data["distance_m"] > 0 and data["duration_min"] > 0
    # Path starts and ends within one cell of the requested points.
    assert coords[0][:2] == pytest.approx(VALID_ROUTE_BODY["start"], abs=1e-3)
    assert coords[-1][:2] == pytest.approx(VALID_ROUTE_BODY["goal"], abs=1e-3)


@pytest.mark.parametrize("max_slope", [5, 10, 20])
def test_route_never_exceeds_max_slope(max_slope):
    data = _route(max_slope_deg=max_slope)
    if data["status"] == "ok":
        assert data["max_slope_deg"] <= max_slope
        assert all(p["slope_deg"] <= max_slope for p in data["profile"])


def test_route_out_of_bounds_is_200():
    data = _route(goal=[10.0, 10.0])
    assert data["status"] == "out_of_bounds"
    assert "outside" in data["reason"]
    assert data["path"] is None


def test_route_no_route_when_slope_limit_tiny():
    data = _route(max_slope_deg=0.01)
    assert data["status"] == "no_route"
    assert data["reason"]


def test_conditions_default_is_latest_sol():
    data = client.get("/api/conditions").json()
    assert data["sol"] == 4995
    ConditionsResponse.model_validate(data)


def test_conditions_exact_sol():
    data = client.get("/api/conditions", params={"sol": 10}).json()
    assert data["sol"] == 10
    assert data["temp_min_c"] == -75.0


def test_conditions_missing_sol_returns_nearest():
    # Sols 2..8 have no data; 1 is the closest to 3, 9 is the closest to 7.
    assert client.get("/api/conditions", params={"sol": 3}).json()["sol"] == 1
    assert client.get("/api/conditions", params={"sol": 7}).json()["sol"] == 9


@pytest.mark.parametrize("sol", [-5, 0, 10**9])
def test_conditions_sol_out_of_range_does_not_fail(sol):
    r = client.get("/api/conditions", params={"sol": sol})
    assert r.status_code == 200
    ConditionsResponse.model_validate(r.json())


def test_conditions_non_integer_sol_is_422():
    assert client.get("/api/conditions", params={"sol": "abc"}).status_code == 422


def test_poi_points_are_inside_working_area():
    from app.core.geo import to_cell
    from app.core.terrain import build_synthetic_terrain

    grid = build_synthetic_terrain().grid
    features = client.get("/api/poi").json()["features"]
    assert len(features) >= 5
    for f in features:
        assert to_cell(grid, *f["geometry"]["coordinates"]) is not None, f["properties"]["id"]


def test_root_redirects_to_docs():
    r = client.get("/", follow_redirects=False)
    assert r.status_code in (302, 307)
    assert r.headers["location"] == "/docs"


def test_route_line_starts_and_ends_at_the_requested_points():
    start, goal = [137.35, -4.62], [137.40, -4.70]
    data = _route(start=start, goal=goal)
    assert data["status"] == "ok"
    coords = data["path"]["coordinates"]
    assert coords[0][:2] == pytest.approx(start)
    assert coords[-1][:2] == pytest.approx(goal)


def test_route_has_round_trip_and_verdict():
    data = _route()
    assert data["verdict"] in ("go", "caution", "no_go")
    assert data["round_trip_o2_used_pct"] == pytest.approx(
        data["o2_used_pct"] + data["return_o2_used_pct"], abs=0.11
    )
    assert data["o2_reserve_pct"] == pytest.approx(100 - data["round_trip_o2_used_pct"], abs=0.11)
    assert data["verdict_reasons"]


def test_route_red_sol_is_no_go():
    red_sol = next(r["sol"] for r in _all_conditions() if r["risk_level"] == "red")
    data = _route(sol=red_sol)
    assert data["verdict"] == "no_go"
    assert any(f"sol {red_sol}" in r for r in data["verdict_reasons"])


def test_route_without_sol_ignores_weather():
    data = _route()
    assert not any("sol" in r for r in data["verdict_reasons"])


def _all_conditions():
    import json
    from pathlib import Path

    path = Path(__file__).resolve().parent.parent / "app" / "data" / "conditions.json"
    return json.loads(path.read_text(encoding="utf-8"))


def test_no_sol_without_weather_data_is_green_or_go():
    """Missing data is never shown as safe: every sol without REMS inputs is unknown, never GO."""
    rows = _all_conditions()
    no_data = [r["sol"] for r in rows if r["temp_min_c"] is None or r["uv_index"] is None]
    assert no_data, "test data should contain sols without measurements"
    for sol in no_data:
        cond = client.get("/api/conditions", params={"sol": sol}).json()
        assert cond["sol"] == sol
        assert cond["risk_level"] != "green", sol
    for sol in no_data[:5]:
        data = _route(sol=sol)
        assert data["verdict"] != "go", sol
        if client.get("/api/conditions", params={"sol": sol}).json()["risk_level"] == "unknown":
            assert f"No weather data for sol {sol}" in data["verdict_reasons"]
