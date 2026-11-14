"""Build the project data files from public NASA sources.

Usage (from the repository root):
    python3 data/scripts/build_data.py            # download raw files if missing, then build
    python3 data/scripts/build_data.py --refresh  # force a fresh download

Outputs (all in data/):
    conditions.json            list of GET /api/conditions responses, one per sol
    poi.json                   GET /api/poi response (GeoJSON FeatureCollection)
    curiosity_traverse.geojson Curiosity drive path and stops inside the working area
Every source is listed in docs/sources.md; thresholds are explained in docs/risk_rule.md.
"""

import argparse
import json
import urllib.request
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent
RAW_DIR = DATA_DIR / "raw"

SOURCES = {
    # REMS daily weather summary, published by NASA (data processed by CAB, Spain).
    "rems.json": "https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json",
    # Curiosity localized waypoints and drive path from the MSL MMGIS map.
    "waypoints.json": "https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json",
    "traverse.json": "https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_traverse.json",
}

# Working area from GET /api/health: [min_lon, min_lat, max_lon, max_lat].
BOUNDS = (137.30, -4.78, 137.46, -4.56)

# RAD mean surface dose equivalent rate, 0.64 mSv/day (Hassler et al., 2014, Science 343).
# REMS has no daily radiation value, so this mission average is used for every sol.
RAD_MEAN_USV_PER_HOUR = round(640.0 / 24.0, 1)

UV_LEVELS = {
    "Low": "low",
    "Moderate": "moderate",
    "High": "high",
    "Very_High": "very_high",
}

# Risk thresholds, see docs/risk_rule.md. ASSUMPTION values are team decisions.
TEMP_MIN_YELLOW_C = -80.0  # ASSUMPTION: cold-soak stress on suit heaters
TEMP_MIN_RED_C = -100.0  # ASSUMPTION
RADIATION_YELLOW_USV_H = (
    2 * RAD_MEAN_USV_PER_HOUR
)  # ASSUMPTION: well above the RAD mean
RADIATION_RED_USV_H = (
    10 * RAD_MEAN_USV_PER_HOUR
)  # ASSUMPTION: solar particle event level
DUST_YELLOW_TAU = 1.0  # ASSUMPTION: regional dust activity
DUST_RED_TAU = 2.0  # ASSUMPTION: storm conditions (2018 global storm exceeded tau 8)
UV_YELLOW = {"very_high"}

CONDITIONS_SOURCE = (
    "Curiosity REMS (daily summary, NASA/JPL-Caltech/CAB); RAD mission mean"
)
PHOTO_CREDIT = "NASA/JPL-Caltech/MSSS"
PHOTO_URL = "https://images-assets.nasa.gov/image/{pia}/{pia}~small.jpg"

# Points of interest. Coordinates come from the Curiosity waypoint closest to `sol`.
POIS = [
    {
        "name": "Bradbury Landing",
        "kind": "base",
        "sol": 0,
        "pia": "PIA17064",
        "description": "Curiosity's landing site (August 2012) on the floor of Gale crater. "
        "Flat, well-mapped ground makes it the natural base and start point for walking EVAs.",
    },
    {
        "name": "Yellowknife Bay (John Klein drill site)",
        "kind": "science",
        "sol": 182,
        "pia": "PIA16763",
        "description": "First rock drilled on Mars. The mudstone showed that an ancient lake "
        "here could have supported microbial life: water, key elements and an energy source.",
    },
    {
        "name": "The Kimberley (Windjana)",
        "kind": "science",
        "sol": 621,
        "pia": "PIA18390",
        "description": "Sandstone outcrops where Curiosity drilled Windjana and found unusual "
        "potassium-rich minerals. Good place to study how Gale's sediments were delivered.",
    },
    {
        "name": "Pahrump Hills",
        "kind": "science",
        "sol": 753,
        "pia": "PIA19114",
        "description": "Base of Mount Sharp. Layered lake mudstones of the Murray formation record "
        "how long liquid water persisted in Gale crater.",
    },
    {
        "name": "Murray Buttes",
        "kind": "rover_stop",
        "sol": 1400,
        "pia": "PIA20844",
        "description": "Mesas capped by wind-deposited sandstone. A scenic stop that shows the "
        "dry, windy climate that followed the lake era.",
    },
    {
        "name": "Vera Rubin Ridge",
        "kind": "science",
        "sol": 2132,
        "pia": "PIA21717",
        "description": "Erosion-resistant ridge rich in hematite. Studying it explains how "
        "groundwater altered the rocks after the lake dried out.",
    },
    {
        "name": "Glen Torridon (clay-bearing unit)",
        "kind": "science",
        "sol": 2365,
        "pia": "PIA23047",
        "description": "Clay minerals detected from orbit, confirmed by Curiosity's drill. "
        "Clays preserve organic molecules well, a priority target for astronauts.",
    },
    {
        "name": "Mont Mercou",
        "kind": "science",
        "sol": 3072,
        "pia": "PIA24543",
        "description": "Cliff at the transition from clay-bearing to sulfate-bearing layers: "
        "a record of Mars changing from a wetter to a drier world.",
    },
]


def download(refresh: bool) -> None:
    RAW_DIR.mkdir(exist_ok=True)
    for name, url in SOURCES.items():
        target = RAW_DIR / name
        if target.exists() and not refresh:
            continue
        print(f"Downloading {url}")
        with urllib.request.urlopen(url, timeout=120) as response:
            target.write_bytes(response.read())


def load_raw(name: str):
    return json.loads((RAW_DIR / name).read_text(encoding="utf-8"))


def in_bounds(lon: float, lat: float) -> bool:
    return BOUNDS[0] <= lon <= BOUNDS[2] and BOUNDS[1] <= lat <= BOUNDS[3]


def to_number(value: str) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def risk_level(c: dict) -> str:
    """Return green, yellow, red or unknown.

    The worst known factor wins. Missing data is never treated as safe: if the known factors
    are all green but a REMS input the rule needs (minimum temperature or UV) is missing, the
    level is unknown.
    """

    def at_least(value, yellow, red, higher_is_worse=True):
        if value is None:
            return 0
        if not higher_is_worse:
            value, yellow, red = -value, -yellow, -red
        return 2 if value >= red else 1 if value >= yellow else 0

    score = max(
        at_least(
            c["temp_min_c"], TEMP_MIN_YELLOW_C, TEMP_MIN_RED_C, higher_is_worse=False
        ),
        at_least(
            c["radiation_usv_per_hour"], RADIATION_YELLOW_USV_H, RADIATION_RED_USV_H
        ),
        at_least(c["dust_opacity"], DUST_YELLOW_TAU, DUST_RED_TAU),
        1 if c["uv_index"] in UV_YELLOW else 0,
    )
    if score == 0 and (c["temp_min_c"] is None or c["uv_index"] is None):
        return "unknown"
    return ("green", "yellow", "red")[score]


def build_conditions() -> list[dict]:
    rows = []
    for sol in load_raw("rems.json")["soles"]:
        row = {
            "sol": int(sol["sol"]),
            "temp_min_c": to_number(sol["min_temp"]),
            "temp_max_c": to_number(sol["max_temp"]),
            "pressure_pa": to_number(sol["pressure"]),
            "uv_index": UV_LEVELS.get(sol["local_uv_irradiance_index"]),
            "radiation_usv_per_hour": RAD_MEAN_USV_PER_HOUR,
            # The REMS summary only reports "Sunny"; no optical depth value is available.
            "dust_opacity": None,
            "source": CONDITIONS_SOURCE,
        }
        row["risk_level"] = risk_level(row)
        rows.append(row)
    # The feed has a few duplicate sols; keep the first entry (latest by id).
    unique = {}
    for row in rows:
        unique.setdefault(row["sol"], row)
    return sorted(unique.values(), key=lambda r: r["sol"])


def build_poi(waypoints: list[dict]) -> dict:
    features = []
    for i, poi in enumerate(POIS, start=1):
        wp = min(waypoints, key=lambda p: abs(p["sol"] - poi["sol"]))
        lon, lat = round(wp["lon"], 6), round(wp["lat"], 6)
        if not in_bounds(lon, lat):
            raise ValueError(f"{poi['name']} is outside the working area")
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": {
                    "id": f"poi-{i:02d}",
                    "name": poi["name"],
                    "kind": poi["kind"],
                    "description": poi["description"],
                    "photo_url": PHOTO_URL.format(pia=poi["pia"]),
                    "photo_credit": f"{PHOTO_CREDIT} ({poi['pia']})",
                },
            }
        )
    return {"type": "FeatureCollection", "features": features}


def build_traverse(waypoints: list[dict]) -> dict:
    features = []
    for drive in load_raw("traverse.json")["features"]:
        geometry = drive["geometry"]
        lines = geometry["coordinates"]
        if geometry["type"] == "LineString":
            lines = [lines]
        for coords in lines:
            inside = [
                [round(x, 6), round(y, 6), round(z, 1)]
                for x, y, z in coords
                if in_bounds(x, y)
            ]
            if len(inside) < 2:
                continue
            features.append(
                {
                    "type": "Feature",
                    "geometry": {"type": "LineString", "coordinates": inside},
                    "properties": {
                        "kind": "drive",
                        "length_m": drive["properties"].get("Length"),
                    },
                }
            )
    for wp in waypoints:
        if in_bounds(wp["lon"], wp["lat"]):
            features.append(
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [round(wp["lon"], 6), round(wp["lat"], 6)],
                    },
                    "properties": {
                        "kind": "stop",
                        "sol": wp["sol"],
                        "site": wp["site"],
                    },
                }
            )
    return {"type": "FeatureCollection", "features": features}


def write_json(name: str, payload, indent=None) -> None:
    path = DATA_DIR / name
    separators = None if indent else (",", ":")
    text = json.dumps(payload, ensure_ascii=False, indent=indent, separators=separators)
    path.write_text(text + "\n", encoding="utf-8")
    print(
        f"Wrote {path.relative_to(DATA_DIR.parent)} ({path.stat().st_size // 1024} KB)"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--refresh", action="store_true", help="download raw files again"
    )
    args = parser.parse_args()
    download(args.refresh)
    waypoints = [f["properties"] for f in load_raw("waypoints.json")["features"]]
    write_json("conditions.json", build_conditions())
    write_json("poi.json", build_poi(waypoints), indent=2)
    write_json("curiosity_traverse.geojson", build_traverse(waypoints))


if __name__ == "__main__":
    main()
