import os

import pytest

# Keep tests independent of a local .env: run on synthetic terrain unless a test says otherwise.
os.environ["DEM_PATH"] = "/nonexistent/dem.tif"

from app.deps import get_cost_factor, get_terrain


@pytest.fixture(autouse=True)
def _fresh_terrain_cache():
    get_terrain.cache_clear()
    get_cost_factor.cache_clear()
    yield
    get_terrain.cache_clear()
    get_cost_factor.cache_clear()
