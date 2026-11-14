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
| `src/map/PlaceholderMap.tsx` | Temporary 2D map; developer A replaces it with the 3D scene |

`@data/*` is an alias for the repository's `data/` folder.

## Deploy (Vercel)

Root directory: `frontend`. Build command `npm run build`, output `dist`. Set `VITE_API_URL` in the project's environment variables. Keep "Include files outside the root directory" enabled: the build reads `../data`.
