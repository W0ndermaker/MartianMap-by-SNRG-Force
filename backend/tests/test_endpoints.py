
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
    ],
)
def test_route_invalid_request_is_422(body):
    assert client.post("/api/route", json=body).status_code == 422


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


def test_health_terrain_ignores_dem_path_until_loader_exists(monkeypatch, tmp_path):
    monkeypatch.setenv("DEM_PATH", str(tmp_path / "missing.tif"))
    assert client.get("/api/health").json()["terrain"] == "synthetic"


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
