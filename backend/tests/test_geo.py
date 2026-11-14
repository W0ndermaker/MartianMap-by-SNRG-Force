import itertools
import math

import pytest

from app.core.geo import bounds, make_grid, polyline_to_cells, to_cell, to_lonlat

BOUNDS = (137.30, -4.78, 137.46, -4.56)


@pytest.fixture
def grid():
    return make_grid(BOUNDS, 100.0)


def test_roundtrip_returns_same_cell(grid):
    for cell in [(0, 0), (10, 20), (grid.n_rows - 1, grid.n_cols - 1)]:
        lon, lat = to_lonlat(grid, *cell)
        assert to_cell(grid, lon, lat) == cell


def test_row_zero_is_north(grid):
    _, lat_top = to_lonlat(grid, 0, 0)
    _, lat_next = to_lonlat(grid, 1, 0)
    assert lat_top > lat_next


def test_outside_grid_returns_none(grid):
    assert to_cell(grid, 137.2, -4.6) is None
    assert to_cell(grid, 137.4, -4.0) is None
    assert to_cell(grid, 137.4, -5.5) is None
    assert to_cell(grid, 138.0, -4.6) is None


def test_longitude_normalization(grid):
    assert to_cell(grid, 137.4, -4.6) is not None
    assert to_cell(grid, 137.4 - 360.0, -4.6) == to_cell(grid, 137.4, -4.6)
    assert to_cell(grid, 137.4 + 360.0, -4.6) == to_cell(grid, 137.4, -4.6)


def test_cell_size_matches_mars_radius(grid):
    # One cell step south is cell_size_m on a sphere of Mars radius.
    _, lat0 = to_lonlat(grid, 0, 0)
    _, lat1 = to_lonlat(grid, 1, 0)
    meters = math.radians(lat0 - lat1) * 3_396_190.0
    assert meters == pytest.approx(100.0, rel=1e-6)


def test_bounds_inside_requested(grid):
    min_lon, min_lat, max_lon, max_lat = bounds(grid)
    assert min_lon == pytest.approx(137.30)
    assert max_lat == pytest.approx(-4.56)
    assert min_lat >= BOUNDS[1] - 1e-9
    assert max_lon <= BOUNDS[2] + 1e-9


def test_polyline_to_cells_is_8_connected_and_covers_ends(grid):
    a = to_lonlat(grid, 5, 5)
    b = to_lonlat(grid, 12, 30)
    cells = polyline_to_cells(grid, [a, b])
    assert cells[0] == (5, 5) and cells[-1] == (12, 30)
    for (r0, c0), (r1, c1) in itertools.pairwise(cells):
        assert max(abs(r1 - r0), abs(c1 - c0)) == 1


def test_polyline_to_cells_skips_points_outside_grid(grid):
    inside = to_lonlat(grid, 3, 3)
    assert polyline_to_cells(grid, [(10.0, 10.0), inside]) == [(3, 3)]
