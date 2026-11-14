import numpy as np
import pytest

from app.core.eva import path_metrics, speed_m_s
from app.core.pathfinding import find_path
from app.core.terrain import compute_slope_deg


def test_slope_on_inclined_plane():
    cell = 5.0
    angle = 12.0
    cols = np.arange(40)
    elev = np.tile(np.tan(np.radians(angle)) * cols * cell, (30, 1))
    slope = compute_slope_deg(elev, cell)
    assert slope == pytest.approx(angle, abs=1e-6)


def test_slope_flat_is_zero():
    assert compute_slope_deg(np.zeros((5, 5)), 5.0).max() == 0.0


def test_path_straight_on_flat_grid():
    path = find_path(np.ones((5, 9)), (2, 0), (2, 8))
    assert path[0] == (2, 0) and path[-1] == (2, 8)
    assert all(r == 2 for r, _ in path)


def test_path_goes_around_wall_through_gap():
    cost = np.ones((9, 9))
    cost[:, 4] = np.inf
    cost[7, 4] = 1.0
    path = find_path(cost, (0, 0), (0, 8))
    assert (7, 4) in path
    assert all(np.isfinite(cost[r, c]) for r, c in path)


def test_no_path_through_solid_wall():
    cost = np.ones((9, 9))
    cost[:, 4] = np.inf
    assert find_path(cost, (0, 0), (0, 8)) is None


def test_speed_is_flat_speed_at_zero_slope_and_slower_uphill():
    assert speed_m_s(0.0, 1.3) == pytest.approx(1.3)
    assert speed_m_s(15.0, 1.0) < 1.0


def test_flat_time_equals_distance_over_speed():
    elev = np.zeros((3, 12))
    slope = np.zeros((3, 12))
    path = [(1, c) for c in range(12)]
    m = path_metrics(path, elev, slope, 5.0, 2.0)
    assert m["distance_m"] == pytest.approx(55.0)
    assert m["duration_min"] == pytest.approx(55.0 / 2.0 / 60.0)
    assert m["ascent_m"] == 0.0 and m["descent_m"] == 0.0


def test_ascent_and_descent_counted():
    elev = np.array([[0.0, 3.0, 1.0, 1.0]])
    slope = np.zeros((1, 4))
    m = path_metrics([(0, c) for c in range(4)], elev, slope, 5.0, 1.0)
    assert m["ascent_m"] == pytest.approx(3.0)
    assert m["descent_m"] == pytest.approx(2.0)


def test_hazards_group_consecutive_steep_cells():
    from app.core.geo import make_grid
    from app.core.hazards import find_hazards

    grid = make_grid((137.30, -4.78, 137.46, -4.56), 10.0)
    slope = np.zeros((3, 10))
    slope[1, 3:6] = 18.0
    path = [(1, c) for c in range(10)]
    cum = np.arange(10) * 10.0
    hazards = find_hazards(path, slope, cum, grid, 20.0)
    assert len(hazards) == 1
    assert hazards[0]["type"] == "steep_slope"
    assert hazards[0]["value"] == 18.0
    assert hazards[0]["note"] == "Steep section, 20 m"
