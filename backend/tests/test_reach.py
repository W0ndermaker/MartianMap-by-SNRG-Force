import numpy as np
import pytest

from app.core import constants as c
from app.core.geo import make_grid
from app.core.reach import reach_features, travel_minutes, walkback_minutes
from app.core.terrain import Terrain, compute_slope_deg

CELL = 10.0


def _terrain(elev: np.ndarray) -> Terrain:
    grid = make_grid((137.30, -4.70, 137.40, -4.60), CELL)
    grid = type(grid)(**{**grid.__dict__, "n_rows": elev.shape[0], "n_cols": elev.shape[1]})
    return Terrain(elev=elev, slope=compute_slope_deg(elev, CELL), grid=grid, kind="synthetic")


def test_flat_ground_time_is_distance_over_speed():
    t = _terrain(np.zeros((41, 41)))
    minutes = travel_minutes(t, (20, 20), 20.0, 1.0)
    assert minutes[20, 20] == 0
    # 20 cells east = 200 m at 1 m/s = 200 s.
    assert minutes[20, 40] == pytest.approx(200 / 60, rel=1e-6)


def test_wall_forces_detour_and_blocks_unreachable_cells():
    elev = np.zeros((41, 41))
    elev[:, 25:27] = 1000.0  # vertical wall, no gap
    t = _terrain(elev)
    minutes = travel_minutes(t, (20, 10), 20.0, 1.0)
    assert np.isinf(minutes[20, 35])
    assert np.isfinite(minutes[20, 20])


def test_rings_are_ordered_and_outer_is_walkback():
    t = _terrain(np.zeros((201, 201)))
    minutes = travel_minutes(t, (100, 100), 20.0, 1.0)
    levels = [3.0, 5.0, 8.0]  # rings of 18-48 cells radius, above the noise filter
    feats = reach_features(t, minutes, levels)
    areas = [f["properties"]["area_km2"] for f in feats]
    assert areas == sorted(areas)
    assert all(f["geometry"]["coordinates"] for f in feats)
    assert walkback_minutes() == (c.EVA_MAX_DURATION_MIN - c.COPILOT_RESERVE_MIN) / 2


def test_steep_origin_reaches_nothing():
    elev = np.tile(np.arange(21) * CELL * 2.0, (21, 1))  # 63 degree plane
    t = _terrain(elev)
    assert np.isinf(travel_minutes(t, (10, 10), 20.0, 1.0)).all()
