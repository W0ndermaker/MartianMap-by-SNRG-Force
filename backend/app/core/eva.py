"""Extravehicular activity model: walking speed, time, oxygen and elevation metrics."""

import math

import numpy as np

from app.core import constants as c


def speed_m_s(slope_deg: np.ndarray | float, speed_flat_m_s: float) -> np.ndarray | float:
    """Walking speed (m/s) for a slope in degrees, scaled to the flat-ground speed.

    Uses Tobler's hiking function normalized to 1 at zero slope (ASSUMPTION, see constants).
    """

    def tobler(s_rad):
        return np.exp(-c.TOBLER_K * np.abs(np.tan(s_rad) + c.TOBLER_OFFSET))

    return speed_flat_m_s * tobler(np.radians(slope_deg)) / tobler(0.0)


def path_metrics(
    path: list[tuple[int, int]],
    elev: np.ndarray,
    slope: np.ndarray,
    cell_size_m: float,
    speed_flat_m_s: float,
) -> dict:
    """Compute metrics for a path of grid cells.

    Returns distance_m, duration_min, o2_used_pct, max_slope_deg, ascent_m, descent_m and
    cum_dist_m (cumulative distance in meters at every path cell).
    """
    rc = np.asarray(path)
    z = elev[rc[:, 0], rc[:, 1]].astype(np.float64)
    s = slope[rc[:, 0], rc[:, 1]]
    d_rc = np.abs(np.diff(rc, axis=0))
    horizontal = cell_size_m * np.where(d_rc.sum(axis=1) == 2, math.sqrt(2.0), 1.0)
    dz = np.diff(z)
    step = np.hypot(horizontal, dz)
    time_s = step / speed_m_s(s[1:], speed_flat_m_s)
    duration_min = float(time_s.sum() / c.SECONDS_PER_MINUTE)
    return {
        "distance_m": float(step.sum()),
        "duration_min": duration_min,
        "o2_used_pct": duration_min / c.EVA_MAX_DURATION_MIN * 100.0,
        "max_slope_deg": float(s.max()),
        "ascent_m": float(dz[dz > 0].sum()),
        "descent_m": float(-dz[dz < 0].sum()),
        "cum_dist_m": np.concatenate(([0.0], np.cumsum(step))),
    }
