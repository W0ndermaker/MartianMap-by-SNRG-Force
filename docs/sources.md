# Sources and References

Every external resource used in the project: data, libraries, formulas, images, fonts. Required by the NASA Space Apps submission rules ("References" field). Add a line the moment you start using something.

Format: `- Name — what we used it for — link — license (if known)`

## NASA data

- Mars MSL Gale Merged DEM 1m (HRSC, CTX and HiRISE DEMs tied to MOLA) — elevation map of the working area, resampled to 10 m — https://astrogeology.usgs.gov/search/map/mars_msl_gale_merged_dem_1m — USGS Astrogeology, public domain
- Mars Trek WMTS, MRO HiRISE Curiosity roving site mosaic — base imagery (z16, ~0.6 m/px) — https://trek.nasa.gov/tiles/Mars/EQ/curiosity_hirise_mosaic — NASA/JPL/University of Arizona; public domain, no copyright restriction, credit "Image: NASA/JPL/University of Arizona" (HiRISE image usage policy, https://uahirise.org/media/usage.php)
- Mars Trek WMTS, MRO CTX Curiosity roving site mosaic — base imagery (z10) — https://trek.nasa.gov/tiles/Mars/EQ/curiosity_ctx_mosaic — NASA/JPL/MSSS
- Mars Trek WMTS, Viking MDIM 2.1 global colour mosaic 232 m — true-colour global base imagery — https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m — NASA/JPL/USGS
- Mars Trek WMTS, MGS MOLA colour hillshade 463 m — optional shaded-relief layer — https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m — NASA/JPL/GSFC
- Mars Trek WMTS, Mars Odyssey THEMIS day IR 100 m — thermal layer — https://trek.nasa.gov/tiles/Mars/EQ/THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018 — NASA/JPL/ASU
- Mars Trek WMTS, USGS SIM 3292 global geologic map (Tanaka et al., 2014) — geology layer — https://trek.nasa.gov/mars/trekarcgis/rest/services/SIM3292_Global_Geology/MapServer/WMTS — USGS; USGS-authored data are in the U.S. public domain, credit requested (USGS copyrights and credits, https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits)
- USGS MSL Gale DEM mosaic 1 m v3 (HiRISE stereo) — 3D terrain, elevation and slope layers and the offline demo routes (read remotely from the 8 m overview, averaged to ~10 m) — https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars/MSL/MSL_Gale_DEM_Mosaic_1m_v3.tif — USGS Astrogeology, public domain (product page: https://astrogeology.usgs.gov/search/map/mars_msl_gale_merged_dem_1m)
- USGS Mars HRSC-MOLA blended DEM global 200 m v2 — terrain around the HiRISE area — https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars/HRSC_MOLA_Blend/Mars_HRSC_MOLA_BlendDEM_Global_200mp_v2.tif — USGS Astrogeology; NASA (MOLA), ESA/DLR/FU Berlin (HRSC)
- Curiosity REMS daily weather summary (air temperature, pressure, UV) — conditions panel, `data/conditions.json` — https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json — NASA/JPL-Caltech, data processed by Centro de Astrobiología (CAB), outreach use
- Curiosity RAD mean surface dose equivalent rate, 0.64 mSv/day — radiation value per sol — Hassler, D. M. et al. (2014), Mars' Surface Radiation Environment Measured with the Mars Science Laboratory's Curiosity Rover, Science 343, https://doi.org/10.1126/science.1244797 — n/a
- Curiosity localized waypoints (MSL MMGIS) — rover stops layer, POI coordinates — https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json — NASA/JPL-Caltech
- Curiosity drive path (MSL MMGIS) — Curiosity traverse layer, `data/curiosity_traverse.geojson` — https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_traverse.json — NASA/JPL-Caltech
- NASA EMU spacesuit fact sheet (about 8 h of EVA) — oxygen supply as EVA duration, `data/suit_params.json` — https://www.nasa.gov/reference/extravehicular-mobility-unit/ — public domain
- NASA Image and Video Library — finding POI photos — https://images.nasa.gov — NASA content is generally not subject to U.S. copyright; NASA credited as the source (NASA Images and Media Usage Guidelines, https://www.nasa.gov/nasa-brand-center/images-and-media/)

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
- GDAL (bundled with Rasterio) — reading and warping the elevation GeoTIFF — https://gdal.org — MIT

### Frontend

- React 19 — user interface — https://react.dev — MIT
- Vite 6 — dev server and build — https://vite.dev — MIT
- TypeScript — typed code — https://www.typescriptlang.org — Apache-2.0
- Tailwind CSS 4 — styling — https://tailwindcss.com — MIT
- Recharts 2 — elevation profile chart — https://recharts.org — MIT
- Zustand 5 — shared app state — https://zustand.docs.pmnd.rs — MIT
- ESLint, typescript-eslint — linting — https://eslint.org — MIT
- CesiumJS 1.147 — 3D globe, terrain, imagery layers — https://cesium.com/platform/cesiumjs/ — Apache-2.0
- Web Speech API (SpeechSynthesis, built into the browser) — EVA Copilot voice messages — https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API — browser feature, no library
- Cesium Mars (Cesium ion asset 3644333, optional, only with a user token) — alternative global 3D terrain — https://cesium.com/platform/cesium-ion/content/cesium-mars/ — Cesium ion terms of service

## Methods and formulas

- NASA Office of Inspector General, "NASA's Management and Development of Spacesuits", IG-17-018 (2017) — EMU oxygen for up to 7 hours (the suit supply used by the planner: 420 min) and the 30-minute secondary oxygen pack (the emergency reserve in the verdict and the Copilot); 8 hours per EVA is for the next-generation xEMU — https://oig.nasa.gov/docs/IG-17-018.pdf — U.S. Government work
- Scoville, Z., "Human Spaceflight Operations: Extra-Vehicular Activity", NASA (NTRS 20150006014) — EMU primary life support "~7 to 8 hours", secondary oxygen package "minimum of 30 minutes" — https://ntrs.nasa.gov/citations/20150006014 — U.S. Government work
- Least-cost travel time from the base to every cell (scikit-image MCP_Geometric) and contour rings (skimage.measure.find_contours) — walk-back rings — https://scikit-image.org — BSD-3-Clause
- EVA Copilot oxygen rate: least-squares slope of tank readings over the last 10 minutes; tank pressure proportional to the amount of gas (ideal gas at constant temperature) — n/a

- Tobler's hiking function — walking speed vs slope (ASSUMPTION: Earth-based, used as an approximation for Mars EVA) — Tobler, W. (1993), Three presentations on geographical analysis and modeling — n/a
- Any-angle path smoothing ("string pulling") — straightens the 8-connected grid path only where every crossed cell is passable and the straight segment is not slower — standard post-processing for grid path planning — n/a
- Terrain roughness = RMS of elevation minus its 3x3 mean (10 m grid) — extra route cost; weight 1 m of relief = 2x cost (ASSUMPTION, no suited-EVA source) — n/a
- Curiosity traverse as known-trafficable corridor (routes follow it like a road) — half the travel cost within 10 m of the driven path (ASSUMPTION) — https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_traverse.json — NASA/JPL-Caltech
- SciPy (ndimage filters) — roughness and corridor mask in the backend — https://scipy.org — BSD-3-Clause
- Mars equatorial radius 3,396,190 m — sphere for coordinate conversion — IAU WGCCRE report — n/a

## Images, icons, fonts

All POI photos: NASA/JPL-Caltech/MSSS, via https://images.nasa.gov (NASA Images and Media Usage Guidelines, https://www.nasa.gov/nasa-brand-center/images-and-media/):

- PIA17064 "From Glenelg to Mount Sharp" — Bradbury Landing card — https://images.nasa.gov/details/PIA17064
- PIA16763 "Curiosity Rover Self Portrait at John Klein Drilling Site" — Yellowknife Bay card — https://images.nasa.gov/details/PIA16763
- PIA18390 "Curiosity Self-Portrait at Windjana Drilling Site" — The Kimberley card — https://images.nasa.gov/details/PIA18390
- PIA19114 "Curiosity Rover at Pahrump Hills" — Pahrump Hills card — https://images.nasa.gov/details/PIA19114
- PIA20844 "Curiosity Self-Portrait at Murray Buttes" — Murray Buttes card — https://images.nasa.gov/details/PIA20844
- PIA21717 "Wide 'Vera Rubin Ridge' Ahead of Curiosity Mars Rover" — Vera Rubin Ridge card — https://images.nasa.gov/details/PIA21717
- PIA23047 "Curiosity on the Clay Unit" — Glen Torridon card — https://images.nasa.gov/details/PIA23047
- PIA24543 "Curiosity's Selfie at Mont Mercou" — Mont Mercou card — https://images.nasa.gov/details/PIA24543
- Map markers (start/goal, POI pins, hazard triangle) — 3D map markers drawn as inline SVG — n/a
- Fonts: system font stack, no external fonts. Icons: Unicode characters, no icon library.

## Use of AI tools

- Claude Code (Anthropic, model Claude Opus) — helped write the frontend scaffold, panels, state store, API client, data build scripts (`data/scripts/`) and this list. Team members reviewed and tested the result. The project concept is the team's own.
- Claude Code (Anthropic) — 3D map (`frontend/src/map/`), terrain preparation and real-terrain demo routes; reviewed and tested by the team — https://claude.com/claude-code
