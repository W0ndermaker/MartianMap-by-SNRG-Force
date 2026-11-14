# Sources and References

Every external resource used in the project: data, libraries, formulas, images, fonts. Required by the NASA Space Apps submission rules ("References" field). Add a line the moment you start using something.

Format: `- Name — what we used it for — link — license (if known)`

## NASA data

- Mars Trek WMTS, MRO HiRISE Curiosity roving site mosaic — base imagery (z16, ~0.6 m/px) — https://trek.nasa.gov/tiles/Mars/EQ/curiosity_hirise_mosaic — NASA/JPL/University of Arizona; NASA data, no copyright (assumption: NASA media guidelines)
- Mars Trek WMTS, MRO CTX Curiosity roving site mosaic — base imagery (z10) — https://trek.nasa.gov/tiles/Mars/EQ/curiosity_ctx_mosaic — NASA/JPL/MSSS
- Mars Trek WMTS, Viking MDIM 2.1 global colour mosaic 232 m — true-colour global base imagery — https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m — NASA/JPL/USGS
- Mars Trek WMTS, MGS MOLA colour hillshade 463 m — optional shaded-relief layer — https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m — NASA/JPL/GSFC
- Mars Trek WMTS, Mars Odyssey THEMIS day IR 100 m — thermal layer — https://trek.nasa.gov/tiles/Mars/EQ/THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018 — NASA/JPL/ASU
- Mars Trek WMTS, USGS SIM 3292 global geologic map (Tanaka et al., 2014) — geology layer — https://trek.nasa.gov/mars/trekarcgis/rest/services/SIM3292_Global_Geology/MapServer/WMTS — USGS, public domain (assumption)
- USGS MSL Gale DEM mosaic 1 m v3 (HiRISE stereo) — 3D terrain, elevation and slope layers, fallback routes (read remotely from the 8 m overview, averaged to ~10 m) — https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars/MSL/MSL_Gale_DEM_Mosaic_1m_v3.tif — USGS Astrogeology / NASA/JPL/University of Arizona; public domain (assumption: confirm on product page)
- USGS Mars HRSC-MOLA blended DEM global 200 m v2 — terrain around the HiRISE area — https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars/HRSC_MOLA_Blend/Mars_HRSC_MOLA_BlendDEM_Global_200mp_v2.tif — USGS Astrogeology; NASA (MOLA), ESA/DLR/FU Berlin (HRSC)
- Curiosity traverse and end-of-drive waypoints (MMGIS) — Curiosity path layer, fallback route endpoints, POIs — https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_traverse.json , https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json — NASA/JPL-Caltech
- Curiosity raw images API (Navcam, sols 944, 3601, 4098) — POI photos in the fallback data — https://mars.nasa.gov/api/v1/raw_image_items/ — NASA/JPL-Caltech

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

- CesiumJS 1.147 — 3D globe, terrain, imagery layers — https://cesium.com/platform/cesiumjs/ — Apache-2.0
- Cesium Mars (Cesium ion asset 3644333, optional, only with a user token) — alternative global 3D terrain — https://cesium.com/platform/cesium-ion/content/cesium-mars/ — Cesium ion terms of service
- React 19 — UI — https://react.dev — MIT
- Zustand 5 — shared state store — https://github.com/pmndrs/zustand — MIT
- Vite 8 — dev server and build — https://vite.dev — MIT
- Tailwind CSS 4 — styling — https://tailwindcss.com — MIT
- TypeScript — type checking — https://www.typescriptlang.org — Apache-2.0

## Methods and formulas

- Tobler's hiking function — walking speed vs slope (ASSUMPTION: Earth-based, used as an approximation for Mars EVA) — Tobler, W. (1993), Three presentations on geographical analysis and modeling — n/a
- Mars equatorial radius 3,396,190 m — sphere for coordinate conversion — IAU WGCCRE report — n/a

## Images, icons, fonts

- Map markers (start/goal, POI pins, hazard triangle) — drawn by the team as inline SVG — n/a

## Use of AI tools

- Claude Code (Anthropic) — frontend map code (`frontend/`), terrain and fallback-route data preparation; reviewed and tested by the team — https://claude.com/claude-code
