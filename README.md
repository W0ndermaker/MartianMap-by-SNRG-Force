# Martian Map — SNRG Force

NASA Space Apps Challenge 2026. An EVA route planner for astronauts in Gale crater, Mars (Curiosity's area at Mount Sharp): set a start and a goal, get a walking route that avoids steep slopes, and see distance, time, oxygen use, elevation profile and surface conditions on the chosen sol. The planner also routes the way back and gives a Go / Caution / No-Go verdict from the round-trip oxygen budget, steep sections and the sol's surface risk.

## Mission goal

Walk from the crew base at Bradbury Landing to the layered rocks of Mount Sharp's foothills and sample them in order — lake mudstones, clay-bearing and sulfate-bearing units — to trace how Gale crater's ancient lake stayed habitable and then dried out, within one EVA's oxygen budget, the slope a suited astronaut can walk, and the surface conditions of the sol.

## Limitations (stated honestly)

- Planning estimates, not a safety certification. Hazards are judged from slope and roughness on a 10 m elevation grid; rocks and sand are not modelled.
- Walking speed (Tobler's hiking function) and oxygen use (share of an 8-hour EMU supply) are Earth-based approximations.
- Weather is the REMS daily summary published for outreach (calibrated data is in the NASA PDS); conditions are historical, not live. Radiation is the RAD mission average, the same on every sol; dust opacity is not available. REMS minima of exactly −100 °C may be the sensor limit.
- Without the server, the site shows only the precomputed demo routes.
- How the elevation map and routes were checked against Curiosity's real traverse: `backend/VALIDATION.md`.

## Repository

| Folder | What |
| --- | --- |
| `frontend/` | React app: map, panels, offline demo mode — see `frontend/README.md` |
| `backend/` | FastAPI: route planning, conditions, points of interest |
| `data/` | Data files built from NASA sources, plus build scripts in `data/scripts/` |
| `docs/` | API contract, sources, risk rule, data report |

## Run locally

```bash
# Backend
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python scripts/prepare_dem.py && echo 'DEM_PATH=data_raw/gale_dem.tif' > .env  # real elevation map, ~1 min
.venv/bin/uvicorn app.main:app --port 8000

# Frontend (second terminal)
cd frontend && npm install && cp .env.example .env.local && npm run dev
```

The frontend works without the backend, on precomputed demo routes and bundled NASA data.

## NASA data

USGS MSL Gale Merged DEM (HiRISE, CTX, HRSC tied to MOLA), Mars Trek imagery (HiRISE, CTX, Viking, THEMIS, MOLA), Curiosity REMS weather, Curiosity RAD radiation, Curiosity traverse and stops, Curiosity photos. Full list with links: `docs/sources.md`.

## Use of AI tools

- Claude Code (Anthropic) helped write the frontend (scaffold, panels, state store, API client, offline mode), the data build scripts in `data/scripts/`, and the backend (elevation map preparation, route planning, EVA metrics and verdict, validation script, tests). The team reviewed and tested this code.
- No AI-generated images or videos are used.
- The project idea is the team's own.
