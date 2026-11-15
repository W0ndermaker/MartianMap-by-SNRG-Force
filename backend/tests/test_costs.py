import numpy as np
import pytest

from app.core.costs import roughness_factor, roughness_m
from app.core.geo import make_grid, to_lonlat
from app.core.planner import plan_route
from app.core.terrain import Terrain, compute_slope_deg


def test_roughness_is_zero_on_a_plane():
    rows, cols = np.mgrid[0:20, 0:20]
    plane = 3.0 * rows - 1.5 * cols
    assert np.nanmax(roughness_m(plane)[1:-1, 1:-1]) == pytest.approx(0.0, abs=1e-9)
    assert roughness_factor(plane)[1:-1, 1:-1] == pytest.approx(1.0)


def test_roughness_marks_a_bump():
    elev = np.zeros((15, 15))
    elev[7, 7] = 5.0
    r = roughness_m(elev)
    assert r[7, 7] > 1.0
    assert r[0, 0] == pytest.approx(0.0)


def _flat_terrain():
    grid = make_grid((137.30, -4.62, 137.32, -4.60), 10.0)
    elev = np.full(grid.shape, -4490.0, dtype=np.float32)
    return Terrain(elev=elev, slope=compute_slope_deg(elev, 10.0), grid=grid, kind="synthetic")


def test_planner_avoids_costly_cells():
    t = _flat_terrain()
    start, goal = to_lonlat(t.grid, 5, 2), to_lonlat(t.grid, 5, 40)
    factor = np.ones(t.grid.shape)
    factor[5, :] = 3.0  # straight line is expensive
    factor[15, :] = 0.2  # a detour row is cheap
    direct = plan_route(t, start, goal, 20.0, 1.0)
    detour = plan_route(t, start, goal, 20.0, 1.0, cost_factor=factor)
    assert detour["distance_m"] > direct["distance_m"]
