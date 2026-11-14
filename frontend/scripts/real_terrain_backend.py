"""Run the team backend (unchanged) on REAL Gale terrain instead of the synthetic one.

The backend's DEM loading is still a TODO (backend/app/deps.py builds synthetic terrain). Until it lands,
this wrapper replaces get_terrain() with the USGS HiRISE height grid the map renders
(public/data/terrain/gale_fine.*), so routes follow the real slopes and /api/health reports terrain "real".

Run from the frontend folder:
  uv run --no-project --python 3.12 --with-requirements ../backend/requirements.txt \
      python scripts/real_terrain_backend.py [--bounds 137.30,-4.78,137.46,-4.56] [--cell 10] [--port 8000]
"""

import argparse
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent.parent / "backend"))

import uvicorn  # noqa: E402

from precompute_routes import DEFAULT_BOUNDS, build_real_terrain  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bounds", default=",".join(map(str, DEFAULT_BOUNDS)))
    ap.add_argument("--cell", type=float, default=10.0)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8000)
    args = ap.parse_args()
    bounds = tuple(float(v) for v in args.bounds.split(","))

    _, terrain = build_real_terrain(bounds, args.cell)

    import app.api.health as health_api
    import app.api.route as route_api
    import app.deps as deps

    def get_real_terrain():
        return terrain

    # The API modules imported get_terrain by name, so patch every reference.
    for mod in (deps, health_api, route_api):
        mod.get_terrain = get_real_terrain

    from app.main import app

    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
