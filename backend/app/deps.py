"""Shared application state: the terrain is built once and reused."""

import logging
from functools import lru_cache

from app.core.terrain import Terrain, build_synthetic_terrain

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_terrain() -> Terrain:
    """Return the terrain, building it on first use.

    TODO: load the real elevation map from DEM_PATH once scripts/prepare_dem.py exists.
    """
    logger.warning("Real elevation map loading is not implemented yet; using synthetic terrain")
    return build_synthetic_terrain()
