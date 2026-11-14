"""EVA Copilot, Air module: oxygen left, real consumption rate and when to turn back.

Pure decision logic on suit telemetry (no machine-learning service, runs on board):
- oxygen left: tank pressure as a share of full pressure (ideal gas at constant temperature,
  so the amount of gas is proportional to pressure);
- actual consumption: slope of a least-squares line through the last minutes of readings;
- time to walk back: read from the walk-back grid (app.core.reach), no route search needed;
- decision: GO / CAUTION / TURN_BACK / EMERGENCY, the strictest signal wins, every message
  carries its reason and numbers.
"""

from typing import Literal

import numpy as np

from app.core import constants as c

Level = Literal["go", "caution", "turn_back", "emergency"]
_ORDER: dict[Level, int] = {"go": 0, "caution": 1, "turn_back": 2, "emergency": 3}


def planned_rate_pct_per_min() -> float:
    """Planned oxygen use: the whole supply over the rated EVA duration (% per minute)."""
    return c.O2_SUPPLY_PCT / c.EVA_MAX_DURATION_MIN


def reserve_pct() -> float:
    """Oxygen kept back for emergencies: the secondary supply time at the planned rate (%)."""
    return c.COPILOT_RESERVE_MIN * planned_rate_pct_per_min()


def consumption_rate(times_min: np.ndarray, o2_pct: np.ndarray) -> float | None:
    """Oxygen use in % per minute from the readings of the last COPILOT_RATE_WINDOW_MIN.

    Least-squares slope (positive = oxygen going down). None with fewer than two readings.
    """
    t = np.asarray(times_min, dtype=float)
    o = np.asarray(o2_pct, dtype=float)
    keep = t >= t[-1] - c.COPILOT_RATE_WINDOW_MIN
    t, o = t[keep], o[keep]
    if t.size < 2 or np.ptp(t) == 0:
        return None
    slope = np.polyfit(t, o, 1)[0]
    return float(-slope)


def assess_air(
    times_min: list[float],
    o2_pct: list[float],
    minutes_to_base: float,
    slope_deg: float,
    heading_back: bool = False,
) -> dict:
    """Decide on the Air side from tank readings and the position.

    Args:
        times_min: reading times since the EVA start, minutes, increasing.
        o2_pct: tank pressure as % of full at those times.
        minutes_to_base: walking time back to the base from the current position (inf if no way).
        slope_deg: terrain slope at the current position, degrees.
        heading_back: the astronaut is already walking back; "turn back" advice is replaced
            by the oxygen-versus-distance status of the return.

    Returns level, reasons (English), o2_remaining_pct, rate_pct_per_min, planned_rate,
    minutes_of_o2_left, minutes_to_base and turn_back_in_min (minutes until the latest
    turn-back moment if the astronaut stops moving away; None if already past).
    """
    remaining = float(o2_pct[-1])
    planned = planned_rate_pct_per_min()
    measured = consumption_rate(np.asarray(times_min), np.asarray(o2_pct))
    # No usable trend yet: assume the plan. Guard against zero or rising readings.
    rate = max(measured if measured is not None else planned, c.COPILOT_MIN_RATE_PCT_PER_MIN)
    ratio = rate / planned
    reserve = reserve_pct()
    o2_left_min = remaining / rate
    need_to_base = minutes_to_base * rate  # % of supply to walk back at the current rate
    margin = remaining - reserve - need_to_base  # % to spare after walking back with reserve
    turn_back_in = margin / rate if np.isfinite(margin) and margin > 0 else None

    level: Level = "go"
    reasons: list[str] = []

    def raise_to(new: Level, text: str) -> None:
        nonlocal level
        if _ORDER[new] > _ORDER[level]:
            level = new
        reasons.append(text)

    climbing = slope_deg >= c.COPILOT_CLIMB_SLOPE_DEG
    if not np.isfinite(minutes_to_base):
        raise_to("emergency", "No walkable way back to the base from here")
    if ratio >= c.COPILOT_LEAK_RATE_FACTOR and not climbing:
        raise_to(
            "emergency",
            f"Possible suit leak: oxygen dropping {ratio:.1f}x faster than planned on level "
            "ground. Return to base immediately",
        )
    if heading_back and np.isfinite(minutes_to_base):
        raise_to(
            "turn_back" if margin <= 0 else level,
            f"Heading back: {o2_left_min:.0f} min of oxygen left, base is "
            f"{minutes_to_base:.0f} min away",
        )
    elif np.isfinite(minutes_to_base) and margin <= 0:
        raise_to(
            "turn_back",
            f"Turn back now: {o2_left_min:.0f} min of oxygen left, base is "
            f"{minutes_to_base:.0f} min away",
        )
    if c.COPILOT_CAUTION_RATE_FACTOR <= ratio < c.COPILOT_LEAK_RATE_FACTOR or (
        ratio >= c.COPILOT_LEAK_RATE_FACTOR and climbing
    ):
        extra = (ratio - 1) * 100
        if climbing:
            text = f"You're breathing {extra:.0f} % faster than planned on this climb. Slow down"
        else:
            text = f"Oxygen use {extra:.0f} % above plan on level ground. Check the suit"
        raise_to("caution", text)
    if level == "go" and not heading_back:
        reasons.append(
            f"Oxygen {remaining:.0f} %. Enough to walk back with {margin + reserve:.0f} % left"
        )

    return {
        "level": level,
        "reasons": reasons,
        "o2_remaining_pct": round(remaining, 1),
        "rate_pct_per_min": round(rate, 3),
        "planned_rate_pct_per_min": round(planned, 3),
        "minutes_of_o2_left": round(o2_left_min, 1),
        "minutes_to_base": round(minutes_to_base, 1) if np.isfinite(minutes_to_base) else None,
        "turn_back_in_min": round(turn_back_in, 1) if turn_back_in is not None else None,
    }
