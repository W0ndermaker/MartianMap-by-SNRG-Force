"""Demo scenario for the EVA Copilot: simulated suit telemetry on a real route.

There are no suit sensors in this project, so the tank readings are simulated (and labelled so
in the interface). Everything else is real: the route on the Gale elevation map, the slopes
under the astronaut's feet and the walk-back times. The story: a normal walk out, a climb
where the astronaut breathes faster, then a sudden leak; the Copilot calls it and the
astronaut walks back to the base on a route planned from that point.
"""

import itertools
import math
from collections.abc import Callable

import numpy as np

from app.core import constants as c
from app.core.copilot import assess_air, planned_rate_pct_per_min
from app.core.geo import surface_distance_m, to_cell
from app.core.terrain import Terrain


def _walker(coords: list[list[float]], speed_m_min: float) -> Callable[[float], list[float]]:
    """Position [lon, lat] after walking ``minutes`` along the polyline at a constant speed."""
    pts = [p[:2] for p in coords]
    cum = np.concatenate(
        ([0.0], np.cumsum([surface_distance_m(a, b) for a, b in itertools.pairwise(pts)]))
    )

    def at(minutes: float) -> list[float]:
        d = min(minutes * speed_m_min, cum[-1])
        i = int(np.searchsorted(cum, d, side="right")) - 1
        i = min(i, len(pts) - 2)
        seg = cum[i + 1] - cum[i]
        f = 0.0 if seg == 0 else (d - cum[i]) / seg
        return [
            pts[i][0] + f * (pts[i + 1][0] - pts[i][0]),
            pts[i][1] + f * (pts[i + 1][1] - pts[i][1]),
        ]

    at.total_m = float(cum[-1])  # type: ignore[attr-defined]
    return at


def build_scenario(
    terrain: Terrain,
    outbound: dict,
    plan_back: Callable[[list[float]], dict],
    base_minutes: np.ndarray,
) -> dict:
    """Simulate the EVA minute by minute and record the Copilot's assessment at every step.

    Args:
        terrain: the elevation map (slope under the astronaut).
        outbound: a plan_route result from the base to the target (status ok).
        plan_back: plans a route from a [lon, lat] point back to the base (plan_route dict).
        base_minutes: walk-back grid from the base (app.core.reach.travel_minutes).
    """
    planned = planned_rate_pct_per_min()
    out_speed = outbound["distance_m"] / outbound["duration_min"]  # m per minute
    walk_out = _walker(outbound["path"]["coordinates"], out_speed)
    leak_at = outbound["duration_min"] * c.SIM_LEAK_AT_FRACTION

    times: list[float] = []
    o2: list[float] = []
    steps: list[dict] = []
    events: list[dict] = []
    level_before = None
    phase = "out"
    walk = walk_out
    t_phase0 = 0.0
    turned_at = None
    back_route = None
    tank = c.O2_SUPPLY_PCT
    t = 0.0

    while True:
        pos = walk(t - t_phase0)
        cell = to_cell(terrain.grid, *pos)
        slope = float(terrain.slope[cell]) if cell else 0.0
        to_base = float(base_minutes[cell]) if cell else math.inf

        times.append(t)
        o2.append(tank)
        air = assess_air(times, o2, to_base, slope, heading_back=phase == "back")
        steps.append(
            {
                "t_min": t,
                "position": [round(pos[0], 6), round(pos[1], 6)],
                "phase": phase,
                "o2_pct": round(tank, 2),
                "slope_deg": round(slope, 1),
                "copilot": air,
            }
        )
        # Speak only when the level changes, so the voice does not repeat itself.
        if air["level"] != level_before:
            events.append({"t_min": t, "level": air["level"], "message": air["reasons"][0]})
            level_before = air["level"]

        if phase == "out" and air["level"] in ("turn_back", "emergency"):
            back_route = plan_back(pos)
            if back_route.get("status") != "ok":
                break
            phase, turned_at, t_phase0 = "back", t, t
            walk = _walker(back_route["path"]["coordinates"], out_speed)
            events.append(
                {
                    "t_min": t,
                    "level": air["level"],
                    "message": f"Rerouting to base: {back_route['distance_m'] / 1000:.1f} km, "
                    f"{back_route['duration_min']:.0f} min",
                }
            )
        done_out = phase == "out" and (t - t_phase0) * out_speed >= walk.total_m  # type: ignore[attr-defined]
        done_back = phase == "back" and (t - t_phase0) * out_speed >= walk.total_m  # type: ignore[attr-defined]
        if done_out or done_back or tank <= 0 or t > c.EVA_MAX_DURATION_MIN:
            break

        # Simulated consumption for the next minute.
        rate = planned
        if slope >= c.COPILOT_CLIMB_SLOPE_DEG:
            rate *= c.SIM_CLIMB_RATE_FACTOR
        if t >= leak_at:
            rate *= c.SIM_LEAK_RATE_FACTOR
        tank = max(tank - rate * c.SIM_STEP_MIN, 0.0)
        t += c.SIM_STEP_MIN

    if phase == "back" and tank > 0:
        events.append(
            {
                "t_min": t,
                "level": steps[-1]["copilot"]["level"],
                "message": f"Back at base with {tank:.0f} % oxygen",
            }
        )
    return {
        "note": "Simulated suit telemetry on real Gale terrain; the tank readings are not real data.",
        "outbound_path": outbound["path"],
        "return_path": back_route["path"]
        if back_route and back_route.get("status") == "ok"
        else None,
        "leak_at_min": round(leak_at, 1),
        "turned_back_at_min": turned_at,
        "arrived_back": phase == "back" and tank > 0,
        "final_o2_pct": round(tank, 1),
        "events": events,
        "steps": steps,
    }
