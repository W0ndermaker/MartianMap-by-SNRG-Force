"""EVA decision: round-trip oxygen budget and a Go / Caution / No-Go verdict.

No-Go: no way back, less than the emergency reserve (COPILOT_RESERVE_MIN minutes of oxygen)
left after the way back, or a red-risk sol.
Caution: less than RESERVE_CAUTION_FACTOR times the reserve left, steep sections on the way out
or back, a yellow-risk sol, or a sol without weather data (unknown risk). Otherwise Go.
The reserve rule is app.core.oxygen.reserve_state, the same one the EVA Copilot uses.
"""

import math
from typing import Literal

from app.core import constants as c
from app.core.oxygen import pct_to_minutes, reserve_state

Verdict = Literal["go", "caution", "no_go"]


def assess_eva(
    outbound: dict,
    back: dict,
    risk_level: str | None,
    sol: int | None,
    o2_rate_factor: float = 1.0,
) -> dict:
    """Combine the outbound and return routes (plan_route dicts) into the decision fields.

    ``o2_rate_factor`` is the oxygen use per minute relative to the plan (LOAD_O2_RATE_FACTOR
    with science gear): the minutes left and the reserve are counted at that rate.

    Returns return_duration_min, return_o2_used_pct, round_trip_o2_used_pct, o2_reserve_pct
    (percent of the suit supply, None without a way back), verdict and verdict_reasons
    (English, for the interface).
    """
    reasons_no_go: list[str] = []
    reasons_caution: list[str] = []
    fields: dict = {
        "return_duration_min": None,
        "return_o2_used_pct": None,
        "round_trip_o2_used_pct": None,
        "o2_reserve_pct": None,
    }

    if back.get("status") != "ok":
        reasons_no_go.append("No passable way back to the start")
    else:
        round_trip = outbound["o2_used_pct"] + back["o2_used_pct"]
        fields.update(
            return_duration_min=back["duration_min"],
            return_o2_used_pct=back["o2_used_pct"],
            round_trip_o2_used_pct=round(round_trip, 1),
            o2_reserve_pct=round(c.O2_SUPPLY_PCT - round_trip, 1),
        )
        left = c.O2_SUPPLY_PCT - round_trip
        state = reserve_state(left, o2_rate_factor)
        if round_trip > c.O2_SUPPLY_PCT:
            reasons_no_go.append(f"Round trip needs {round_trip:.0f} % of the oxygen supply")
        elif state == "below":
            reasons_no_go.append(
                f"Only {pct_to_minutes(left, o2_rate_factor):.0f} min of oxygen left after the way back, "
                f"below the {c.COPILOT_RESERVE_MIN:.0f}-min emergency reserve"
            )
        elif state == "low":
            reasons_caution.append(
                f"{pct_to_minutes(left, o2_rate_factor):.0f} min of oxygen left after the way back, close to the "
                f"{c.COPILOT_RESERVE_MIN:.0f}-min emergency reserve"
            )

    steep = len(outbound.get("hazards") or []) + len(back.get("hazards") or [])
    if steep:
        plural = "s" if steep > 1 else ""
        reasons_caution.append(f"{steep} steep section{plural} near the slope limit")

    if risk_level == "red":
        reasons_no_go.append(f"High-risk surface conditions on sol {sol}")
    elif risk_level == "yellow":
        reasons_caution.append(f"Elevated-risk surface conditions on sol {sol}")
    elif risk_level == "unknown":
        reasons_caution.append(f"No weather data for sol {sol}")

    if reasons_no_go:
        verdict: Verdict = "no_go"
        reasons = reasons_no_go + reasons_caution
    elif reasons_caution:
        verdict = "caution"
        reasons = reasons_caution
    else:
        verdict = "go"
        reasons = []
    if fields["round_trip_o2_used_pct"] is not None and verdict != "no_go":
        # Whole percents, rounded half up like the interface, so "used" + "left" = 100.
        used = math.floor(fields["round_trip_o2_used_pct"] + 0.5)
        reasons.insert(
            0,
            f"Round trip uses {used} % of the oxygen supply, {c.O2_SUPPLY_PCT - used:.0f} % left",
        )
    return {**fields, "verdict": verdict, "verdict_reasons": reasons}
