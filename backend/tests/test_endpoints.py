from pathlib import Path

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


def test_health_terrain_synthetic_without_dem(monkeypatch):
    monkeypatch.delenv("DEM_PATH", raising=False)
    monkeypatch.setattr("app.config.ENV_FILE", Path("/nonexistent/.env"))
    assert client.get("/api/health").json()["terrain"] == "synthetic"


def test_health_terrain_synthetic_when_dem_unreadable(monkeypatch, tmp_path):
    bad = tmp_path / "missing.tif"
    monkeypatch.setenv("DEM_PATH", str(bad))
    assert client.get("/api/health").json()["terrain"] == "synthetic"


def test_health_terrain_real_when_dem_readable(monkeypatch, tmp_path):
    import numpy as np
    import rasterio
    from rasterio.transform import from_origin

    dem = tmp_path / "dem.tif"
    with rasterio.open(
        dem,
        "w",
        driver="GTiff",
        height=2,
        width=2,
        count=1,
        dtype="float32",
        transform=from_origin(137, -4, 0.01, 0.01),
        crs="EPSG:4326",
    ) as dst:
        dst.write(np.zeros((1, 2, 2), dtype="float32"))
    monkeypatch.setenv("DEM_PATH", str(dem))
    assert client.get("/api/health").json()["terrain"] == "real"
