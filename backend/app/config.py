"""Environment configuration. Reads process env, falling back to a local .env file."""

import logging
import os
from pathlib import Path
from typing import Literal

logger = logging.getLogger(__name__)

ENV_FILE = Path(__file__).resolve().parent.parent / ".env"
DEFAULT_ALLOWED_ORIGINS = "http://localhost:5173"


def _read_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.is_file():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        values[key.strip()] = value.strip().strip("\"'")
    return values


def _get_setting(key: str) -> str:
    """Return a setting from the process env, then .env, else an empty string."""
    return os.environ.get(key) or _read_env_file(ENV_FILE).get(key) or ""


def get_allowed_origins() -> list[str]:
    """Return CORS origins from ALLOWED_ORIGINS (comma-separated)."""
    raw = _get_setting("ALLOWED_ORIGINS") or DEFAULT_ALLOWED_ORIGINS
    return [o.strip() for o in raw.split(",") if o.strip()]


def get_terrain_kind() -> Literal["real", "synthetic"]:
    """Report which terrain the service runs on.

    Returns "real" only if DEM_PATH is set and the file opens as a raster;
    otherwise "synthetic" (the reason is logged).
    """
    dem_path = _get_setting("DEM_PATH")
    if not dem_path:
        return "synthetic"
    try:
        import rasterio
        from rasterio.errors import RasterioError

        with rasterio.open(dem_path):
            return "real"
    except (OSError, RasterioError) as exc:
        logger.warning("DEM_PATH %r is not readable (%s); using synthetic terrain", dem_path, exc)
        return "synthetic"
