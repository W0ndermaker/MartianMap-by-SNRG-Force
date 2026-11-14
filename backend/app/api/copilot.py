from functools import lru_cache

from fastapi import APIRouter

from app import datasets
from app.core import constants as c
from app.core.copilot import assess_air
from app.core.copilot_scenario import build_scenario
from app.core.geo import to_cell
from app.core.planner import plan_route
from app.deps import get_base, get_base_minutes, get_cost_factor, get_terrain
from app.schemas import CopilotAir, CopilotAssessRequest, CopilotScenario

router = APIRouter()


@router.post("/copilot/assess", response_model=CopilotAir)
def post_assess(request: CopilotAssessRequest) -> CopilotAir:
    """Air decision from tank readings and the position (walk-back time from the base grid)."""
    if len(request.times_min) != len(request.o2_pct):
        raise _length_error()
    terrain = get_terrain()
    cell = to_cell(terrain.grid, *request.position)
    minutes_to_base = float(get_base_minutes()[cell]) if cell else float("inf")
    slope = float(terrain.slope[cell]) if cell else 0.0
    return CopilotAir.model_validate(
        assess_air(request.times_min, request.o2_pct, minutes_to_base, slope)
    )


@router.get("/copilot/scenario", response_model=CopilotScenario)
def get_scenario() -> CopilotScenario:
    """Demo EVA with simulated suit telemetry: a climb, then a leak, then the walk back."""
    return _scenario()


@lru_cache(maxsize=1)
def _scenario() -> CopilotScenario:
    terrain, factor = get_terrain(), get_cost_factor()
    pois = {f.properties.id: f.geometry.coordinates for f in datasets.get_poi().features}
    start_id, goal_id = c.SIM_ROUTE
    args = (c.DEFAULT_MAX_SLOPE_DEG, c.DEFAULT_SPEED_FLAT_M_S)
    outbound = plan_route(terrain, pois[start_id], pois[goal_id], *args, cost_factor=factor)
    base = get_base()

    def plan_back(point: list[float]) -> dict:
        return plan_route(terrain, tuple(point), base, *args, cost_factor=factor)

    return CopilotScenario.model_validate(
        build_scenario(terrain, outbound, plan_back, get_base_minutes())
    )


def _length_error() -> Exception:
    from fastapi.exceptions import RequestValidationError

    return RequestValidationError(
        [
            {
                "type": "value_error",
                "loc": ("body", "o2_pct"),
                "msg": "times_min and o2_pct must have the same length",
            }
        ]
    )
