# Validation of the route engine

How we checked that the elevation map and the routes are reasonable. All numbers come from
`scripts/validate_traverse.py` (runs in a few seconds):

```bash
cd backend
.venv/bin/python scripts/prepare_dem.py          # once: builds data_raw/gale_dem.tif
.venv/bin/python scripts/validate_traverse.py    # prints the tables below
```

Inputs: our elevation grid (USGS MSL Gale Merged DEM, 10 m cells), Curiosity's traverse
(`data/curiosity_traverse.geojson`, MSL MMGIS, NASA/JPL-Caltech) and our 8 points of interest.
Slope limit 20°, flat-ground speed 1 m/s (both assumptions, see `app/core/constants.py`).

## 1. Elevation map vs the rover's own record

Elevations stored along Curiosity's traverse compared with our grid at the same places:

| Points | Median difference | 95th percentile of absolute difference |
| --- | --- | --- |
| 11,735 | 0.08 m | 0.92 m |

The map the routes are computed on agrees with the rover's record to within a meter.

## 2. Straight line vs our route

For all 28 pairs of points of interest:

- the straight line crosses terrain steeper than 20° in **17 of 28** pairs (up to 33.5°);
- our route is found in all 28 pairs and stays within the limit (max 19.8°);
- the safe route is about as long as the straight line (median −2.2 %). The straight line is
  measured cell by cell on the 10 m grid, which adds a little length, so in practice avoiding
  steep ground costs almost no extra distance here.

Routes are taken exactly as the API serves them: the slope limit plus a penalty for rough
terrain. They do not use Curiosity's path.

## 3. Our routes vs Curiosity's real drives

The points of interest lie on the rover path in mission order, so every consecutive pair is one
real leg. The real path is placed on our grid and measured with the same model as our route.
Our route does not use the rover path, so the comparison is independent.

| Leg | Curiosity, m | Ours, m | Ratio | Ascent real / ours, m | Max slope real / ours, ° | Real path within 20° |
| --- | --- | --- | --- | --- | --- | --- |
| Bradbury Landing → Yellowknife Bay | 802 | 451 | 0.56 | 5 / 0 | 7.5 / 5.8 | 100 % |
| Yellowknife Bay → The Kimberley | 6437 | 4118 | 0.64 | 125 / 83 | 10.2 / 10.1 | 100 % |
| The Kimberley → Pahrump Hills | 3469 | 2023 | 0.58 | 69 / 44 | 8.7 / 7.1 | 100 % |
| Pahrump Hills → Murray Buttes | 4741 | 1877 | 0.40 | 169 / 64 | 17.0 / 16.4 | 100 % |
| Murray Buttes → Vera Rubin Ridge | 7196 | 2814 | 0.39 | 411 / 251 | 18.3 / 19.8 | 100 % |
| Vera Rubin Ridge → Glen Torridon | 854 | 338 | 0.40 | 33 / 21 | 12.9 / 14.0 | 100 % |
| Glen Torridon → Mont Mercou | 5041 | 1881 | 0.37 | 236 / 95 | 22.9 / 15.5 | 98.9 % |

What this shows:

- Curiosity's real path is almost entirely walkable under our 20° limit (only 1.1 % of one leg
  is steeper), so the limit matches terrain a rover actually crossed.
- Our slopes are of the same order as on the real path.
- Our routes are 36–63 % shorter. This is expected and is **not** a claim that our route is
  better: the rover stopped for science, drilled, and had the limits of a wheeled vehicle,
  while our route is the shortest walk within the slope limit.

## Limitations

- 10 m cells smooth out steps and small cliffs; roughness is estimated from the same 10 m grid; rocks and sand are not in the model.
- Walking speed (Tobler's hiking function) and oxygen use (EVA duration of the NASA EMU) are
  Earth-based approximations.
- Real path lengths are measured on our grid, so small wiggles of the rover path are smoothed.
