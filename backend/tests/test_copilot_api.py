from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas import CopilotAir, CopilotScenario

client = TestClient(app)
BASE = [137.441633, -4.589467]


def test_assess_returns_a_decision():
    r = client.post(
        "/api/copilot/assess",
        json={"position": BASE, "times_min": [0, 5, 10], "o2_pct": [100, 99, 98]},
    )
    assert r.status_code == 200
    assert CopilotAir.model_validate(r.json()).level in ("go", "caution", "turn_back", "emergency")


def test_assess_rejects_mismatched_or_bad_readings():
    bad = [
        {"position": BASE, "times_min": [0, 5], "o2_pct": [100]},
        {"position": BASE, "times_min": [], "o2_pct": []},
        {"position": BASE, "times_min": [0], "o2_pct": [150]},
        {"position": [999, 0], "times_min": [0], "o2_pct": [100]},
    ]
    for body in bad:
        assert client.post("/api/copilot/assess", json=body).status_code == 422


def test_scenario_is_valid_and_tells_a_story():
    r = client.get("/api/copilot/scenario")
    assert r.status_code == 200
    s = CopilotScenario.model_validate(r.json())
    assert s.steps and s.events
    assert s.steps[0].copilot.level == "go"
    assert "Simulated" in s.note
    times = [step.t_min for step in s.steps]
    assert times == sorted(times)


def test_scenario_case_is_validated():
    assert client.get("/api/copilot/scenario", params={"case": "meteor"}).status_code == 422
    for case in ("turnback", "leak"):
        r = client.get("/api/copilot/scenario", params={"case": case})
        assert r.status_code == 200
        assert r.json()["case"] == case


REAL_DEM = Path(__file__).resolve().parent.parent / "data_raw" / "gale_dem.tif"


@pytest.mark.skipif(not REAL_DEM.is_file(), reason="run scripts/prepare_dem.py first")
def test_turnback_scenario_turns_at_the_point_of_no_return_and_keeps_the_reserve(monkeypatch):
    from app.core.oxygen import reserve_pct

    monkeypatch.setenv("DEM_PATH", str(REAL_DEM))
    s = client.get("/api/copilot/scenario", params={"case": "turnback"}).json()
    turn = [e for e in s["events"] if e["level"] == "turn_back"]
    assert turn and turn[0]["message"].startswith("Turn back now")
    assert s["turned_back_at_min"] == turn[0]["t_min"]
    assert s["arrived_back"]
    assert s["final_o2_pct"] >= reserve_pct()


def test_scenario_runs_on_the_users_route():
    # Base to Yellowknife Bay: a short walk, no turn-back call; the target is reached.
    goal = [137.4575, -4.5893]
    params = {"case": "turnback", "start": BASE, "goal": goal}
    r = client.get("/api/copilot/scenario", params=params)
    assert r.status_code == 200
    s = CopilotScenario.model_validate(r.json())
    assert s.outbound_path.coordinates[0][:2] == pytest.approx(BASE, abs=1e-3)
    assert s.outbound_path.coordinates[-1][:2] == pytest.approx(goal, abs=1e-3)
    assert s.turned_back_at_min is None
    assert "Target reached" in s.events[-1].message


def test_scenario_on_a_bad_route_is_422_not_offline():
    only_start = client.get("/api/copilot/scenario", params={"start": BASE})
    assert only_start.status_code == 422
    nan = client.get("/api/copilot/scenario", params={"start": BASE, "goal": ["nan", -4.6]})
    assert nan.status_code == 422
    outside = client.get("/api/copilot/scenario", params={"start": BASE, "goal": [137.9, -4.6]})
    assert outside.status_code == 422
