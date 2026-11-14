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
