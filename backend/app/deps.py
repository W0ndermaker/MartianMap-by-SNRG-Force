"""Shared application state: the terrain is built once and reused."""

import logging
from functools import lru_cache
from pathlib import Path

import numpy as np

from app.config import get_dem_path
from app.core.costs import cost_factor
from app.core.terrain import Terrain, build_synthetic_terrain, load_terrain

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_terrain() -> Terrain:
    """Return the terrain: the real elevation map from DEM_PATH, else synthetic terrain."""
    dem_path = get_dem_path()
    if dem_path and Path(dem_path).is_file():
        try:
            terrain = load_terrain(dem_path)
            logger.info("Loaded elevation map %s", dem_path)
            return terrain
        except Exception:
            logger.exception("Could not read elevation map %s; using synthetic terrain", dem_path)
    else:
        logger.warning("DEM_PATH is not set or the file is missing; using synthetic terrain")
    return build_synthetic_terrain()


TRAVERSE_FILE = Path(__file__).parent / "data" / "curiosity_traverse.geojson"


@lru_cache(maxsize=1)
def get_cost_factor() -> np.ndarray:
    """Per-cell cost multiplier for the current terrain: roughness and Curiosity's path."""
    terrain = get_terrain()
    return cost_factor(terrain.elev, terrain.grid, TRAVERSE_FILE)


@lru_cache(maxsize=1)
def get_base() -> tuple[float, float]:
    """[lon, lat] of the crew base (the point of interest of kind "base")."""
    from app import datasets

    base = next(f for f in datasets.get_poi().features if f.properties.kind == "base")
    return base.geometry.coordinates


@lru_cache(maxsize=1)
def get_base_minutes() -> np.ndarray:
    """Walk-back grid: walking minutes between the base and every cell (default slope limit)."""
    from app.core import constants as c
    from app.core.geo import to_cell
    from app.core.reach import travel_minutes

    terrain = get_terrain()
    origin = to_cell(terrain.grid, *get_base())
    if origin is None:
        return np.full(terrain.grid.shape, np.inf)
    return travel_minutes(terrain, origin, c.DEFAULT_MAX_SLOPE_DEG, c.DEFAULT_SPEED_FLAT_M_S)
