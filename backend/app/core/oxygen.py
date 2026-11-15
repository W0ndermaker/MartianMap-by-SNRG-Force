"""Oxygen budget shared by the route verdict and the EVA Copilot.

Oxygen is counted as a share of the suit supply (percent). The planned use is the whole supply
over the rated EVA duration; the emergency reserve is COPILOT_RESERVE_MIN minutes at that rate.
Both the route verdict and the Copilot call these functions, so they cannot disagree.
``rate_factor`` scales the use per minute (carrying science gear: LOAD_O2_RATE_FACTOR), so the
reserve is always COPILOT_RESERVE_MIN minutes at the rate the astronaut actually breathes.
"""

from typing import Literal

from app.core import constants as c

ReserveState = Literal["ok", "low", "below"]


def planned_rate_pct_per_min(rate_factor: float = 1.0) -> float:
    """Planned oxygen use: the whole supply over the rated EVA duration (% per minute)."""
    return c.O2_SUPPLY_PCT / c.EVA_MAX_DURATION_MIN * rate_factor


def reserve_pct(rate_factor: float = 1.0) -> float:
    """Emergency reserve: COPILOT_RESERVE_MIN minutes of oxygen at the planned rate (%)."""
    return c.COPILOT_RESERVE_MIN * planned_rate_pct_per_min(rate_factor)


def pct_to_minutes(pct: float, rate_factor: float = 1.0) -> float:
    """Minutes of walking that a share of the supply lasts at the planned rate."""
    return pct / planned_rate_pct_per_min(rate_factor)


def reserve_state(left_pct: float, rate_factor: float = 1.0) -> ReserveState:
    """Classify the oxygen left after the way back.

    'below': less than the emergency reserve (the walk must not start);
    'low': less than RESERVE_CAUTION_FACTOR times the reserve;
    'ok': otherwise.
    """
    reserve = reserve_pct(rate_factor)
    if left_pct < reserve:
        return "below"
    if left_pct < reserve * c.RESERVE_CAUTION_FACTOR:
        return "low"
    return "ok"
