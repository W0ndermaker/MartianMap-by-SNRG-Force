"""Conversion between [lon, lat] degrees and grid cells (row, col), on a Mars sphere.

Grid: equirectangular projection on a sphere of radius MARS_RADIUS_M, row 0 is north,
column 0 is at the west edge. Longitude is east, 0-360.
"""

import math
from dataclasses import dataclass

from app.core.constants import MARS_RADIUS_M


@dataclass(frozen=True)
class GridSpec:
    """Grid geometry. Construct with :func:`make_grid`."""

    lon0: float  # west edge, degrees east
    lat_top: float  # north edge, degrees
    lat_ts: float  # standard parallel for the longitude scale, degrees
    cell_size_m: float
    n_rows: int
    n_cols: int

    @property
    def shape(self) -> tuple[int, int]:
        return (self.n_rows, self.n_cols)


def make_grid(bounds: tuple[float, float, float, float], cell_size_m: float) -> GridSpec:
    """Build a grid covering at most ``bounds`` = (min_lon, min_lat, max_lon, max_lat) degrees."""
    min_lon, min_lat, max_lon, max_lat = bounds
    lat_ts = (min_lat + max_lat) / 2.0
    width_m = math.radians(max_lon - min_lon) * MARS_RADIUS_M * math.cos(math.radians(lat_ts))
    height_m = math.radians(max_lat - min_lat) * MARS_RADIUS_M
    return GridSpec(
        lon0=min_lon % 360.0,
        lat_top=max_lat,
        lat_ts=lat_ts,
        cell_size_m=cell_size_m,
        n_rows=int(height_m // cell_size_m),
        n_cols=int(width_m // cell_size_m),
    )


def _wrap_deg(delta: float) -> float:
    """Wrap a longitude difference to [-180, 180)."""
    return (delta + 180.0) % 360.0 - 180.0


def to_cell(grid: GridSpec, lon: float, lat: float) -> tuple[int, int] | None:
    """Return (row, col) of the cell containing the point, or None if outside the grid."""
    x_m = (
        math.radians(_wrap_deg(lon % 360.0 - grid.lon0))
        * MARS_RADIUS_M
        * math.cos(math.radians(grid.lat_ts))
    )
    y_m = math.radians(grid.lat_top - lat) * MARS_RADIUS_M
    col = math.floor(x_m / grid.cell_size_m)
    row = math.floor(y_m / grid.cell_size_m)
    if 0 <= row < grid.n_rows and 0 <= col < grid.n_cols:
        return (row, col)
    return None


def to_lonlat(grid: GridSpec, row: float, col: float) -> tuple[float, float]:
    """Return (lon, lat) in degrees of the center of cell (row, col)."""
    x_m = (col + 0.5) * grid.cell_size_m
    y_m = (row + 0.5) * grid.cell_size_m
    lon = grid.lon0 + math.degrees(x_m / (MARS_RADIUS_M * math.cos(math.radians(grid.lat_ts))))
    lat = grid.lat_top - math.degrees(y_m / MARS_RADIUS_M)
    return (lon % 360.0, lat)


def bounds(grid: GridSpec) -> tuple[float, float, float, float]:
    """Return (min_lon, min_lat, max_lon, max_lat) of the grid extent in degrees."""
    width_m = grid.n_cols * grid.cell_size_m
    height_m = grid.n_rows * grid.cell_size_m
    max_lon = grid.lon0 + math.degrees(
        width_m / (MARS_RADIUS_M * math.cos(math.radians(grid.lat_ts)))
    )
    min_lat = grid.lat_top - math.degrees(height_m / MARS_RADIUS_M)
    return (grid.lon0, min_lat, max_lon % 360.0, grid.lat_top)


def polyline_to_cells(
    grid: GridSpec, coords: list[tuple[float, float]] | list[list[float]]
) -> list[tuple[int, int]]:
    """Return the 8-connected chain of grid cells that a [lon, lat] polyline passes through.

    Points outside the grid are skipped; consecutive cells are joined with a straight
    raster line, so the result can be measured like a planned path.
    """
    cells: list[tuple[int, int]] = []
    for point in coords:
        cell = to_cell(grid, point[0], point[1])
        if cell is None:
            continue
        if not cells:
            cells.append(cell)
            continue
        (r0, c0), (r1, c1) = cells[-1], cell
        steps = max(abs(r1 - r0), abs(c1 - c0))
        for k in range(1, steps + 1):
            cells.append((r0 + round((r1 - r0) * k / steps), c0 + round((c1 - c0) * k / steps)))
    return cells
