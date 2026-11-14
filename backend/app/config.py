"""Environment configuration. Reads process env, falling back to a local .env file."""

import os
from pathlib import Path

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


def get_dem_path() -> str:
    """Return DEM_PATH (prepared elevation GeoTIFF), or '' for synthetic terrain.

    A relative path is resolved against the backend folder, so scripts started from the
    repository root find the same file as the server.
    """
    raw = _get_setting("DEM_PATH")
    if not raw:
        return ""
    path = Path(raw)
    return str(path if path.is_absolute() else ENV_FILE.parent / path)
