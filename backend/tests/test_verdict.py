import pytest

from app.core.verdict import assess_eva


def _leg(o2, hazards=0):
    return {
        "status": "ok",
        "duration_min": o2 * 4.8,
        "o2_used_pct": o2,
        "hazards": [{"note": "Steep section, 20 m"}] * hazards,
    }


def test_go_when_round_trip_fits_and_no_hazards():
    r = assess_eva(_leg(20), _leg(18), "green", 100)
    assert r["verdict"] == "go"
    assert r["round_trip_o2_used_pct"] == pytest.approx(38)
    assert r["o2_reserve_pct"] == pytest.approx(62)
    assert "62 % left" in r["verdict_reasons"][0]


def test_no_go_when_round_trip_exceeds_supply():
    r = assess_eva(_leg(60), _leg(55), None, None)
    assert r["verdict"] == "no_go"
    assert r["o2_reserve_pct"] < 0
    assert any("115 %" in x for x in r["verdict_reasons"])


def test_no_go_without_way_back():
    r = assess_eva(_leg(20), {"status": "no_route"}, None, None)
    assert r["verdict"] == "no_go"
    assert r["round_trip_o2_used_pct"] is None


def test_caution_for_hazards_or_yellow_sol():
    assert assess_eva(_leg(10, hazards=2), _leg(10), "green", 1)["verdict"] == "caution"
    assert assess_eva(_leg(10), _leg(10), "yellow", 7)["verdict"] == "caution"


def test_red_sol_is_no_go_even_for_short_walk():
    r = assess_eva(_leg(5), _leg(5), "red", 42)
    assert r["verdict"] == "no_go"
    assert "sol 42" in r["verdict_reasons"][0]


def test_reason_percentages_add_up_to_100_at_half_values():
    r = assess_eva(_leg(15.9), _leg(15.6), None, None)  # round trip 31.5
    assert "uses 32 %" in r["verdict_reasons"][0]
    assert "68 % left" in r["verdict_reasons"][0]


from app.core import constants as c
from app.core.oxygen import planned_rate_pct_per_min, reserve_pct


def test_go_is_impossible_below_the_reserve():
    """Invariant: with less than the 30-minute reserve left after the way back, never GO."""
    for tenths in range(1000):
        round_trip = tenths / 10
        left = c.O2_SUPPLY_PCT - round_trip
        r = assess_eva(_leg(round_trip / 2), _leg(round_trip / 2), "green", 1)
        if left < reserve_pct():
            assert r["verdict"] == "no_go", round_trip
        elif left < reserve_pct() * c.RESERVE_CAUTION_FACTOR:
            assert r["verdict"] == "caution", round_trip
        else:
            assert r["verdict"] == "go", round_trip


def test_reserve_is_30_minutes_of_a_7_hour_supply():
    assert c.EVA_MAX_DURATION_MIN == 420
    assert reserve_pct() == pytest.approx(30 / 420 * 100)
    assert planned_rate_pct_per_min() == pytest.approx(100 / 420)


def test_no_go_reason_names_the_reserve():
    r = assess_eva(_leg(47), _leg(47), None, None)  # 6 % left = 25 min < 30 min
    assert r["verdict"] == "no_go"
    assert "below the 30-min emergency reserve" in r["verdict_reasons"][0]


def test_copilot_and_verdict_share_the_reserve():
    from app.core import copilot

    assert copilot.reserve_pct is reserve_pct
    assert copilot.planned_rate_pct_per_min is planned_rate_pct_per_min


def test_unknown_weather_is_caution_with_reason():
    r = assess_eva(_leg(10), _leg(10), "unknown", 18)
    assert r["verdict"] == "caution"
    assert "No weather data for sol 18" in r["verdict_reasons"]


def test_reserve_with_science_gear_counts_the_higher_rate():
    # 8.5 % left: 36 min at the planned rate (caution), 29 min at 1.25x (below the reserve).
    free = assess_eva(_leg(45.75), _leg(45.75), "green", 1)
    loaded = assess_eva(_leg(45.75), _leg(45.75), "green", 1, c.LOAD_O2_RATE_FACTOR)
    assert free["verdict"] == "caution"
    assert "36 min of oxygen left" in " ".join(free["verdict_reasons"])
    assert loaded["verdict"] == "no_go"
    assert "Only 29 min of oxygen left" in loaded["verdict_reasons"][0]
