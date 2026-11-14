"""Route planning: ties terrain, pathfinding, EVA metrics and hazards into one response dict."""

import numpy as np

from app.core import constants as c
from app.core.eva import path_metrics, speed_m_s
from app.core.geo import to_cell, to_lonlat
from app.core.hazards import find_hazards
from app.core.pathfinding import find_path
from app.core.terrain import Terrain


def _downsample_indices(n: int, slope: np.ndarray, limit: int) -> np.ndarray:
    """Pick at most ``limit`` indices of n points, keeping first, last and max-slope points."""
    if n <= limit:
        return np.arange(n)
    idx = set(np.linspace(0, n - 1, limit - 1).astype(int).tolist())
    idx.add(int(np.argmax(slope)))
    return np.array(sorted(idx))


def plan_route(
    terrain: Terrain,
    start: tuple[float, float],
    goal: tuple[float, float],
    max_slope_deg: float,
    speed_flat_m_s: float,
) -> dict:
    """Plan a route between two [lon, lat] points; return a RouteResponse-shaped dict."""
    grid = terrain.grid
    start_cell = to_cell(grid, *start)
    goal_cell = to_cell(grid, *goal)
    if start_cell is None or goal_cell is None:
        which = "Start" if start_cell is None else "Goal"
        return {"status": "out_of_bounds", "reason": f"{which} point is outside the mapped area"}

    passable = np.isfinite(terrain.elev) & (terrain.slope <= max_slope_deg)
    for name, cell in (("Start", start_cell), ("Goal", goal_cell)):
        if not passable[cell]:
            return {
                "status": "no_route",
                "reason": f"{name} point is not passable at max slope {max_slope_deg:g}°",
            }

    cost = np.where(passable, 1.0 / speed_m_s(terrain.slope, speed_flat_m_s), np.inf)
    path = find_path(cost, start_cell, goal_cell)
    if path is None:
        return {
            "status": "no_route",
            "reason": f"No passable route at max slope {max_slope_deg:g}°",
        }

    m = path_metrics(path, terrain.elev, terrain.slope, grid.cell_size_m, speed_flat_m_s)
    rc = np.asarray(path)
    z = terrain.elev[rc[:, 0], rc[:, 1]]
    s = terrain.slope[rc[:, 0], rc[:, 1]]
    coords = []
    for (row, col), elev in zip(path, z, strict=True):
        lon, lat = to_lonlat(grid, row, col)
        coords.append(
            [round(lon, c.COORD_DECIMALS), round(lat, c.COORD_DECIMALS), round(float(elev), 1)]
        )

    keep = _downsample_indices(len(path), s, c.MAX_PROFILE_POINTS)
    profile = [
        {
            "dist_m": round(float(m["cum_dist_m"][i]), 1),
            "elev_m": round(float(z[i]), 1),
            "slope_deg": round(float(s[i]), 1),
        }
        for i in keep
    ]
    return {
        "status": "ok",
        "path": {"type": "LineString", "coordinates": coords},
        "distance_m": round(m["distance_m"], 1),
        "duration_min": round(m["duration_min"], 1),
        "o2_used_pct": round(m["o2_used_pct"], 1),
        "max_slope_deg": round(m["max_slope_deg"], 1),
        "ascent_m": round(m["ascent_m"], 1),
        "descent_m": round(m["descent_m"], 1),
        "profile": profile,
        "hazards": find_hazards(path, terrain.slope, m["cum_dist_m"], grid, max_slope_deg),
    }
