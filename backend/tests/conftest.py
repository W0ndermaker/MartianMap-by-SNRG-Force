import os

import pytest

# Keep tests independent of a local .env: run on synthetic terrain unless a test says otherwise.
os.environ["DEM_PATH"] = "/nonexistent/dem.tif"

from app.api.copilot import _scenario
from app.deps import get_base, get_base_minutes, get_cost_factor, get_terrain


@pytest.fixture(autouse=True)
def _fresh_terrain_cache():
    for cached in (get_terrain, get_cost_factor, get_base, get_base_minutes, _scenario):
        cached.cache_clear()
    yield
    for cached in (get_terrain, get_cost_factor, get_base, get_base_minutes, _scenario):
        cached.cache_clear()
