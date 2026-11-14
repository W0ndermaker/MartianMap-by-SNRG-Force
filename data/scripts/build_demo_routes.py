"""Precompute demo routes for the frontend's offline mode with the backend planner.

Usage (from the repository root, with the backend virtual environment):
    backend/.venv/bin/python data/scripts/build_demo_routes.py

Writes data/demo_routes.json: {"health": HealthResponse, "routes": [{"request", "response"}]}.
The terrain is whatever the backend loads (DEM_PATH, else synthetic); "health" records it.
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.api.health import get_health
from app.api.route import post_route
from app.schemas import RouteRequest

# (start POI, goal POI, max slope) for each demo route.
DEMO_ROUTES = [
    ("poi-01", "poi-02", 20),
    ("poi-01", "poi-04", 20),
    ("poi-04", "poi-06", 15),
    ("poi-04", "poi-06", 25),
    ("poi-06", "poi-07", 20),
]
SPEED_FLAT_M_S = 1.0


def main() -> None:
    poi = json.loads((ROOT / "data" / "poi.json").read_text(encoding="utf-8"))
    coords = {
        f["properties"]["id"]: f["geometry"]["coordinates"] for f in poi["features"]
    }
    routes = []
    for start_id, goal_id, max_slope in DEMO_ROUTES:
        request = RouteRequest(
            start=coords[start_id],
            goal=coords[goal_id],
            max_slope_deg=max_slope,
            speed_flat_m_s=SPEED_FLAT_M_S,
        )
        response = post_route(request)
        print(f"{start_id} -> {goal_id} at {max_slope} deg: {response.status}")
        routes.append(
            {
                "request": request.model_dump(mode="json"),
                "response": response.model_dump(mode="json", exclude_none=True),
            }
        )
    payload = {"health": get_health().model_dump(mode="json"), "routes": routes}
    out = ROOT / "data" / "demo_routes.json"
    out.write_text(json.dumps(payload, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Wrote {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
