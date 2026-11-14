# Martian Map — frontend (3D map)

3D map of the Gale crater working area for planning a Marswalk: set a Start and a Goal on the terrain,
get a route around steep slopes from the backend, see slope-coloured segments, hazards and EVA metrics.

## Run

```bash
npm install
npm run dev        # http://localhost:5173 ; /api is proxied to http://localhost:8000
npm run dev:lan    # same, reachable from other devices on the LAN (http://<your-ip>:5173)
npm run build      # production build in dist/
```

Copy `.env.example` to `.env` to configure:

- `VITE_API_BASE` — backend URL for production builds (empty = same origin / dev proxy).
- `VITE_CESIUM_ION_TOKEN` — optional. Enables the "Cesium Mars" terrain mode (global 3D tileset from Cesium ion,
  Mars Trek imagery draped on it). Without a token the map uses local terrain built from USGS data (default).

## What is on the map

| Element | Source |
| --- | --- |
| Base imagery | Mars Trek WMTS: Viking MDIM 2.1 colour mosaic (true colour, 232 m), CTX mosaic, HiRISE Curiosity site mosaic (~0.6 m/px) |
| Mars colour tint | HiRISE and CTX are grayscale; by default the browser maps gray levels to a Mars palette. Visualisation only, not true colour; toggle in Layers |
| MOLA shaded relief | Optional layer, MGS MOLA colour hillshade 463 m |
| 3D terrain | USGS MSL Gale DEM mosaic 1 m (HiRISE stereo), averaged to ~10 m; HRSC-MOLA blended DEM 200 m around it |
| Elevation / Slope layers | Rendered in the browser from the same HiRISE DEM grid |
| Thermal layer | Mars Odyssey THEMIS daytime IR mosaic (Mars Trek) |
| Geology layer | USGS SIM 3292 global geologic map (Mars Trek) |
| Curiosity path | NASA/JPL MMGIS traverse, simplified to ~1 m |
| Route, hazards, metrics | Backend `POST /api/route` (see `docs/API_CONTRACT.md`) |

Terrain check: at 24 Curiosity end-of-drive positions the terrain height differs from the rover's localized
elevation by at most ±1 m (median +0.09 m).

## Backend on real terrain (until DEM loading lands in the backend)

`backend/app/deps.py` still builds synthetic terrain, so routes ignore the real slopes. To run the unchanged
backend on the real HiRISE terrain the map shows:

```bash
uv run --no-project --python 3.12 --with-requirements ../backend/requirements.txt \
    python scripts/real_terrain_backend.py          # serves /api on http://127.0.0.1:8000
```

## Offline / fallback

If the backend is unreachable the map keeps working (required by the submission rules):

- working-area bounds fall back to the API contract values;
- POIs and **precomputed routes** come from `public/data/fallback-routes.json`. They were computed with the team
  planner (`backend/app/core`, unchanged) on the real HiRISE terrain by `scripts/precompute_routes.py`:

  ```bash
  uv run --no-project --python 3.12 --with-requirements ../backend/requirements.txt \
      python scripts/precompute_routes.py --bounds 137.30,-4.78,137.46,-4.56
  ```

- a click pair is answered with the closest precomputed route, clearly labelled "Precomputed".

Demo deep link: `/?route=<id>` opens a precomputed route; add `&flyover=1` to start the camera flyover
(ids: `landing-to-sol388`, `pahrump-to-sol1243`, `sol1503-to-sol1889`, `sol2995-to-sol3601`).

## Model assumptions shown in the UI

- Max slope default 20° and flat-ground speed 1.0 m/s are API defaults, not suit specifications.
- Route colour bands (green / yellow / red at 50% and 75% of the max-slope limit) are a display convention.
- The slope layer uses a ~20 m baseline (central differences on a 10 m grid), so boulder-scale steps are smoothed.

## Code map (`src/map/`)

- `MapView.tsx` — Cesium viewer, layers, clicks, route/hazard/POI rendering, flyover, deep links
- `MapHud.tsx` — on-map controls, legends, status, credits
- `mars.ts` — Mars sphere, coordinate helpers, Mars Trek layer definitions
- `terrain.ts` — local terrain provider from the height grids
- `demOverlays.ts` — elevation and slope overlays
- `routeGeometry.ts`, `flyover.ts` — route geometry and camera flyover
- `useBackendData.ts` — health / POI bootstrap and route requests with fallback

`src/store/appStore.ts` and `src/api/` are minimal shared stubs so the map runs on its own.

## Use of AI tools

The frontend map code in this folder (`src/`, `scripts/`, this README) and the terrain / fallback data
preparation were written with the help of Claude Code (Anthropic). The team defined the concept, the API
contract and the requirements, and reviewed and tested the result.
