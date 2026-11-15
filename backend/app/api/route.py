from fastapi import APIRouter

from app import datasets
from app.core import constants as c
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
    load = request.carrying_load
    speed = request.speed_flat_m_s * (c.LOAD_SPEED_FACTOR if load else 1.0)
    rate_factor = c.LOAD_O2_RATE_FACTOR if load else 1.0
    extra = {"cost_factor": factor, "o2_rate_factor": rate_factor}
    args = (request.max_slope_deg, speed)
    result = plan_route(terrain, request.start, request.goal, *args, **extra)
    if result["status"] == "ok":
        back = plan_route(terrain, request.goal, request.start, *args, **extra)
        risk, sol, dose_rate = None, None, None
        if request.sol is not None:
            conditions = datasets.get_conditions(request.sol)
            risk, sol = conditions.risk_level, conditions.sol
            dose_rate = conditions.radiation_usv_per_hour
        result.update(assess_eva(result, back, risk, sol, rate_factor))
        result["eva_dose_usv"] = eva_dose_usv(
            dose_rate, result["duration_min"], result.get("return_duration_min")
        )
    return RouteResponse.model_validate(result)


def eva_dose_usv(
    dose_rate_usv_h: float | None, out_min: float | None, back_min: float | None
) -> float | None:
    """Dose for the whole EVA: dose rate (µSv/h) times the time out and back; None without data."""
    if dose_rate_usv_h is None or out_min is None or back_min is None:
        return None
    return round(dose_rate_usv_h * (out_min + back_min) / c.MINUTES_PER_HOUR, 1)
