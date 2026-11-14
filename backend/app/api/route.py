from fastapi import APIRouter

from app.schemas import RouteRequest, RouteResponse
from app.stubs.loader import load_stub

router = APIRouter()


@router.post("/route", response_model=RouteResponse)
def post_route(request: RouteRequest) -> RouteResponse:
    """Return the contract example route (stub until the engine exists)."""
    return RouteResponse.model_validate(load_stub("route"))
