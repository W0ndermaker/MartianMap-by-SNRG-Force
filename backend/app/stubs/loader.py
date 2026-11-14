"""Loader for fixed stub responses copied from the API contract."""

import json
from pathlib import Path
from typing import Any

STUBS_DIR = Path(__file__).parent


def load_stub(name: str) -> Any:
    """Read ``app/stubs/<name>.json`` and return the parsed JSON.

    Args:
        name: stub file name without the ``.json`` extension.
    """
    return load_json(STUBS_DIR / f"{name}.json")


def load_json(path: Path) -> Any:
    """Read a UTF-8 JSON file and return the parsed data."""
    with path.open(encoding="utf-8") as f:
        return json.load(f)
