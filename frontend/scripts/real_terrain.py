"""Real Gale terrain for the team backend (which still builds synthetic terrain; DEM loading is a TODO there).

Builds a backend Terrain(kind="real") from the USGS HiRISE height grid the 3D map renders
(public/data/terrain/gale_fine.*: MSL_Gale_DEM_Mosaic_1m_v3, averaged to ~10 m) and can patch the backend's
get_terrain() with it, without changing backend code. Used by:
  scripts/real_terrain_backend.py   run the API on real terrain
  scripts/run_with_real_terrain.py  run any backend-based script (e.g. data/scripts/build_demo_routes.py)
"""

import json
import math
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
FRONT = HERE.parent
sys.path.insert(0, str(FRONT.parent / "backend"))

from app.core.geo import make_grid, to_lonlat  # noqa: E402
from app.core.terrain import Terrain, compute_slope_deg  # noqa: E402

DEFAULT_BOUNDS = (137.30, -4.78, 137.46, -4.56)  # current /api/health bounds (API contract example)


def load_heights():
    meta = json.loads((FRONT / "public/data/terrain/gale_fine.json").read_text())
    raw = np.fromfile(FRONT / "public/data/terrain/gale_fine.bin", dtype="<u2").reshape(meta["height"], meta["width"])
    h = raw.astype("float64") * meta["scale_m"] + meta["offset_m"]
    h[raw == meta["nodata"]] = np.nan
    return meta, h


def sample(meta, h, lon, lat):
    fx = (lon - meta["west"]) / (meta["east"] - meta["west"]) * (meta["width"] - 1)
    fy = (meta["north"] - lat) / (meta["north"] - meta["south"]) * (meta["height"] - 1)
    x0, y0 = np.floor(fx).astype(int), np.floor(fy).astype(int)
    inside = (x0 >= 0) & (y0 >= 0) & (x0 < meta["width"] - 1) & (y0 < meta["height"] - 1)
    x0c, y0c = np.clip(x0, 0, meta["width"] - 2), np.clip(y0, 0, meta["height"] - 2)
    tx, ty = fx - x0c, fy - y0c
    a, b = h[y0c, x0c], h[y0c, x0c + 1]
    c, d = h[y0c + 1, x0c], h[y0c + 1, x0c + 1]
    v = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty
    return np.where(inside, v, np.nan)


def build_real_terrain(bounds, cell_m):
    """Backend Terrain (kind='real') on the backend grid, sampled from the HiRISE height grid."""
    meta, h = load_heights()
    grid = make_grid(bounds, cell_m)
    rows, cols = np.meshgrid(np.arange(grid.n_rows), np.arange(grid.n_cols), indexing="ij")
    # cell centres -> lon/lat (vectorised version of geo.to_lonlat)
    lon = grid.lon0 + np.degrees((cols + 0.5) * grid.cell_size_m / (3396190.0 * math.cos(math.radians(grid.lat_ts))))
    lat = grid.lat_top - np.degrees((rows + 0.5) * grid.cell_size_m / 3396190.0)
    assert abs(to_lonlat(grid, 0, 0)[0] - lon[0, 0]) < 1e-9
    elev = sample(meta, h, lon, lat).astype(np.float32)
    terrain = Terrain(elev=elev, slope=compute_slope_deg(elev, grid.cell_size_m), grid=grid, kind="real")
    print(f"grid {grid.n_cols}x{grid.n_rows} @ {grid.cell_size_m} m, elev {np.nanmin(elev):.0f}..{np.nanmax(elev):.0f} m")
    return meta, terrain


def patch_backend(terrain):
    """Make the backend serve `terrain`: patch every module that imported get_terrain by name."""
    import app.api.health as health_api
    import app.api.route as route_api
    import app.deps as deps

    def get_real_terrain():
        return terrain

    for mod in (deps, health_api, route_api):
        mod.get_terrain = get_real_terrain
