"""Route planning: ties terrain, pathfinding, EVA metrics and hazards into one response dict."""

import numpy as np

from app.core import constants as c
from app.core.eva import polyline_metrics, speed_m_s
from app.core.geo import to_cell, to_lonlat
from app.core.hazards import find_hazards
from app.core.pathfinding import densify, find_path, smooth_path
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
    cost_factor: np.ndarray | None = None,
) -> dict:
    """Plan a route between two [lon, lat] points; return a RouteResponse-shaped dict.

    ``cost_factor`` (same shape as the grid) multiplies the slope-based travel cost, e.g. a
    roughness penalty and a discount along Curiosity's path (see app.core.costs).
    """
    grid = terrain.grid
    start_cell = to_cell(grid, *start)
    goal_cell = to_cell(grid, *goal)
    if start_cell is None or goal_cell is None:
        which = "Start" if start_cell is None else "Goal"
        return {"status": "out_of_bounds", "reason": f"{which} point is outside the mapped area"}

    has_data = np.isfinite(terrain.elev)
    passable = has_data & (terrain.slope <= max_slope_deg)
    for name, cell in (("Start", start_cell), ("Goal", goal_cell)):
        if not has_data[cell]:
            return {"status": "no_route", "reason": f"{name} point has no elevation data"}
        if not passable[cell]:
            return {
                "status": "no_route",
                "reason": f"{name} point is steeper than the max slope {max_slope_deg:g}°",
            }

    cost = np.where(passable, 1.0 / speed_m_s(terrain.slope, speed_flat_m_s), np.inf)
    if cost_factor is not None:
        cost = cost * cost_factor
    path = find_path(cost, start_cell, goal_cell)
    if path is None:
        return {
            "status": "no_route",
            "reason": f"No passable route at max slope {max_slope_deg:g}°",
        }

    # Straighten the 8-connected grid path where that is passable and not slower, then sample
    # it every cell so metrics, profile and hazards follow the line that is drawn.
    vertices = smooth_path(path, cost, grid.cell_size_m)
    samples = densify(vertices, step=1.0)
    m = polyline_metrics(samples, terrain.elev, terrain.slope, grid.cell_size_m, speed_flat_m_s)
    z, s = m["z"], m["s"]

    vz = [float(z[0])]
    # elevation at each kept vertex (samples include the vertices in order)
    vi = 0
    for k in range(1, len(vertices)):
        target = np.asarray(vertices[k])
        while vi < len(samples) - 1 and not np.allclose(samples[vi], target):
            vi += 1
        vz.append(float(z[vi]))
    coords = []
    for (row, col), elev in zip(vertices, vz, strict=True):
        lon, lat = to_lonlat(grid, row, col)
        coords.append([round(lon, c.COORD_DECIMALS), round(lat, c.COORD_DECIMALS), round(elev, 1)])
    # The line starts and ends exactly at the requested points, not at the cell centres.
    coords[0][:2] = [round(start[0] % 360.0, c.COORD_DECIMALS), round(start[1], c.COORD_DECIMALS)]
    coords[-1][:2] = [round(goal[0] % 360.0, c.COORD_DECIMALS), round(goal[1], c.COORD_DECIMALS)]

    keep = _downsample_indices(len(samples), s, c.MAX_PROFILE_POINTS)
    profile = [
        {
            "dist_m": round(float(m["cum_dist_m"][i]), 1),
            "elev_m": round(float(z[i]), 1),
            "slope_deg": round(float(s[i]), 1),
        }
        for i in keep
    ]
    cells = [(int(r), int(col)) for r, col in m["cells"]]
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
        "hazards": find_hazards(cells, terrain.slope, m["cum_dist_m"], grid, max_slope_deg),
    }
