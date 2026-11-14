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


def bilinear(arr: np.ndarray, rc: np.ndarray) -> np.ndarray:
    """Bilinear sample of a grid at fractional (row, col) points; falls back to the nearest cell
    where a neighbour is NaN."""
    r = np.clip(rc[:, 0], 0, arr.shape[0] - 1)
    c = np.clip(rc[:, 1], 0, arr.shape[1] - 1)
    r0 = (
        np.minimum(np.floor(r).astype(int), arr.shape[0] - 2)
        if arr.shape[0] > 1
        else np.zeros_like(r, int)
    )
    c0 = (
        np.minimum(np.floor(c).astype(int), arr.shape[1] - 2)
        if arr.shape[1] > 1
        else np.zeros_like(c, int)
    )
    r1 = np.minimum(r0 + 1, arr.shape[0] - 1)
    c1 = np.minimum(c0 + 1, arr.shape[1] - 1)
    tr, tc = r - r0, c - c0
    v = (
        arr[r0, c0] * (1 - tr) * (1 - tc)
        + arr[r0, c1] * (1 - tr) * tc
        + arr[r1, c0] * tr * (1 - tc)
        + arr[r1, c1] * tr * tc
    )
    nearest = arr[np.rint(r).astype(int), np.rint(c).astype(int)]
    return np.where(np.isfinite(v), v, nearest)


def polyline_metrics(
    points_rc: np.ndarray,
    elev: np.ndarray,
    slope: np.ndarray,
    cell_size_m: float,
    speed_flat_m_s: float,
) -> dict:
    """Metrics for a densely sampled polyline of fractional (row, col) points.

    Time uses Tobler's function with the signed grade of each step (downhill is faster than
    uphill). Terrain slope (direction-free) at the nearest cell gives max_slope_deg.
    Returns the same keys as path_metrics plus z (elevation at every point) and s (slope).
    """
    z = bilinear(elev.astype(np.float64), points_rc)
    cells = np.rint(points_rc).astype(int)
    s = slope[cells[:, 0], cells[:, 1]]
    horizontal = np.hypot(*np.diff(points_rc, axis=0).T) * cell_size_m
    dz = np.diff(z)
    step = np.hypot(horizontal, dz)
    grade_deg = np.degrees(np.arctan2(dz, np.maximum(horizontal, 1e-9)))
    time_s = step / speed_m_s(grade_deg, speed_flat_m_s)
    duration_min = float(time_s.sum() / c.SECONDS_PER_MINUTE)
    return {
        "distance_m": float(step.sum()),
        "duration_min": duration_min,
        "o2_used_pct": duration_min / c.EVA_MAX_DURATION_MIN * 100.0,
        "max_slope_deg": float(np.nanmax(s)),
        "ascent_m": float(dz[dz > 0].sum()),
        "descent_m": float(-dz[dz < 0].sum()),
        "cum_dist_m": np.concatenate(([0.0], np.cumsum(step))),
        "z": z,
        "s": s,
        "cells": cells,
    }
