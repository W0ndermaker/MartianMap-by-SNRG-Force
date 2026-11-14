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
