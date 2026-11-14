"""Reachability from one point: walking time to every cell and contour rings ("walkback").

One least-cost wave from the origin gives the walking time to every grid cell. The speed model
(eva.speed_m_s) treats every slope as a climb, so the time back to the origin equals the time
out: the same array answers "how long to get there" and "how long to walk back".
"""

import numpy as np
from skimage.graph import MCP_Geometric
from skimage.measure import approximate_polygon, find_contours

from app.core import constants as c
from app.core.eva import speed_m_s
from app.core.geo import to_lonlat
from app.core.terrain import Terrain


def travel_minutes(
    terrain: Terrain,
    origin: tuple[int, int],
    max_slope_deg: float,
    speed_flat_m_s: float,
) -> np.ndarray:
    """Walking time in minutes from ``origin`` (row, col) to every cell; inf if unreachable.

    Cells steeper than ``max_slope_deg`` or without elevation are impassable. Time is physical
    (slope only): no roughness or corridor weighting, which only steers the route choice.
    """
    passable = np.isfinite(terrain.elev) & (terrain.slope <= max_slope_deg)
    seconds_per_cell = np.where(
        passable, terrain.grid.cell_size_m / speed_m_s(terrain.slope, speed_flat_m_s), np.inf
    )
    if not passable[origin]:
        return np.full(terrain.grid.shape, np.inf)
    cumulative, _ = MCP_Geometric(seconds_per_cell).find_costs([origin])
    return cumulative / c.SECONDS_PER_MINUTE


def walkback_minutes() -> float:
    """One-way time limit: out and back fit in the supply with the emergency reserve left."""
    return (c.EVA_MAX_DURATION_MIN - c.COPILOT_RESERVE_MIN) / 2.0


def reach_features(terrain: Terrain, minutes: np.ndarray, levels: list[float]) -> list[dict]:
    """GeoJSON features: one MultiLineString of [lon, lat] rings per time level (minutes).

    The last level is expected to be the walkback limit. Impassable or unreachable cells act as
    barriers, so rings bend around steep ground. Loops shorter than REACH_MIN_RING_CELLS are
    dropped and lines are simplified by REACH_SIMPLIFY_CELLS.
    """
    # Unreachable cells get a time above every level so contours close around them.
    ceiling = max(levels) * 2.0
    field = np.where(np.isfinite(minutes), minutes, ceiling)
    features = []
    walkback = walkback_minutes()
    for level in levels:
        lines = []
        for contour in find_contours(field, level):
            # Skip tiny loops around single steep knobs: they are noise at map scale.
            if len(contour) < c.REACH_MIN_RING_CELLS:
                continue
            simple = approximate_polygon(contour, tolerance=c.REACH_SIMPLIFY_CELLS)
            if len(simple) < 2:
                continue
            coords = [
                [round(lon, c.COORD_DECIMALS), round(lat, c.COORD_DECIMALS)]
                for lon, lat in (to_lonlat(terrain.grid, r, col) for r, col in simple)
            ]
            lines.append(coords)
        reach_km2 = float(np.count_nonzero(minutes <= level)) * terrain.grid.cell_size_m**2 / 1e6
        is_walkback = abs(level - walkback) < 1e-9
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "MultiLineString", "coordinates": lines},
                "properties": {
                    "kind": "walkback" if is_walkback else "ring",
                    "minutes": level,
                    "label": "Walk-back limit" if is_walkback else _label(level),
                    "area_km2": round(reach_km2, 1),
                },
            }
        )
    return features


def _label(minutes: float) -> str:
    """'30 min', '1 h', '1 h 30 min' for ring labels."""
    h, m = divmod(round(minutes), 60)
    if h and m:
        return f"{h} h {m} min"
    return f"{h} h" if h else f"{m} min"
