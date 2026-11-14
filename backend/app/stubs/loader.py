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
    with (STUBS_DIR / f"{name}.json").open(encoding="utf-8") as f:
        return json.load(f)
