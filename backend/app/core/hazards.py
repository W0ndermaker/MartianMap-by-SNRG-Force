"""Hazard detection along a path."""

import numpy as np

from app.core import constants as c
from app.core.geo import GridSpec, to_lonlat


def find_hazards(
    path: list[tuple[int, int]],
    slope: np.ndarray,
    cum_dist_m: np.ndarray,
    grid: GridSpec,
    max_slope_deg: float,
) -> list[dict]:
    """Group consecutive steep path cells into hazard sections.

    A cell is steep when its slope >= HAZARD_SLOPE_FRACTION * max_slope_deg.
    Returns dicts with type, position [lon, lat], value (max slope, degrees) and note.
    """
    rc = np.asarray(path)
    s = slope[rc[:, 0], rc[:, 1]]
    steep = s >= c.HAZARD_SLOPE_FRACTION * max_slope_deg
    hazards: list[dict] = []
    i = 0
    while i < len(path):
        if not steep[i]:
            i += 1
            continue
        j = i
        while j + 1 < len(path) and steep[j + 1]:
            j += 1
        mid_row, mid_col = path[(i + j) // 2]
        lon, lat = to_lonlat(grid, mid_row, mid_col)
        length_m = max(float(cum_dist_m[j] - cum_dist_m[i]), grid.cell_size_m)
        hazards.append(
            {
                "type": "steep_slope",
                "position": [round(lon, c.COORD_DECIMALS), round(lat, c.COORD_DECIMALS)],
                "value": round(float(s[i : j + 1].max()), 1),
                "note": f"Steep section, {round(length_m)} m",
            }
        )
        i = j + 1
    return hazards
