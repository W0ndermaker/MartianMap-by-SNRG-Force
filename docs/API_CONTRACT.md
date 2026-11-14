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

## Change history

| Date | Change | Who |
| --- | --- | --- |
| 2026-11-14 | First version; added `GET /api/health` | B |
| 2026-11-14 | `reason`, `note`, `name`, `description` texts switched to English per the submission rules | B |
