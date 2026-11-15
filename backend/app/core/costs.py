"""Extra route cost besides slope: terrain roughness.

A per-cell multiplier for the travel cost (seconds per meter), from the elevation map; the
weight is an ASSUMPTION (see constants.py). It only steers the route choice: the time and
oxygen of a route are always physical walking time.
"""

import numpy as np
from scipy import ndimage

from app.core import constants as c


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
