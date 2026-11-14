# API Contract — Martian Map

Shared team document. Change it only with the agreement of all three developers; record every change in the "Change history" section at the bottom.

All numbers in the examples are illustrative: they are format samples, not real data.

## General rules

- Base path: `/api`.
- Format: JSON, UTF-8.
- All strings that reach the interface (`reason`, `note`, `name`, `description`) are in English: the hackathon rules require English in all project materials.
- Coordinates: degrees, order `[longitude, latitude]`, east longitude 0–360.
- Elevation: meters relative to the reference surface of the elevation map (may be negative).
- Distances in meters, time in minutes, slope in degrees, temperature in °C, pressure in Pa.
- Domain errors are returned with code 200 and a `status` field. A malformed request returns code 422.

## 1. POST /api/route

Builds a route between two points.

### Request

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `start` | `[number, number]` | yes | Start point |
| `goal` | `[number, number]` | yes | Goal point |
| `max_slope_deg` | number | no, default 20 | Maximum slope; anything steeper is impassable |
| `speed_flat_m_s` | number | no, default 1.0 | Speed on flat ground |
| `sol` | integer | no | Sol whose surface conditions feed the verdict (nearest sol with data); without it the weather is not part of the verdict |

```json
{
  "start": [137.4417, -4.5895],
  "goal": [137.3800, -4.7200],
  "max_slope_deg": 20,
  "speed_flat_m_s": 1.0
}
```

### Response

| Field | Type | Description |
| --- | --- | --- |
| `status` | string | `ok`, `no_route` or `out_of_bounds` |
| `reason` | string | Explanation in English; only when status is not `ok` |
| `path` | GeoJSON LineString | Coordinates `[longitude, latitude, elevation]` |
| `distance_m` | number | Length of the path along the surface |
| `duration_min` | number | Travel time |
| `o2_used_pct` | number | Share of the oxygen supply, 0–100+ |
| `max_slope_deg` | number | Maximum slope along the path |
| `ascent_m` | number | Total elevation gain |
| `descent_m` | number | Total elevation loss |
| `profile` | array | Profile points, at most 300 |
| `hazards` | array | Hazardous sections |
| `return_duration_min` | number or null | Time of the way back (goal → start, planned separately) |
| `return_o2_used_pct` | number or null | Oxygen share of the way back |
| `round_trip_o2_used_pct` | number or null | Out and back together |
| `o2_reserve_pct` | number or null | 100 − round trip; negative means the supply is not enough |
| `verdict` | string | `go`, `caution` or `no_go` |
| `verdict_reasons` | array of strings | Short English reasons for the interface, most important first |

Verdict rule: `no_go` if there is no way back, less than the 30-minute emergency reserve of oxygen (at the planned rate of a 7-hour supply) is left after the way back, or the sol risk is `red`; `caution` if less than 1.5 × the reserve is left, the route out or back has hazards, or the sol risk is `yellow`; otherwise `go`. The new fields are present only when `status` is `ok`; older clients may ignore them.

`profile` element: `{"dist_m": number, "elev_m": number, "slope_deg": number}`.

`hazards` element: `{"type": string, "position": [number, number], "value": number, "note": string}`. Currently one type: `steep_slope`.

```json
{
  "path": {
    "type": "LineString",
    "coordinates": [[137.4417, -4.5895, -4490.0], [137.4410, -4.5901, -4488.5]]
  },
  "distance_m": 1840,
  "duration_min": 46,
  "o2_used_pct": 21,
  "max_slope_deg": 17.4,
  "ascent_m": 62,
  "descent_m": 18,
  "profile": [{"dist_m": 0, "elev_m": -4490.0, "slope_deg": 0.0}],
  "hazards": [
    {"type": "steep_slope", "position": [137.4301, -4.6012], "value": 17.4, "note": "Steep section, 40 m"}
  ],
  "return_duration_min": 41,
  "return_o2_used_pct": 19,
  "round_trip_o2_used_pct": 40,
  "o2_reserve_pct": 60,
  "verdict": "caution",
  "verdict_reasons": ["Round trip uses 40 % of the oxygen supply, 60 % left", "1 steep section near the slope limit"],
  "status": "ok"
}
```

When the status is not `ok`, the route fields are absent or `null`:

```json
{"status": "no_route", "reason": "No passable route at max slope 10°"}
```

## 2. GET /api/conditions?sol=N

Surface conditions on a given Martian day. Without the `sol` parameter, the latest available day is returned.

| Field | Type | Description |
| --- | --- | --- |
| `sol` | integer | Martian day of the Curiosity mission |
| `temp_min_c`, `temp_max_c` | number or null | Air temperature |
| `pressure_pa` | number or null | Pressure |
| `uv_index` | string or null | `low`, `moderate`, `high`, `very_high` |
| `radiation_usv_per_hour` | number or null | Dose rate |
| `dust_opacity` | number or null | Dust optical depth |
| `risk_level` | string | `green`, `yellow` or `red` |
| `source` | string | Data source |

```json
{
  "sol": 3000,
  "temp_min_c": -75,
  "temp_max_c": -8,
  "pressure_pa": 830,
  "uv_index": "moderate",
  "radiation_usv_per_hour": 27,
  "dust_opacity": 0.6,
  "risk_level": "green",
  "source": "Curiosity REMS / RAD"
}
```

Any measurement field may be `null`. Developer C prepares the data; the backend only serves the file.

## 3. GET /api/poi

Points of interest within the working area, as a GeoJSON FeatureCollection.

| Property | Type | Description |
| --- | --- | --- |
| `id` | string | Unique identifier |
| `name` | string | Name |
| `kind` | string | `science`, `base` or `rover_stop` |
| `description` | string | What to study here and why |
| `photo_url` | string or null | Link to a photo |
| `photo_credit` | string or null | Source credit |

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {"type": "Point", "coordinates": [137.3800, -4.7200]},
      "properties": {
        "id": "poi-01",
        "name": "Boxwork formations",
        "kind": "science",
        "description": "What to study here and why",
        "photo_url": "https://…",
        "photo_credit": "NASA/JPL-Caltech"
      }
    }
  ]
}
```

## 4. GET /api/health

Service request for checking a deployment.

```json
{"status": "ok", "terrain": "real", "bounds": [137.30, -4.78, 137.46, -4.56], "cell_size_m": 5}
```

`terrain`: `real` or `synthetic`. `bounds`: `[min longitude, min latitude, max longitude, max latitude]` of the working area; the frontend takes the bounds from here.

## 5. POST /api/copilot/assess

EVA Copilot, Air module: a decision from the suit tank readings so far and the current position.

Request: `{"position": [lon, lat], "times_min": [number], "o2_pct": [number]}` — reading times since the EVA start (minutes, increasing) and tank pressure as % of full (0–100), same length, at least one reading.

Response:

| Field | Type | Description |
| --- | --- | --- |
| `level` | string | `go`, `caution`, `turn_back` or `emergency` (the strictest signal wins) |
| `reasons` | array of strings | English messages for the panel and the voice, most important first |
| `o2_remaining_pct` | number | Last reading |
| `rate_pct_per_min` | number | Measured use: least-squares slope over the last 10 minutes |
| `planned_rate_pct_per_min` | number | Whole supply over the rated EVA duration (420 min) |
| `minutes_of_o2_left` | number | At the measured rate |
| `minutes_to_base` | number or null | Walking time back to the base from the position (null: no way back) |
| `turn_back_in_min` | number or null | Minutes until the latest turn-back moment (null: already past) |

```json
{"level": "caution", "reasons": ["You're breathing 25 % faster than planned on this climb. Slow down"], "o2_remaining_pct": 61.0, "rate_pct_per_min": 0.26, "planned_rate_pct_per_min": 0.208, "minutes_of_o2_left": 234.6, "minutes_to_base": 38.0, "turn_back_in_min": 158.4}
```

## 6. GET /api/copilot/scenario

Demo EVA for the video and the offline mode: simulated suit telemetry on a real route (base → Pahrump Hills), with the Copilot decision at every minute. Fields: `note`, `outbound_path` and `return_path` (GeoJSON LineString), `leak_at_min`, `turned_back_at_min`, `arrived_back`, `final_o2_pct`, `events` (`{t_min, level, message}` — what the voice says), `steps` (`{t_min, position, phase: "out" | "back", o2_pct, slope_deg, copilot}` with `copilot` as in section 5). The same content is saved as `data/copilot_scenario.json`.

## Static files for the map

- `data/reach_from_base.geojson` — walk-back rings from the base: one MultiLineString per ring with `properties: {kind: "ring" | "walkback", minutes, label, area_km2}`; the `walkback` ring is the farthest point from which the astronaut can still walk back with the 30-minute reserve left: (420 − 30) / 2 = 195 minutes of walking from the base. Built by `backend/scripts/build_reach.py`.
- `data/copilot_scenario.json` — see section 6. Built by `backend/scripts/build_copilot_scenario.py`.

## Change history

| Date | Change | Who |
| --- | --- | --- |
| 2026-11-14 | First version; added `GET /api/health` | B |
| 2026-11-14 | `reason`, `note`, `name`, `description` texts switched to English per the submission rules | B |
| 2026-11-14 | Optional `sol` in the route request; round trip, oxygen reserve and `verdict` / `verdict_reasons` in the route response (backward compatible). Needs A and C sign-off | B |
| 2026-11-14 | New `POST /api/copilot/assess`, `GET /api/copilot/scenario`; static files `reach_from_base.geojson`, `copilot_scenario.json` (additive). Needs A and C sign-off | B |
| 2026-11-15 | Suit supply 420 min (NASA OIG: EMU up to 7 hours); verdict NO-GO below the 30-min reserve left after the way back, CAUTION below 1.5 × reserve; walk-back ring at 195 min | B |
