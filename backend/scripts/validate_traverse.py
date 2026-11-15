"""Compare our walking routes with Curiosity's real drives between the points of interest.

Usage (from backend/):
    .venv/bin/python scripts/validate_traverse.py [--traverse ../data/curiosity_traverse.geojson]
        [--poi app/data/poi.geojson] [--dem data_raw/gale_dem.tif] [--json out.json]

The points of interest lie on the rover path in mission order, so every pair of consecutive
points is one real leg. For each leg the real path is put on our grid and measured with the
same EVA model as our route (same elevation map, same speed formula). The script also checks
the elevation map against the elevations recorded along the traverse.

Caveat for readers: the rover picked its path for driving and science, not for a walking
astronaut, so differences are expected; the comparison shows whether our routes are of the
same order and whether the real path is walkable under our slope limit.
"""

import argparse
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import itertools

from app.core import constants as c
from app.core.costs import roughness_factor
from app.core.eva import path_metrics
from app.core.geo import polyline_to_cells, to_cell
from app.core.planner import plan_route
from app.core.terrain import Terrain, load_terrain

BACKEND = Path(__file__).resolve().parent.parent


def load_drive_points(path: Path) -> list[list[float]]:
    """Return all [lon, lat, elev] vertices of the drive LineStrings, in mission order."""
    data = json.loads(path.read_text(encoding="utf-8"))
    points: list[list[float]] = []
    for feature in data["features"]:
        if feature["geometry"]["type"] == "LineString":
            points.extend(feature["geometry"]["coordinates"])
    return points


def nearest_index(points: np.ndarray, lon: float, lat: float, start: int) -> int:
    """Index (>= start) of the traverse vertex closest to [lon, lat] in degrees."""
    d = np.hypot(points[start:, 0] - lon, points[start:, 1] - lat)
    return start + int(np.argmin(d))


def real_leg_metrics(terrain: Terrain, coords: np.ndarray, max_slope_deg: float) -> dict:
    """Measure a real path on our grid with the EVA model; add the walkable share."""
    cells = polyline_to_cells(terrain.grid, coords[:, :2].tolist())
    m = path_metrics(
        cells, terrain.elev, terrain.slope, terrain.grid.cell_size_m, c.DEFAULT_SPEED_FLAT_M_S
    )
    rc = np.asarray(cells)
    slope = terrain.slope[rc[:, 0], rc[:, 1]]
    m["walkable_pct"] = float(np.mean(slope <= max_slope_deg) * 100.0)
    return m


def elevation_check(terrain: Terrain, points: np.ndarray) -> dict:
    """Compare traverse elevations with our elevation map at the same places (meters)."""
    diffs = []
    for lon, lat, elev in points:
        cell = to_cell(terrain.grid, lon, lat)
        if cell is not None and np.isfinite(terrain.elev[cell]):
            diffs.append(float(terrain.elev[cell]) - elev)
    d = np.asarray(diffs)
    return {
        "points": int(d.size),
        "median_diff_m": round(float(np.median(d)), 2),
        "p95_abs_diff_m": round(float(np.percentile(np.abs(d), 95)), 2),
    }


def straight_vs_route(
    terrain: Terrain, pois: list[dict], max_slope_deg: float, factor: np.ndarray
) -> dict:
    """For every pair of points of interest, compare the straight line with our route.

    The straight line is measured on the same grid as the route, so both lengths carry the
    same raster effect. Reports how many straight lines cross terrain steeper than the limit
    and how much longer the safe route is (median over pairs where a route exists).
    """
    crossing, extra, straight_max, route_max = 0, [], [], []
    pairs = list(itertools.combinations(pois, 2))
    for a, b in pairs:
        start = a["geometry"]["coordinates"]
        goal = b["geometry"]["coordinates"]
        line = polyline_to_cells(terrain.grid, [start, goal])
        m = path_metrics(
            line, terrain.elev, terrain.slope, terrain.grid.cell_size_m, c.DEFAULT_SPEED_FLAT_M_S
        )
        straight_max.append(m["max_slope_deg"])
        if m["max_slope_deg"] > max_slope_deg:
            crossing += 1
        route = plan_route(
            terrain,
            tuple(start),
            tuple(goal),
            max_slope_deg,
            c.DEFAULT_SPEED_FLAT_M_S,
            cost_factor=factor,
        )
        if route["status"] == "ok":
            extra.append(route["distance_m"] / m["distance_m"] - 1.0)
            route_max.append(route["max_slope_deg"])
    return {
        "pairs": len(pairs),
        "straight_crosses_limit": crossing,
        "straight_max_slope_deg": round(max(straight_max), 1),
        "route_max_slope_deg": round(max(route_max), 1),
        "median_extra_length_pct": round(float(np.median(extra)) * 100.0, 1),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--traverse", type=Path, default=BACKEND.parent / "data" / "curiosity_traverse.geojson"
    )
    parser.add_argument("--poi", type=Path, default=BACKEND / "app" / "data" / "poi.geojson")
    parser.add_argument("--dem", type=Path, default=BACKEND / "data_raw" / "gale_dem.tif")
    parser.add_argument("--max-slope", type=float, default=c.DEFAULT_MAX_SLOPE_DEG)
    parser.add_argument("--json", type=Path, help="also write the results as JSON here")
    args = parser.parse_args()

    terrain = load_terrain(args.dem)
    points = np.asarray(load_drive_points(args.traverse), dtype=float)
    pois = json.loads(args.poi.read_text(encoding="utf-8"))["features"]

    # Routes as the API serves them: slope limit and roughness penalty. They do not use the rover
    # path, so the comparison with Curiosity is independent.
    served = roughness_factor(terrain.elev)

    legs = []
    idx = 0
    for a, b in itertools.pairwise(pois):
        start = a["geometry"]["coordinates"]
        goal = b["geometry"]["coordinates"]
        i0 = nearest_index(points, *start, idx)
        i1 = nearest_index(points, *goal, i0)
        idx = i1
        real = real_leg_metrics(terrain, points[i0 : i1 + 1], args.max_slope)
        ours = plan_route(
            terrain,
            tuple(start),
            tuple(goal),
            args.max_slope,
            c.DEFAULT_SPEED_FLAT_M_S,
            cost_factor=served,
        )
        leg = {
            "from": a["properties"]["name"],
            "to": b["properties"]["name"],
            "real_distance_m": round(real["distance_m"]),
            "real_ascent_m": round(real["ascent_m"]),
            "real_max_slope_deg": round(real["max_slope_deg"], 1),
            "real_walkable_pct": round(real["walkable_pct"], 1),
            "real_duration_min": round(real["duration_min"]),
            "status": ours["status"],
        }
        if ours["status"] == "ok":
            leg.update(
                ours_distance_m=round(ours["distance_m"]),
                ours_ascent_m=round(ours["ascent_m"]),
                ours_max_slope_deg=ours["max_slope_deg"],
                ours_duration_min=round(ours["duration_min"]),
                distance_ratio=round(ours["distance_m"] / real["distance_m"], 2),
            )
        legs.append(leg)

    result = {
        "max_slope_deg": args.max_slope,
        "elevation_check": elevation_check(terrain, points),
        "straight_vs_route": straight_vs_route(terrain, pois, args.max_slope, served),
        "legs": legs,
    }

    print(f"Elevation map vs traverse: {result['elevation_check']}")
    print(f"Straight line vs our route, all POI pairs: {result['straight_vs_route']}")
    print(
        "| Leg | Curiosity, m | Ours, m | Ratio | Ascent real / ours, m "
        "| Max slope real / ours, ° | Real path walkable at limit |"
    )
    print("| --- | --- | --- | --- | --- | --- | --- |")
    for leg in legs:
        name = f"{leg['from']} → {leg['to']}"
        if leg["status"] != "ok":
            print(f"| {name} | {leg['real_distance_m']} | {leg['status']} | | | | |")
            continue
        print(
            f"| {name} | {leg['real_distance_m']} | {leg['ours_distance_m']} "
            f"| {leg['distance_ratio']} | {leg['real_ascent_m']} / {leg['ours_ascent_m']} "
            f"| {leg['real_max_slope_deg']} / {leg['ours_max_slope_deg']} "
            f"| {leg['real_walkable_pct']} % |"
        )
    if args.json:
        args.json.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Wrote {args.json}")


if __name__ == "__main__":
    main()
