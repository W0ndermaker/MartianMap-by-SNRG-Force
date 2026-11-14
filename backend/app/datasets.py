"""Data files prepared by developer C, with a fallback to the contract stubs."""

import bisect
import logging
from functools import lru_cache
from pathlib import Path

from app.schemas import ConditionsResponse, PoiCollection
from app.stubs.loader import load_json, load_stub

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent / "data"
CONDITIONS_FILE = DATA_DIR / "conditions.json"
POI_FILE = DATA_DIR / "poi.geojson"


@lru_cache(maxsize=1)
def _conditions_by_sol() -> tuple[list[int], dict[int, ConditionsResponse]]:
    """Return (sorted sols, sol -> record) from conditions.json, or the stub when absent."""
    if CONDITIONS_FILE.is_file():
        raw = load_json(CONDITIONS_FILE)
    else:
        logger.warning("%s is missing; serving the stub conditions", CONDITIONS_FILE)
        raw = [load_stub("conditions")]
    records = {
        r["sol"]: ConditionsResponse.model_validate(_never_green_without_data(r)) for r in raw
    }
    return sorted(records), records


def _never_green_without_data(record: dict) -> dict:
    """Guard against data files built with an older rule: missing inputs are never "green".

    If the minimum temperature or the UV index is missing, a "green" level becomes "unknown"
    (docs/risk_rule.md). Known yellow and red levels are kept.
    """
    missing = record.get("temp_min_c") is None or record.get("uv_index") is None
    if record.get("risk_level") == "green" and missing:
        return {**record, "risk_level": "unknown"}
    return record


def get_conditions(sol: int | None) -> ConditionsResponse:
    """Return conditions for ``sol``, the closest sol that has data, or the latest if None.

    Some sols have no REMS summary, so the nearest available sol is returned; the ``sol``
    field of the response says which one it is.
    """
    sols, records = _conditions_by_sol()
    if sol is None:
        return records[sols[-1]]
    i = bisect.bisect_left(sols, sol)
    candidates = sols[max(i - 1, 0) : i + 1]
    return records[min(candidates, key=lambda s: abs(s - sol))]


@lru_cache(maxsize=1)
def get_poi() -> PoiCollection:
    """Return points of interest from poi.geojson, or the stub when the file is absent."""
    if POI_FILE.is_file():
        return PoiCollection.model_validate(load_json(POI_FILE))
    logger.warning("%s is missing; serving the stub points of interest", POI_FILE)
    return PoiCollection.model_validate(load_stub("poi"))
