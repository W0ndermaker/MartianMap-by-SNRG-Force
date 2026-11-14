"""Save the EVA Copilot demo scenarios (turnback, leak) for offline use (after prepare_dem.py).

Usage (from backend/):
    .venv/bin/python scripts/build_copilot_scenario.py [--out-dir ../data]

Same engine as GET /api/copilot/scenario, so the offline file and the server agree.
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.api.copilot import get_scenario
from app.deps import get_terrain

BACKEND = Path(__file__).resolve().parent.parent


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out-dir", type=Path, default=BACKEND.parent / "data")
    args = parser.parse_args()

    if get_terrain().kind != "real":
        raise SystemExit("Real elevation map not loaded: set DEM_PATH (run prepare_dem.py first)")
    for case in ("turnback", "leak"):
        scenario = get_scenario(case).model_dump(mode="json")
        out = args.out_dir / f"copilot_scenario_{case}.json"
        out.write_text(json.dumps(scenario, separators=(",", ":")) + "\n", encoding="utf-8")
        print(f"Wrote {out} ({out.stat().st_size // 1024} KB, {len(scenario['steps'])} steps)")
        for e in scenario["events"]:
            print(f"  {e['t_min']:6.1f} min  {e['level']:<9}  {e['message']}")


if __name__ == "__main__":
    main()
