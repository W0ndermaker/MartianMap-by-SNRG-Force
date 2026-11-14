# Martian Map — frontend

React + Vite + TypeScript + Tailwind + Recharts.

## Run

```bash
npm install
cp .env.example .env.local   # point VITE_API_URL at the backend, or leave it empty
npm run dev                  # http://localhost:5173
```

Without a backend (or with `VITE_API_URL` empty) the app runs in **offline demo** mode: every request is answered from `../data/` (REMS conditions, points of interest, precomputed demo routes) and the header shows an `Offline demo` badge.

## Layout

| Path | What |
| --- | --- |
| `src/api/` | Contract types, API client with offline fallback |
| `src/store/` | Shared Zustand store (map and panels) |
| `src/panels/` | Conditions, EVA plan, elevation profile, POI card, layers and slope slider |
| `src/map/` | 3D map (developer A): CesiumJS scene, terrain, layers, route rendering |

`@data/*` is an alias for the repository's `data/` folder.

## Deploy (Vercel)

Root directory: `frontend`. Build command `npm run build`, output `dist`. Set `VITE_API_URL` in the project's environment variables. Keep "Include files outside the root directory" enabled: the build reads `../data`.

## 3D map (developer A)

`src/map/MapView.tsx` is the map of the app. It reads and writes the shared store (`placePoint`,
`selectPoi`, route/hazards/POI/traverse switches) and adds map-only state in `src/map/mapStore.ts`.

- CesiumJS globe on the Mars sphere; imagery from NASA Mars Trek: Viking MDIM 2.1 colour mosaic (true colour),
  CTX and HiRISE (~0.6 m/px) mosaics of the Curiosity site. HiRISE/CTX are grayscale; the optional
  "Mars colour tint" is a visualisation, not true colour.
- 3D terrain from the USGS HiRISE DEM mosaic (1 m, averaged to ~10 m) plus HRSC-MOLA 200 m around it,
  in `public/data/terrain/`. Checked against 24 Curiosity end-of-drive elevations: within ±1 m.
- Map layers: no-go zones (steeper than the max-slope slider), elevation, slope, THEMIS day IR, SIM 3292 geology,
  MOLA shaded relief. Route coloured by slope, hazard icons, POI pins, Curiosity traverse from `data/`.
- Hovering the elevation profile highlights the spot on the route. Flyover and Home view buttons.
- Demo deep links: `/?demo=<n>` (n-th pair of `data/demo_routes.json`) or `/?start=lon,lat&goal=lon,lat`;
  add `&flyover=1` to start the camera flyover once the route is ready.
- Optional `VITE_CESIUM_ION_TOKEN` enables the Cesium Mars 3D tileset mode.

`npm run dev` copies Cesium's static assets to `public/cesium/` (git-ignored). For the LAN dev setup, set
`VITE_API_URL` to the dev-server origin (for example `http://192.168.1.10:5173`): Vite proxies `/api` to
`http://localhost:8000`, so the backend's CORS list does not need the LAN address.

### Backend on real terrain

The backend loads the real Gale elevation map prepared by `backend/scripts/prepare_dem.py`
(set `DEM_PATH` in `backend/.env`, see `backend/.env.example`). `data/demo_routes.json` was regenerated on it
with `data/scripts/build_demo_routes.py` (`health.terrain` = `real`).
