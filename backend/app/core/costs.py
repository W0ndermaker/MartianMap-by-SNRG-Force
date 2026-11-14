"""Extra route cost factors besides slope: terrain roughness and the Curiosity traverse.

Both return a per-cell multiplier for the travel cost (seconds per meter). Values come from the elevation
map and NASA's rover path; the weights are ASSUMPTIONS (see constants.py).
"""

import itertools
import json
import math
from pathlib import Path

import numpy as np
from scipy import ndimage

from app.core import constants as c
from app.core.geo import GridSpec


def roughness_m(elev: np.ndarray) -> np.ndarray:
    """Local relief in meters: RMS of elevation minus its 3x3 mean, over a 3x3 window.

    Zero on any plane (a uniform slope is handled by the slope cost), large on ridges, scarps,
    knobs and pits that are bigger than the grid cell. NaN where elevation is missing.
    """
    filled = np.where(np.isfinite(elev), elev, np.nanmean(elev)).astype(np.float64)
    residual = filled - ndimage.uniform_filter(filled, size=3, mode="nearest")
    # The 3x3 mean is not defined on the outer ring; treat it as smooth instead of inventing relief.
    residual[[0, -1], :] = 0.0
    residual[:, [0, -1]] = 0.0
    # Rounding can make the filtered mean of squares a tiny negative number; clip before sqrt.
    rms = np.sqrt(np.maximum(ndimage.uniform_filter(residual**2, size=3, mode="nearest"), 0.0))
    return np.where(np.isfinite(elev), rms, np.nan)


def roughness_factor(elev: np.ndarray) -> np.ndarray:
    """Cost multiplier 1 + roughness / ROUGHNESS_REF_M, capped at ROUGHNESS_MAX_FACTOR."""
    r = np.nan_to_num(roughness_m(elev), nan=0.0)
    return np.minimum(1.0 + r / c.ROUGHNESS_REF_M, c.ROUGHNESS_MAX_FACTOR)


def _cells_of(grid: GridSpec, lon: np.ndarray, lat: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Vectorised geo.to_cell without the bounds check: (rows, cols) as int arrays."""
    dlon = (lon % 360.0 - grid.lon0 + 180.0) % 360.0 - 180.0
    x_m = np.radians(dlon) * c.MARS_RADIUS_M * math.cos(math.radians(grid.lat_ts))
    y_m = np.radians(grid.lat_top - lat) * c.MARS_RADIUS_M
    return np.floor(y_m / grid.cell_size_m).astype(int), np.floor(x_m / grid.cell_size_m).astype(
        int
    )


def traverse_mask(grid: GridSpec, traverse_file: Path) -> np.ndarray:
    """Cells within TRAVERSE_BUFFER_M of Curiosity's driven path (from the MMGIS traverse file)."""
    mask = np.zeros(grid.shape, dtype=bool)
    if not traverse_file.is_file():
        return mask
    data = json.loads(traverse_file.read_text(encoding="utf-8"))
    step_deg = math.degrees(grid.cell_size_m / 2 / c.MARS_RADIUS_M)  # sample every half cell
    for feature in data.get("features", []):
        geom = feature.get("geometry") or {}
        if geom.get("type") != "LineString":
            continue
        pts = np.asarray([p[:2] for p in geom["coordinates"]], dtype=float)
        for a, b in itertools.pairwise(pts):
            n = max(int(np.ceil(np.hypot(*(b - a)) / step_deg)), 1)
            t = np.linspace(0.0, 1.0, n + 1)[:, None]
            seg = a + (b - a) * t
            rows, cols = _cells_of(grid, seg[:, 0], seg[:, 1])
            ok = (rows >= 0) & (rows < grid.n_rows) & (cols >= 0) & (cols < grid.n_cols)
            mask[rows[ok], cols[ok]] = True
    radius = max(round(c.TRAVERSE_BUFFER_M / grid.cell_size_m), 0)
    if radius:
        yy, xx = np.mgrid[-radius : radius + 1, -radius : radius + 1]
        mask = ndimage.binary_dilation(mask, structure=(xx**2 + yy**2) <= radius**2)
    return mask


def cost_factor(elev: np.ndarray, grid: GridSpec, traverse_file: Path | None) -> np.ndarray:
    """Combined multiplier: roughness penalty, times a discount along Curiosity's path."""
    factor = roughness_factor(elev)
    if traverse_file is not None:
        factor = np.where(
            traverse_mask(grid, traverse_file), factor * c.TRAVERSE_COST_FACTOR, factor
        )
    return factor
