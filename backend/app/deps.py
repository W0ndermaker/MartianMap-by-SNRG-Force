"""Shared application state: the terrain is built once and reused."""

import logging
from functools import lru_cache
from pathlib import Path

from app.config import get_dem_path
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
