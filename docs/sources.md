# Sources and References

Every external resource used in the project: data, libraries, formulas, images, fonts. Required by the NASA Space Apps submission rules ("References" field). Add a line the moment you start using something.

Format: `- Name — what we used it for — link — license (if known)`

## NASA data

- Curiosity REMS daily weather summary (air temperature, pressure, UV) — conditions panel, `data/conditions.json` — https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json — NASA/JPL-Caltech, data processed by Centro de Astrobiología (CAB), outreach use
- Curiosity RAD mean surface dose equivalent rate, 0.64 mSv/day — radiation value per sol — Hassler, D. M. et al. (2014), Mars' Surface Radiation Environment Measured with the Mars Science Laboratory's Curiosity Rover, Science 343, https://doi.org/10.1126/science.1244797 — n/a
- Curiosity localized waypoints (MSL MMGIS) — rover stops layer, POI coordinates — https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json — NASA/JPL-Caltech
- Curiosity drive path (MSL MMGIS) — Curiosity traverse layer, `data/curiosity_traverse.geojson` — https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_traverse.json — NASA/JPL-Caltech
- NASA EMU spacesuit fact sheet (about 8 h of EVA) — oxygen supply as EVA duration, `data/suit_params.json` — https://www.nasa.gov/reference/extravehicular-mobility-unit/ — public domain
- NASA Image and Video Library — finding POI photos — https://images.nasa.gov — NASA media guidelines

## Space agency partner data

- 

## Libraries and frameworks

### Backend

- FastAPI — HTTP API — https://fastapi.tiangolo.com — MIT
- Uvicorn — ASGI server — https://www.uvicorn.org — BSD-3-Clause
- Pydantic v2 — request/response models — https://docs.pydantic.dev — MIT
- NumPy — grid arrays, slope — https://numpy.org — BSD-3-Clause
- scikit-image (skimage.graph.route_through_array) — least-cost path on a grid — https://scikit-image.org — BSD-3-Clause
- Rasterio — reading GeoTIFF elevation maps — https://rasterio.readthedocs.io — BSD-3-Clause
- pytest, httpx, ruff — tests and linting — https://docs.pytest.org, https://www.python-httpx.org, https://docs.astral.sh/ruff — MIT

### Frontend

- React 19 — user interface — https://react.dev — MIT
- Vite 6 — dev server and build — https://vite.dev — MIT
- TypeScript — typed code — https://www.typescriptlang.org — Apache-2.0
- Tailwind CSS 4 — styling — https://tailwindcss.com — MIT
- Recharts 2 — elevation profile chart — https://recharts.org — MIT
- Zustand 5 — shared app state — https://zustand.docs.pmnd.rs — MIT
- ESLint, typescript-eslint — linting — https://eslint.org — MIT

## Methods and formulas

- Tobler's hiking function — walking speed vs slope (ASSUMPTION: Earth-based, used as an approximation for Mars EVA) — Tobler, W. (1993), Three presentations on geographical analysis and modeling — n/a
- Mars equatorial radius 3,396,190 m — sphere for coordinate conversion — IAU WGCCRE report — n/a

## Images, icons, fonts

All POI photos: NASA/JPL-Caltech/MSSS, via https://images.nasa.gov (NASA media guidelines):

- PIA17064 "From Glenelg to Mount Sharp" — Bradbury Landing card — https://images.nasa.gov/details/PIA17064
- PIA16763 "Curiosity Rover Self Portrait at John Klein Drilling Site" — Yellowknife Bay card — https://images.nasa.gov/details/PIA16763
- PIA18390 "Curiosity Self-Portrait at Windjana Drilling Site" — The Kimberley card — https://images.nasa.gov/details/PIA18390
- PIA19114 "Curiosity Rover at Pahrump Hills" — Pahrump Hills card — https://images.nasa.gov/details/PIA19114
- PIA20844 "Curiosity Self-Portrait at Murray Buttes" — Murray Buttes card — https://images.nasa.gov/details/PIA20844
- PIA21717 "Wide 'Vera Rubin Ridge' Ahead of Curiosity Mars Rover" — Vera Rubin Ridge card — https://images.nasa.gov/details/PIA21717
- PIA23047 "Curiosity on the Clay Unit" — Glen Torridon card — https://images.nasa.gov/details/PIA23047
- PIA24543 "Curiosity's Selfie at Mont Mercou" — Mont Mercou card — https://images.nasa.gov/details/PIA24543
- Fonts: system font stack, no external fonts. Icons: Unicode characters, no icon library.

## Use of AI tools

- Claude Code (Anthropic, model Claude Opus) — helped write the frontend scaffold, panels, state store, API client, data build scripts (`data/scripts/`) and this list. Team members reviewed and tested the result. The project concept is the team's own.
