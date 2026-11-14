from pathlib import Path

import numpy as np
import pytest
import rasterio

from app.core import constants as c
from app.core.geo import make_grid, to_cell
from app.core.terrain import load_terrain


def _write_dem(path, elev, grid, tags=True):
    profile = {
        "driver": "GTiff",
        "dtype": "float32",
        "count": 1,
        "height": elev.shape[0],
        "width": elev.shape[1],
        "nodata": float("nan"),
    }
    with rasterio.open(path, "w", **profile) as dst:
        dst.write(elev.astype(np.float32), 1)
        if tags:
            dst.update_tags(
                **{
                    c.DEM_TAG_LON0: grid.lon0,
                    c.DEM_TAG_LAT_TOP: grid.lat_top,
                    c.DEM_TAG_LAT_TS: grid.lat_ts,
                    c.DEM_TAG_CELL_SIZE_M: grid.cell_size_m,
                }
            )


def test_load_terrain_roundtrip(tmp_path):
    grid = make_grid(c.DEM_BOUNDS, 500.0)
    elev = np.full(grid.shape, -4490.0, dtype=np.float32)
    elev[0, 0] = np.nan
    path = tmp_path / "dem.tif"
    _write_dem(path, elev, grid)

    terrain = load_terrain(path)

    assert terrain.kind == "real"
    assert terrain.grid == grid
    assert np.isnan(terrain.elev[0, 0])
    assert terrain.slope[3, 3] == pytest.approx(0.0)


def test_load_terrain_rejects_file_without_grid_tags(tmp_path):
    grid = make_grid(c.DEM_BOUNDS, 500.0)
    path = tmp_path / "plain.tif"
    _write_dem(path, np.zeros(grid.shape), grid, tags=False)
    with pytest.raises(ValueError, match="not a prepared elevation map"):
        load_terrain(path)


def test_landing_site_is_inside_working_area():
    grid = make_grid(c.DEM_BOUNDS, c.CELL_SIZE_M)
    assert to_cell(grid, *c.LANDING_LON_LAT) is not None


REAL_DEM = Path(__file__).resolve().parent.parent / "data_raw" / "gale_dem.tif"


@pytest.mark.skipif(not REAL_DEM.is_file(), reason="run scripts/prepare_dem.py first")
def test_real_dem_landing_site_checkpoint():
    terrain = load_terrain(REAL_DEM)
    cell = to_cell(terrain.grid, *c.LANDING_LON_LAT)
    assert cell is not None
    low, high = c.LANDING_ELEV_RANGE_M
    assert low <= terrain.elev[cell] <= high
    assert np.isfinite(terrain.slope[cell])
