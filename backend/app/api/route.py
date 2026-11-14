from fastapi import APIRouter

from app import datasets
from app.core.planner import plan_route
from app.core.verdict import assess_eva
from app.deps import get_cost_factor, get_terrain
from app.schemas import RouteRequest, RouteResponse

router = APIRouter()


@router.post("/route", response_model=RouteResponse)
def post_route(request: RouteRequest) -> RouteResponse:
    """Plan a route and the way back; add the Go / Caution / No-Go verdict.

    Domain errors return 200 with a status. With ``sol`` the surface risk of that sol (nearest
    sol with data) is part of the verdict.
    """
    terrain, factor = get_terrain(), get_cost_factor()
    args = (request.max_slope_deg, request.speed_flat_m_s)
    result = plan_route(terrain, request.start, request.goal, *args, cost_factor=factor)
    if result["status"] == "ok":
        back = plan_route(terrain, request.goal, request.start, *args, cost_factor=factor)
        risk, sol = None, None
        if request.sol is not None:
            conditions = datasets.get_conditions(request.sol)
            risk, sol = conditions.risk_level, conditions.sol
        result.update(assess_eva(result, back, risk, sol))
    return RouteResponse.model_validate(result)
