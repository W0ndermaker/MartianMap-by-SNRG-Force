# Data report (developer C)

Answers the open question "In what form are Curiosity weather and radiation data available?" and lists the files C hands to A and B.

## What is available

| Data | Where | Form | Used as |
| --- | --- | --- | --- |
| REMS weather (daily) | NASA weather feed, data processed by CAB | JSON, one row per sol, sols 1–4995: min/max air temp, pressure, UV level. Opacity is only "Sunny" | `data/conditions.json` |
| REMS weather (full) | NASA PDS Atmospheres Node | Large per-sol tables (RDR/EDR) | Not needed for the MVP |
| RAD radiation | NASA PDS (RAD RDR) and Hassler et al., 2014 | PDS: raw particle tables, heavy to process. Paper: mean dose equivalent 0.64 mSv/day | Mission mean, 26.7 µSv/h, for every sol |
| Dust optical depth | Mastcam tau in PDS | Per-observation tables | Not yet: `dust_opacity` is `null` |
| Curiosity path and stops | MSL MMGIS map (mars.nasa.gov) | GeoJSON, lon/lat/elevation, sol for every stop | `data/curiosity_traverse.geojson`, POI coordinates |
| Photos | NASA Image and Video Library | JPEG, PIA numbers | POI cards |

## Files in `data/`

| File | Format | For |
| --- | --- | --- |
| `conditions.json` | Array of `GET /api/conditions` responses, sorted by `sol` | B: serve the item for `?sol=N` (nearest sol), latest when `sol` is missing |
| `poi.json` | `GET /api/poi` response, 8 points | B: serve as is |
| `curiosity_traverse.geojson` | FeatureCollection: `drive` LineStrings `[lon, lat, elev]` and `stop` Points with `sol` | A: map layer |
| `suit_params.json` | Value, `sourced` or `ASSUMPTION`, note, source | B: walking speed, EVA duration (oxygen), default max slope |
| `demo_routes.json` | `{health, routes: [{request, response}]}` | Frontend offline mode |

Rebuild: `python3 data/scripts/build_data.py` (downloads raw files into `data/raw/`, not committed), then `backend/.venv/bin/python data/scripts/build_demo_routes.py`. B: rerun the second script once the real elevation map is in, so offline routes match.

## Notes for the team

- **Working area vs. Curiosity today.** The current bounds `[137.30, -4.78, 137.46, -4.56]` cover Curiosity's drive up to about sol 4098. The boxwork region (sols 4600+) lies south of −4.78, outside the area. The contract example puts "Boxwork formations" at `[137.38, -4.72]`, which is really the Vera Rubin Ridge / Glen Torridon area. B: if the team wants boxwork in the demo, extend the bounds south to about −4.83.
- **Elevation.** MMGIS stop elevations are geoid-relative (about −4500 m at the landing site, −3470 m now); they should match the DEM B uses.
- **Risk rule.** See `docs/risk_rule.md`. All 10 red sols have a minimum of exactly −100 °C, which may be a sensor floor rather than a real reading.
