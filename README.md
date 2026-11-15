# Martian Map — EVA route planner for Gale crater

**NASA Space Apps Challenge 2026 · Challenge: "Interplanetary Survival Guide: Martian Map" · Team SNRG Force**

Martian Map plans a safe walk for an astronaut on Mars. Pick a science target in Gale crater, where the Curiosity rover works at the foot of Mount Sharp. The app then:

- lays out a walking route on a real elevation map;
- checks that the astronaut can also walk back with oxygen to spare;
- gives a clear **GO / CAUTION / NO-GO** answer.

During the walk, the **EVA Copilot** watches the oxygen use. It tells the astronaut when to slow down, and when to turn back.

## The problem

On an EVA (extravehicular activity, a walk outside in a suit), the scarcest resource is oxygen. Every step away from the base is a step that must be walked again on the way back. Today's NASA EMU suit carries oxygen for up to 7 hours, plus a 30-minute emergency supply.

A straight line on a map hides slopes a suited astronaut cannot climb. A target can be reachable and still leave too little oxygen for the way home. Martian Map answers one question before the hatch opens: *can we get there and back safely, and how much margin is left?*

## Mission goal

The planned walk starts at the crew base at Bradbury Landing and climbs into the layered rocks of Mount Sharp's foothills. It samples them in order: lake mudstones, then clay-bearing units, then sulfate-bearing units. In that order they trace how Gale crater's ancient lake stayed habitable and then dried out.

The walk must fit three limits at once: one EVA's oxygen budget, the slope a suited astronaut can walk, and the surface conditions of the sol.

## Features

- **Safe route on real terrain.** The route keeps every step within the slope limit (default 20°, adjustable from 10° to 30°) and avoids rough ground. It runs on the USGS elevation map of Gale crater, with 10 m cells.
- **Round trip and verdict.** The app plans the way back as well and adds up the oxygen for the whole EVA. The verdict is:
  - **NO-GO** if less than the 30-minute reserve would be left, if there is no way back, or on a high-risk sol;
  - **CAUTION** if less than 45 minutes would be left, if the route has steep sections, or if the sol has elevated or unknown risk;
  - **GO** otherwise.

  Every verdict lists its reasons in plain words.
- **EVA metrics.** The app shows distance, time out and back, oxygen used and left, the radiation dose for the EVA, an elevation and slope profile, and the steep sections.
- **Straight line vs safe route.** The map shows where walking straight to the target would cross slopes that are too steep, and how the route goes around them.
- **Walk-back rings.** Rings around the base show how far the astronaut can walk in 30, 60, 120 and 180 minutes. They also show the walk-back limit (195 min): the farthest point from which the astronaut can still return with the reserve.
- **Science gear switch.** With gear, the astronaut walks slower and breathes more oxygen per minute. The verdict and the reserve are counted at that higher rate.
- **Surface conditions per sol.** For the chosen sol, the app shows Curiosity REMS weather (temperature, pressure, UV) and RAD radiation. These feed a risk level, which is part of the verdict.
- **EVA Copilot.** The Copilot replays an EVA on your route with simulated suit telemetry. It compares the real oxygen use with the plan and explains its decisions out loud with the browser's speech synthesis: "slow down", "turn back now", "possible suit leak". Two demos ship with the app:
  - **Turn back:** a walk past the walk-back limit. The Copilot calls the turn at 3 h 26 min, and the astronaut reaches the base with 9 % oxygen (40 min), above the 30-minute reserve.
  - **Suit leak:** an emergency return after a leak on the way out. The astronaut reaches the base with 34 % oxygen.
- **Works without the server.** If the backend is asleep or unreachable, the app switches to an offline mode with precomputed routes and bundled NASA data. The screen says "Offline demo", and a verdict is never shown as green when the connection is lost.
- **3D map.** A CesiumJS globe shows the terrain with NASA Mars Trek imagery (HiRISE, CTX, Viking, THEMIS) and a geology layer. A flyover follows the route.

## How it works

| Step | What happens | Where |
| --- | --- | --- |
| Elevation map | The USGS MSL Gale Merged DEM (1 m) is cropped to the working area and averaged to 10 m cells, giving 1304 × 945 cells. Slope is computed for every cell. | `backend/scripts/prepare_dem.py`, `backend/app/core/terrain.py` |
| Route | Least-cost path on the grid. Cells steeper than the limit are impassable. Cost is walking time (Tobler's hiking function), plus a penalty for rough ground. The path is then straightened where that is safe. | `backend/app/core/pathfinding.py`, `costs.py`, `planner.py` |
| Oxygen | Oxygen is counted as a share of the 420-minute EMU supply, used over walking time. The 30-minute reserve must be left after the way back. | `backend/app/core/oxygen.py`, `eva.py` |
| Verdict | The verdict combines oxygen out and back, steep sections and the sol's risk level. | `backend/app/core/verdict.py`, `docs/risk_rule.md` |
| Copilot | The Copilot estimates the oxygen rate from the last 10 minutes of tank readings and compares it with the plan. It compares the oxygen left with the time back to base on a real route. These are fixed rules, with no AI model. | `backend/app/core/copilot.py`, `copilot_scenario.py` |

Every physical number lives in `backend/app/core/constants.py` with its source, or is marked `ASSUMPTION`.

## Validation

We checked the map and the routes against Curiosity's own record (`backend/VALIDATION.md`):

- **Elevation map.** At 11,735 points along Curiosity's traverse, our elevation map agrees with the rover's record to a median of 0.08 m (95 % within 0.92 m).
- **Straight lines vs routes.** For the 28 pairs of points of interest, the straight line crosses slopes above 20° in 17 pairs (up to 33.5°). Our route is found for all 28 pairs and stays within the limit (max 19.8°).
- **Real drives.** Curiosity's real drives between the points are walkable under the 20° limit for 98.9–100 % of their length.

## Limitations

- These are planning estimates, not a safety certification. Hazards are judged from slope and roughness on a 10 m grid; rocks and sand are not modelled.
- Walking speed (Tobler's hiking function) and oxygen use per minute of walking are Earth-based approximations.
- Weather comes from the REMS daily summary published for outreach; the calibrated data is in the NASA PDS. Conditions are historical, not live. Radiation is the RAD mission average and is the same on every sol. Dust opacity is not available.
- Suit telemetry in the Copilot is simulated; there are no real suit sensors in this project.
- Without the server, the app shows only the precomputed demo routes.

## NASA data used

| Data | Used for |
| --- | --- |
| USGS MSL Gale Merged DEM 1 m (HiRISE, CTX, HRSC tied to MOLA) | Elevation, slope, routes, 3D terrain |
| USGS HRSC-MOLA blended DEM 200 m | 3D terrain around the working area |
| NASA Mars Trek: MRO HiRISE and CTX mosaics, Viking MDIM 2.1, THEMIS day IR, MOLA hillshade, USGS SIM 3292 geologic map | Map imagery and layers |
| Curiosity REMS daily weather (NASA/JPL-Caltech, CAB) | Surface conditions and risk per sol |
| Curiosity RAD dose rate (Hassler et al., 2014) | Radiation and EVA dose |
| Curiosity traverse and waypoints (MSL MMGIS) | Rover path layer, points of interest, validation |
| NASA Image and Video Library (PIA photos) | Photos of the science targets |
| NASA OIG IG-17-018, NASA NTRS 20150006014 | EMU oxygen supply (7 h) and the 30-minute reserve |

All sources, libraries, fonts and licenses, with links: [`docs/sources.md`](docs/sources.md).

## Repository

| Folder | Contents |
| --- | --- |
| `frontend/` | React 19 + Vite + TypeScript + Tailwind CSS app: CesiumJS 3D map, planning panel, EVA Copilot, offline mode ([`frontend/README.md`](frontend/README.md)) |
| `backend/` | FastAPI service: route planning, verdict, conditions, points of interest, Copilot; tests and data scripts |
| `data/` | Data files built from NASA sources (conditions, points of interest, traverse, offline routes and Copilot scenarios), with build scripts in `data/scripts/` |
| `docs/` | API contract, sources and licenses, risk rule |
| `design/reference/` | UI mock-ups (AI-generated, labelled), design reference only |
| `render.yaml` | Render blueprint for the backend |

API: `POST /api/route`, `GET /api/conditions?sol=N`, `GET /api/poi`, `GET /api/health`, `POST /api/copilot/assess`, `GET /api/copilot/scenario`. The formats are in [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md).

## Run locally

Requirements: Python 3.11+ (3.12 on the server), Node.js 20+, and internet access once, to download the elevation map.

```bash
# Backend: http://localhost:8000
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python scripts/prepare_dem.py                 # real elevation map, about 1 min
echo 'DEM_PATH=data_raw/gale_dem.tif' > .env
.venv/bin/uvicorn app.main:app --port 8000
```

```bash
# Frontend: http://localhost:5173 (second terminal)
cd frontend
npm install
cp .env.example .env.local    # VITE_API_URL=http://localhost:8000; leave it empty for offline mode only
npm run dev
```

Without `DEM_PATH`, the backend starts on synthetic terrain and says so in `/api/health`.

### Checks

```bash
cd backend && .venv/bin/pytest -q && .venv/bin/ruff check . && .venv/bin/ruff format --check .
cd frontend && npx tsc -b && npx eslint . && npm run build
```

### Rebuild the data files

1. Download and build the NASA data files: `python3 data/scripts/build_data.py`. The raw files go to `data/raw/` and are not committed.
2. Rebuild the offline routes and the Copilot scenarios on the real elevation map:

   ```bash
   cd backend
   DEM_PATH=data_raw/gale_dem.tif .venv/bin/python ../data/scripts/build_demo_routes.py
   DEM_PATH=data_raw/gale_dem.tif .venv/bin/python scripts/build_copilot_scenario.py
   .venv/bin/python scripts/build_reach.py
   ```

A test fails if the offline routes were built on synthetic terrain.

## Deploy

- **Backend: Render, free plan.** `render.yaml` builds the elevation map during deploy. Set `ALLOWED_ORIGINS` to the frontend address.
- **Frontend: Vercel.** Set the root directory to `frontend`, the build command to `npm run build` and the output to `dist`. Set `VITE_API_URL` to the backend address. Keep "Include files outside the root directory" on, because the build reads `../data`.

## Team

SNRG Force, four members. The work was split into three areas:

- the 3D map;
- the route engine and backend;
- NASA data, the interface and the offline mode.

## Use of AI tools

- **Code.** Claude Code (Anthropic) helped write the frontend, the backend and the data scripts. In the frontend, that is the scaffold, panels, state store, API client, offline mode, 3D map and UI redesign. In the backend, that is elevation map preparation, route planning, the oxygen budget and verdict, walk-back rings, the EVA Copilot, the validation script and the tests. The team reviewed and tested this code.
- **Mock-ups.** The UI mock-ups in `design/reference/` were made with Claude (AI). Each one carries a visible "AI-generated design mock-up" label. They are a design reference only and are not shown in the app.
- **No AI-generated media in the app.** No AI-generated images, video or audio are used in the app. Photos and maps are NASA/USGS data, icons are simple SVG shapes written as code, and the Copilot voice is the browser's speech synthesis.
- **No AI model in the app.** The EVA Copilot is fixed rules in code.
- **Our own idea.** The project idea, the choice of data and rules, and all decisions are the team's own.

Details: [`docs/sources.md`](docs/sources.md).

## Credits

Data and images: NASA/JPL-Caltech, NASA/JPL/University of Arizona (HiRISE), NASA/JPL/MSSS, NASA/JPL-Caltech/MSSS, USGS Astrogeology, ESA/DLR/FU Berlin (HRSC), Centro de Astrobiología (REMS). This project is not endorsed by NASA.
