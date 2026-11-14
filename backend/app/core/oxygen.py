"""Oxygen budget shared by the route verdict and the EVA Copilot.

Oxygen is counted as a share of the suit supply (percent). The planned use is the whole supply
over the rated EVA duration; the emergency reserve is COPILOT_RESERVE_MIN minutes at that rate.
Both the route verdict and the Copilot call these functions, so they cannot disagree.
"""

from typing import Literal

from app.core import constants as c

ReserveState = Literal["ok", "low", "below"]


def planned_rate_pct_per_min() -> float:
    """Planned oxygen use: the whole supply over the rated EVA duration (% per minute)."""
    return c.O2_SUPPLY_PCT / c.EVA_MAX_DURATION_MIN


def reserve_pct() -> float:
    """Emergency reserve: COPILOT_RESERVE_MIN minutes of oxygen at the planned rate (%)."""
    return c.COPILOT_RESERVE_MIN * planned_rate_pct_per_min()


def pct_to_minutes(pct: float) -> float:
    """Minutes of walking that a share of the supply lasts at the planned rate."""
    return pct / planned_rate_pct_per_min()


def reserve_state(left_pct: float) -> ReserveState:
    """Classify the oxygen left after the way back.

    'below': less than the emergency reserve (the walk must not start);
    'low': less than RESERVE_CAUTION_FACTOR times the reserve;
    'ok': otherwise.
    """
    if left_pct < reserve_pct():
        return "below"
    if left_pct < reserve_pct() * c.RESERVE_CAUTION_FACTOR:
        return "low"
    return "ok"
