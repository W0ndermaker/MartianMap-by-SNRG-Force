from fastapi import APIRouter

from app.core.geo import bounds
from app.deps import get_terrain
from app.schemas import HealthResponse
from app.stubs.loader import load_stub

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def get_health() -> HealthResponse:
    """Return service health; every value comes from the loaded terrain."""
    terrain = get_terrain()
    grid = terrain.grid
    payload = {
        **load_stub("health"),
        "terrain": terrain.kind,
        "bounds": [round(v, 4) for v in bounds(grid)],
        "cell_size_m": grid.cell_size_m,
    }
    return HealthResponse.model_validate(payload)
