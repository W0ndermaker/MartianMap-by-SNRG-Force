"""EVA decision: round-trip oxygen budget and a Go / Caution / No-Go verdict.

The rule uses only quantities the service already computes (oxygen share of the suit supply,
hazards on the route, the risk level of the sol); it adds no new physical thresholds.
No-Go: no way back, the round trip needs more than the whole supply, or a red-risk sol.
Caution: steep sections on the way out or back, or a yellow-risk sol. Otherwise Go.
"""

from typing import Literal

from app.core import constants as c

Verdict = Literal["go", "caution", "no_go"]


def assess_eva(outbound: dict, back: dict, risk_level: str | None, sol: int | None) -> dict:
    """Combine the outbound and return routes (plan_route dicts) into the decision fields.

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
        if round_trip > c.O2_SUPPLY_PCT:
            reasons_no_go.append(f"Round trip needs {round_trip:.0f} % of the oxygen supply")

    steep = len(outbound.get("hazards") or []) + len(back.get("hazards") or [])
    if steep:
        plural = "s" if steep > 1 else ""
        reasons_caution.append(f"{steep} steep section{plural} near the slope limit")

    if risk_level == "red":
        reasons_no_go.append(f"High-risk surface conditions on sol {sol}")
    elif risk_level == "yellow":
        reasons_caution.append(f"Elevated-risk surface conditions on sol {sol}")

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
        reasons.insert(
            0,
            f"Round trip uses {fields['round_trip_o2_used_pct']:.0f} % of the oxygen supply, "
            f"{fields['o2_reserve_pct']:.0f} % left",
        )
    return {**fields, "verdict": verdict, "verdict_reasons": reasons}
