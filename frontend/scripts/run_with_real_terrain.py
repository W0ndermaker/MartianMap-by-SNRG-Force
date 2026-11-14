"""Run a backend-based script with the real HiRISE terrain patched in (see real_terrain.py).

Example (from the repository root):
  uv run --no-project --python 3.12 --with-requirements backend/requirements.txt \
      python frontend/scripts/run_with_real_terrain.py data/scripts/build_demo_routes.py
"""

import runpy
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from real_terrain import DEFAULT_BOUNDS, build_real_terrain, patch_backend  # noqa: E402

if len(sys.argv) < 2:
    raise SystemExit("usage: run_with_real_terrain.py <script.py> [args...]")
_, terrain = build_real_terrain(DEFAULT_BOUNDS, 10.0)
patch_backend(terrain)
script = sys.argv[1]
sys.argv = sys.argv[1:]
runpy.run_path(script, run_name="__main__")
