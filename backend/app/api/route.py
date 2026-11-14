from fastapi import APIRouter

from app.core.planner import plan_route
from app.deps import get_terrain
from app.schemas import RouteRequest, RouteResponse

router = APIRouter()


@router.post("/route", response_model=RouteResponse)
def post_route(request: RouteRequest) -> RouteResponse:
    """Plan a route on the current terrain. Domain errors return 200 with a status."""
    result = plan_route(
        get_terrain(),
        request.start,
        request.goal,
        request.max_slope_deg,
        request.speed_flat_m_s,
    )
    return RouteResponse.model_validate(result)
