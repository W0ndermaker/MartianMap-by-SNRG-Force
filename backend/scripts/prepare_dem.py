"""Crop and resample the USGS Gale DEM onto the service grid (run once, manually).

Usage:
    python scripts/prepare_dem.py [--source URL_OR_PATH] [--out data_raw/gale_dem.tif]

The output GeoTIFF has the grid of app.core.geo.make_grid(DEM_BOUNDS, CELL_SIZE_M): row 0 is
north, equirectangular on the Mars sphere. Elevation comes from the 8 m overview of the 1 m source
(only a small part of the file is read) and is averaged to the grid cell size. No-data cells are NaN.
The grid geometry is stored in GRID_* tags, read back by app.core.terrain.load_terrain.
"""

import argparse
import math
import sys
from pathlib import Path

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.transform import Affine
from rasterio.warp import reproject

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core import constants as c
from app.core.geo import make_grid


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--source", default=f"/vsicurl/{c.DEM_SOURCE_URL}")
    parser.add_argument("--out", default="data_raw/gale_dem.tif")
    args = parser.parse_args()

    grid = make_grid(c.DEM_BOUNDS, c.CELL_SIZE_M)
    # Destination CRS: the same sphere and projection that app.core.geo assumes.
    dst_crs = CRS.from_proj4(
        f"+proj=eqc +lat_ts={grid.lat_ts} +lat_0=0 +lon_0={grid.lon0} "
        f"+R={c.MARS_RADIUS_M} +units=m +no_defs"
    )
    top_m = math.radians(grid.lat_top) * c.MARS_RADIUS_M
    dst_transform = Affine(grid.cell_size_m, 0, 0, 0, -grid.cell_size_m, top_m)
    elev = np.full(grid.shape, np.nan, dtype=np.float32)

    # Read the 8 m overview (levels are 4, 8, 16, ... in the source), not the 1 m data:
    # reading 1 m pixels of the whole area would mean hundreds of megabytes over the network.
    with rasterio.open(args.source, overview_level=c.DEM_SOURCE_OVERVIEW_INDEX) as src:
        reproject(
            source=rasterio.band(src, 1),
            destination=elev,
            src_nodata=c.DEM_SOURCE_NODATA,
            dst_transform=dst_transform,
            dst_crs=dst_crs,
            dst_nodata=np.nan,
            resampling=Resampling.average,
        )

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    profile = {
        "driver": "GTiff",
        "dtype": "float32",
        "count": 1,
        "height": grid.n_rows,
        "width": grid.n_cols,
        "nodata": float("nan"),
        "compress": "deflate",
    }
    with rasterio.open(out, "w", **profile) as dst:
        dst.write(elev, 1)
        dst.update_tags(
            **{
                c.DEM_TAG_LON0: grid.lon0,
                c.DEM_TAG_LAT_TOP: grid.lat_top,
                c.DEM_TAG_LAT_TS: grid.lat_ts,
                c.DEM_TAG_CELL_SIZE_M: grid.cell_size_m,
            }
        )
    valid = np.isfinite(elev)
    print(f"Wrote {out}: {grid.n_rows} x {grid.n_cols} cells, {valid.mean():.1%} valid")
    print(f"Elevation range: {np.nanmin(elev):.1f} .. {np.nanmax(elev):.1f} m")


if __name__ == "__main__":
    main()
