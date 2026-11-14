"""Precompute fallback routes for the frontend (shown when the backend is unreachable).

Uses the team's route planner (backend/app/core, unchanged) on REAL terrain: the USGS HiRISE DEM grid
that the frontend also renders (public/data/terrain/gale_fine.*), resampled to the backend grid.

Run from the frontend folder with the backend's dependencies, e.g.:
  uv run --no-project --python 3.12 --with-requirements ../backend/requirements.txt \
      python scripts/precompute_routes.py [--bounds 137.30,-4.78,137.46,-4.56] [--cell 10]
Output: public/data/fallback-routes.json
"""

import argparse
import datetime as dt
import json
import math
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
FRONT = HERE.parent
sys.path.insert(0, str(FRONT.parent / "backend"))

from app.core.geo import make_grid, to_lonlat  # noqa: E402
from app.core.planner import plan_route  # noqa: E402
from app.core.terrain import Terrain, compute_slope_deg  # noqa: E402
from app.schemas import RouteResponse  # noqa: E402

DEFAULT_BOUNDS = (137.30, -4.78, 137.46, -4.56)  # API contract example / current /api/health
MAX_SLOPE = 20.0  # API contract default (model assumption)
SPEED = 1.0  # API contract default, m/s on flat ground (model assumption)

# Endpoints are real Curiosity end-of-drive positions (NASA/JPL MMGIS MSL_waypoints.json).
ROUTES = [
    ("landing-to-sol388", "Bradbury Landing → Curiosity stop, sol 388", (137.44163, -4.58947), (137.42706, -4.60625)),
    ("pahrump-to-sol1243", "Pahrump Hills → Curiosity stop, sol 1243", (137.37733, -4.66376), (137.36711, -4.67906)),
    ("sol1503-to-sol1889", "Curiosity stops, sol 1503 → sol 1889 (climb)", (137.35605, -4.70156), (137.37444, -4.72813)),
    ("sol2995-to-sol3601", "Curiosity stops, sol 2995 → sol 3601 (foothills)", (137.39846, -4.73407), (137.39926, -4.76078)),
]

# Points of interest used when /api/poi is unreachable. Positions are Curiosity waypoints; photos are
# Curiosity Navcam raw images from those sols (NASA/JPL-Caltech raw image API).
POI = [
    ("poi-base", "Bradbury Landing (base)", "base", (137.44163, -4.58947),
     "Curiosity's landing site (sol 3). Used here as the habitat / base for the EVA.", None),
    ("poi-pahrump", "Pahrump Hills", "science", (137.37733, -4.66376),
     "Outcrop at the base of Mount Sharp studied by Curiosity in 2014-2015 (sol ~944): layered lakebed mudstone.",
     "https://mars.jpl.nasa.gov/msl-raw-images/proj/msl/redops/ods/surface/sol/00944/opgs/edr/ncam/NRB_481299063EDR_F0451086NCAM00385M_.JPG"),
    ("poi-sol3601", "Curiosity stop, sol 3601", "rover_stop", (137.39926, -4.76078),
     "Curiosity end-of-drive position on sol 3601 (2022-09-23), on the climb up Mount Sharp.",
     "https://mars.nasa.gov/msl-raw-images/proj/msl/redops/ods/surface/sol/03601/opgs/edr/ncam/NRB_717170161EDR_F0971434NCAM00200M_.JPG"),
    ("poi-sol4098", "Curiosity stop, sol 4098", "rover_stop", (137.40698, -4.77999),
     "Curiosity end-of-drive position on sol 4098 (2024-02-15).",
     "https://mars.nasa.gov/msl-raw-images/proj/msl/redops/ods/surface/sol/04098/opgs/edr/ncam/NRB_761283635EDR_F1060270NCAM00200M_.JPG"),
]


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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bounds", default=",".join(map(str, DEFAULT_BOUNDS)))
    ap.add_argument("--cell", type=float, default=10.0)
    args = ap.parse_args()
    bounds = tuple(float(v) for v in args.bounds.split(","))

    meta, h = load_heights()
    grid = make_grid(bounds, args.cell)
    rows, cols = np.meshgrid(np.arange(grid.n_rows), np.arange(grid.n_cols), indexing="ij")
    # cell centres -> lon/lat (vectorised version of geo.to_lonlat)
    lon = grid.lon0 + np.degrees((cols + 0.5) * grid.cell_size_m / (3396190.0 * math.cos(math.radians(grid.lat_ts))))
    lat = grid.lat_top - np.degrees((rows + 0.5) * grid.cell_size_m / 3396190.0)
    assert abs(to_lonlat(grid, 0, 0)[0] - lon[0, 0]) < 1e-9
    elev = sample(meta, h, lon, lat).astype(np.float32)
    terrain = Terrain(elev=elev, slope=compute_slope_deg(elev, grid.cell_size_m), grid=grid, kind="real")
    print(f"grid {grid.n_cols}x{grid.n_rows} @ {grid.cell_size_m} m, elev {np.nanmin(elev):.0f}..{np.nanmax(elev):.0f} m")

    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
    routes = []
    for rid, name, start, goal in ROUTES:
        res = plan_route(terrain, start, goal, MAX_SLOPE, SPEED)
        resp = RouteResponse.model_validate(res).model_dump(mode="json")
        print(f"  {rid}: {resp['status']} {resp.get('distance_m')} m, {resp.get('duration_min')} min, "
              f"max slope {resp.get('max_slope_deg')}°, hazards {len(resp.get('hazards') or [])}")
        if resp["status"] != "ok":
            continue
        routes.append({"id": rid, "name": name, "start": list(start), "goal": list(goal),
                       "request": {"start": list(start), "goal": list(goal), "max_slope_deg": MAX_SLOPE,
                                   "speed_flat_m_s": SPEED},
                       "computed_at": now, "terrain": f"real: {meta['source']}, resampled to {args.cell:g} m",
                       "response": resp})

    poi = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": list(p)},
         "properties": {"id": i, "name": n, "kind": k, "description": d, "photo_url": url,
                        "photo_credit": "NASA/JPL-Caltech" if url else None}}
        for i, n, k, p, d, url in POI
        if bounds[0] <= p[0] <= bounds[2] and bounds[1] <= p[1] <= bounds[3]]}

    out = {
        "note": ("Precomputed with the team route planner (backend/app/core) on the USGS HiRISE DEM. Shown only when "
                 "the route service is unreachable. Max slope and walking speed are API defaults (model assumptions)."),
        "bounds": list(bounds),
        "routes": routes,
        "poi": poi,
    }
    dst = FRONT / "public/data/fallback-routes.json"
    dst.write_text(json.dumps(out, separators=(",", ":")))
    print(f"wrote {dst.relative_to(FRONT)}: {len(routes)} routes, {len(poi['features'])} POIs, {dst.stat().st_size} B")


if __name__ == "__main__":
    main()
