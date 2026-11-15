import math
from functools import lru_cache
from typing import Annotated, Literal

from fastapi import APIRouter, Query

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


LonLatQuery = Annotated[list[float] | None, Query(min_length=2, max_length=2)]


@router.get("/copilot/scenario", response_model=CopilotScenario)
def get_scenario(
    case: Literal["turnback", "leak"] = "turnback",
    start: LonLatQuery = None,
    goal: LonLatQuery = None,
    max_slope_deg: Annotated[float | None, Query(gt=0, le=c.MAX_SLOPE_LIMIT_DEG)] = None,
) -> CopilotScenario:
    """Demo EVA with simulated suit telemetry.

    Without ``start`` and ``goal`` (``?start=lon&start=lat&goal=lon&goal=lat``) the demo route
    is used. turnback: a walk up Mount Sharp beyond Mont Mercou, past the walk-back limit; the
    Copilot calls "Turn back now" at the point of no return (with the 30-minute reserve) and the
    astronaut walks back. leak: a suit leak on the way to Pahrump Hills; emergency return to the base.
    With ``start`` and ``goal`` the same simulation runs on the user's route, and the way back
    leads to ``start``. A route that cannot be planned gives 422 with the reason.
    """
    if (start is None) != (goal is None):
        raise _query_error("start", "start and goal must be given together")
    for name, point in (("start", start), ("goal", goal)):
        if point is not None and not all(math.isfinite(v) for v in point):
            raise _query_error(name, "Coordinates must be finite numbers")
    slope = c.DEFAULT_MAX_SLOPE_DEG if max_slope_deg is None else max_slope_deg
    points = None if start is None or goal is None else (tuple(start), tuple(goal))
    scenario = _scenario(case, points, slope)
    if isinstance(scenario, str):
        raise _query_error("goal", scenario)
    return scenario


@lru_cache(maxsize=16)
def _scenario(
    case: str,
    points: tuple[tuple[float, ...], tuple[float, ...]] | None,
    max_slope_deg: float,
) -> CopilotScenario | str:
    """The scenario, or the reason (English) why the route cannot be walked."""
    terrain, factor = get_terrain(), get_cost_factor()
    if points is None:
        pois = {f.properties.id: f.geometry.coordinates for f in datasets.get_poi().features}
        start, home = pois[c.SIM_BASE_POI], get_base()
        goal = pois[c.SIM_LEAK_GOAL_POI] if case == "leak" else c.SIM_TURNBACK_GOAL_LON_LAT
    else:
        start, goal = points
        home = start
    args = (max_slope_deg, c.DEFAULT_SPEED_FLAT_M_S)
    outbound = plan_route(terrain, start, goal, *args, cost_factor=factor)
    if outbound.get("status") != "ok":
        return outbound.get("reason") or "No passable route for the EVA"

    def plan_back(point: list[float]) -> dict:
        # The way back is planned exactly like the route verdict's way back.
        return plan_route(terrain, tuple(point), home, *args, cost_factor=factor)

    return CopilotScenario.model_validate(
        build_scenario(terrain, outbound, plan_back, get_base_minutes(), case)
    )


def _query_error(field: str, message: str) -> Exception:
    from fastapi.exceptions import RequestValidationError

    return RequestValidationError(
        [{"type": "value_error", "loc": ("query", field), "msg": message}]
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
