# Martian Map — SNRG Force

NASA Space Apps Challenge 2026. An EVA route planner for astronauts in Gale crater, Mars (Curiosity's area at Mount Sharp): set a start and a goal, get a walking route that avoids steep slopes, and see distance, time, oxygen use, elevation profile and surface conditions on the chosen sol.

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
.venv/bin/uvicorn app.main:app --port 8000

# Frontend (second terminal)
cd frontend && npm install && cp .env.example .env.local && npm run dev
```

The frontend works without the backend, on precomputed demo routes and bundled NASA data.

## NASA data

Curiosity REMS weather, Curiosity RAD radiation, Curiosity traverse and stops, Curiosity photos. Full list with links: `docs/sources.md`.

## Use of AI tools

- Claude Code (Anthropic) helped write the frontend (scaffold, panels, state store, API client, offline mode) and the data build scripts in `data/scripts/`. The team reviewed and tested this code.
- No AI-generated images or videos are used.
- The project idea is the team's own.
