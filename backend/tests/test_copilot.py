import numpy as np
import pytest

from app.core import constants as c
from app.core.copilot import assess_air, consumption_rate, planned_rate_pct_per_min, reserve_pct

P = planned_rate_pct_per_min()


def _readings(minutes: int, rate: float, start: float = 100.0):
    t = list(range(minutes + 1))
    return t, [start - rate * x for x in t]


def test_rate_is_fitted_from_recent_readings_only():
    t = np.arange(30.0)
    o2 = np.where(t < 15, 100 - 0.2 * t, 97 - 0.6 * (t - 15))
    assert consumption_rate(t, o2) == pytest.approx(0.6, rel=1e-6)


def test_go_on_plan():
    t, o2 = _readings(20, P)
    r = assess_air(t, o2, minutes_to_base=20, slope_deg=2)
    assert r["level"] == "go"
    assert r["turn_back_in_min"] > 0


def test_caution_when_breathing_faster_on_a_climb():
    t, o2 = _readings(20, P * 1.4)
    r = assess_air(t, o2, minutes_to_base=30, slope_deg=c.COPILOT_CLIMB_SLOPE_DEG + 2)
    assert r["level"] == "caution"
    assert "on this climb" in r["reasons"][0]


def test_emergency_for_fast_drop_on_level_ground():
    t, o2 = _readings(20, P * 4)
    r = assess_air(t, o2, minutes_to_base=30, slope_deg=1)
    assert r["level"] == "emergency"
    assert "leak" in r["reasons"][0]


def test_turn_back_when_oxygen_only_covers_the_way_back():
    # 40 % left, plan rate: 192 min of oxygen; base 170 min away + 30 min reserve -> turn back.
    t, o2 = _readings(10, P, start=40 + 10 * P)
    r = assess_air(t, o2, minutes_to_base=170, slope_deg=1)
    assert r["level"] == "turn_back"
    assert r["turn_back_in_min"] is None


def test_reserve_is_the_secondary_pack_time():
    assert reserve_pct() == pytest.approx(c.COPILOT_RESERVE_MIN * P)


def test_no_way_back_is_emergency():
    t, o2 = _readings(5, P)
    assert assess_air(t, o2, minutes_to_base=float("inf"), slope_deg=0)["level"] == "emergency"


def test_heading_back_replaces_turn_back_advice():
    t, o2 = _readings(10, P)
    r = assess_air(t, o2, minutes_to_base=20, slope_deg=1, heading_back=True)
    assert r["level"] == "go"
    assert r["reasons"][0].startswith("Heading back")
