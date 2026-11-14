"""Build the walk-back rings from the crew base for the map (run after prepare_dem.py).

Usage (from backend/):
    .venv/bin/python scripts/build_reach.py [--out ../data/reach_from_base.geojson]

Writes a GeoJSON FeatureCollection: one MultiLineString per ring (30 min, 1 h, 2 h, 3 h of
walking from the base) plus the walk-back limit (half the oxygen supply: far enough that the
astronaut can still walk back). The file works offline; the frontend draws it on the 3D map.
"""

import argparse
import json
import sys
import time
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core import constants as c
from app.core.geo import to_cell
from app.core.reach import reach_features, travel_minutes, walkback_minutes
from app.core.terrain import load_terrain

BACKEND = Path(__file__).resolve().parent.parent


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dem", type=Path, default=BACKEND / "data_raw" / "gale_dem.tif")
    parser.add_argument("--poi", type=Path, default=BACKEND / "app" / "data" / "poi.geojson")
    parser.add_argument(
        "--out", type=Path, default=BACKEND.parent / "data" / "reach_from_base.geojson"
    )
    parser.add_argument("--max-slope", type=float, default=c.DEFAULT_MAX_SLOPE_DEG)
    args = parser.parse_args()

    terrain = load_terrain(args.dem)
    pois = json.loads(args.poi.read_text(encoding="utf-8"))["features"]
    base = next(f for f in pois if f["properties"]["kind"] == "base")
    lon, lat = base["geometry"]["coordinates"]
    origin = to_cell(terrain.grid, lon, lat)
    if origin is None:
        raise SystemExit("The base is outside the elevation map")

    t0 = time.perf_counter()
    minutes = travel_minutes(terrain, origin, args.max_slope, c.DEFAULT_SPEED_FLAT_M_S)
    levels = [*c.REACH_RING_MINUTES, walkback_minutes()]
    features = reach_features(terrain, minutes, levels)
    elapsed = time.perf_counter() - t0

    collection = {
        "type": "FeatureCollection",
        "properties": {
            "origin": [lon, lat],
            "origin_name": base["properties"]["name"],
            "max_slope_deg": args.max_slope,
            "speed_flat_m_s": c.DEFAULT_SPEED_FLAT_M_S,
            "eva_max_duration_min": c.EVA_MAX_DURATION_MIN,
            "walkback_minutes": walkback_minutes(),
            "terrain": terrain.kind,
            "cell_size_m": terrain.grid.cell_size_m,
            "note": (
                "Walking time from the base on the elevation map (slope limit and Tobler speed, "
                "every slope treated as a climb, so the way back takes the same time). "
                "Planning estimate, not a safety guarantee."
            ),
        },
        "features": features,
    }
    args.out.write_text(json.dumps(collection, separators=(",", ":")) + "\n", encoding="utf-8")

    reachable = np.isfinite(minutes)
    print(f"Computed in {elapsed:.2f} s; wrote {args.out} ({args.out.stat().st_size // 1024} KB)")
    print(f"Reachable at all within {args.max_slope:g} deg: {reachable.mean():.0%} of the map")
    for f in features:
        p = f["properties"]
        print(
            f"  {p['label']:>16}: {p['area_km2']:6.1f} km2, {len(f['geometry']['coordinates'])} lines"
        )


if __name__ == "__main__":
    main()
