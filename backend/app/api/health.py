from fastapi import APIRouter

from app.config import get_terrain_kind
from app.schemas import HealthResponse
from app.stubs.loader import load_stub

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def get_health() -> HealthResponse:
    """Return service health; `terrain` reflects the actual DEM state.

    TODO: bounds and cell_size_m are temporary stub values; replace them with
    the bounds and resolution of the real elevation map once it is loaded.
    """
    payload = {**load_stub("health"), "terrain": get_terrain_kind()}
    return HealthResponse.model_validate(payload)
