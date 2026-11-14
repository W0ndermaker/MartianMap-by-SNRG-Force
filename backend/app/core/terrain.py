"""Elevation grid, slope map and synthetic terrain."""

from dataclasses import dataclass
from typing import Literal

import numpy as np

from app.core import constants as c
from app.core.geo import GridSpec, make_grid


@dataclass(frozen=True)
class Terrain:
    """Elevation (m) and slope (degrees) arrays on a grid. NaN elevation means no data."""

    elev: np.ndarray
    slope: np.ndarray
    grid: GridSpec
    kind: Literal["real", "synthetic"]


def compute_slope_deg(elev: np.ndarray, cell_size_m: float) -> np.ndarray:
    """Return slope in degrees for an elevation grid in meters with square cells."""
    dz_dy, dz_dx = np.gradient(elev, cell_size_m)
    return np.degrees(np.arctan(np.hypot(dz_dx, dz_dy)))


def make_synthetic_elev(grid: GridSpec) -> np.ndarray:
    """Return gentle hills plus a steep east-west ridge with one gap (deterministic)."""
    rows, cols = np.meshgrid(np.arange(grid.n_rows), np.arange(grid.n_cols), indexing="ij")
    y_m = rows * grid.cell_size_m
    x_m = cols * grid.cell_size_m
    k = 2.0 * np.pi / c.SYNTHETIC_HILL_WAVELENGTH_M
    hills = c.SYNTHETIC_HILL_AMPLITUDE_M * np.sin(k * x_m) * np.cos(k * y_m)

    ridge_y = c.SYNTHETIC_RIDGE_ROW_FRACTION * grid.n_rows * grid.cell_size_m
    ridge = c.SYNTHETIC_RIDGE_HEIGHT_M * np.exp(
        -(((y_m - ridge_y) / c.SYNTHETIC_RIDGE_SIGMA_M) ** 2)
    )
    gap_x = c.SYNTHETIC_RIDGE_GAP_COL_FRACTION * grid.n_cols * grid.cell_size_m
    in_gap = np.abs(x_m - gap_x) < c.SYNTHETIC_RIDGE_GAP_HALF_WIDTH_M
    ridge = np.where(in_gap, 0.0, ridge)
    return (c.SYNTHETIC_BASE_ELEV_M + hills + ridge).astype(np.float32)


def build_synthetic_terrain() -> Terrain:
    """Build the synthetic terrain used when no elevation map is available."""
    grid = make_grid(c.SYNTHETIC_BOUNDS, c.SYNTHETIC_CELL_SIZE_M)
    elev = make_synthetic_elev(grid)
    return Terrain(
        elev=elev, slope=compute_slope_deg(elev, grid.cell_size_m), grid=grid, kind="synthetic"
    )
