from fastapi import APIRouter

from app.config import get_terrain_kind
from app.core.geo import bounds
from app.deps import get_terrain
from app.schemas import HealthResponse
from app.stubs.loader import load_stub

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def get_health() -> HealthResponse:
    """Return service health; `terrain` reflects the actual DEM state.

    Bounds and cell size come from the loaded terrain grid.
    TODO: `terrain` still comes from DEM_PATH config; once the real DEM loader exists,
    take it from the loaded Terrain.kind so it can never disagree with the grid.
    """
    grid = get_terrain().grid
    payload = {
        **load_stub("health"),
        "terrain": get_terrain_kind(),
        "bounds": [round(v, 4) for v in bounds(grid)],
        "cell_size_m": grid.cell_size_m,
    }
    return HealthResponse.model_validate(payload)
