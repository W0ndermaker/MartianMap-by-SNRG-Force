"""The backend serves a copy of developer C's data; it must match the source in data/.

The repository-level data/ folder exists once the frontend branch is merged; until then the
test is skipped. When it fails, copy the files again:
    cp ../data/conditions.json app/data/conditions.json
    cp ../data/poi.json app/data/poi.geojson
"""

import json
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parent.parent
SOURCE = BACKEND.parent / "data"

PAIRS = [
    ("conditions.json", "conditions.json"),
    ("poi.json", "poi.geojson"),
]


@pytest.mark.parametrize(("source_name", "copy_name"), PAIRS)
def test_backend_data_matches_source(source_name, copy_name):
    source = SOURCE / source_name
    if not source.is_file():
        pytest.skip(f"{source} not found (frontend/data branch not merged)")
    copy = BACKEND / "app" / "data" / copy_name
    assert json.loads(copy.read_text(encoding="utf-8")) == json.loads(
        source.read_text(encoding="utf-8")
    ), f"{copy} differs from {source}; copy it again"
