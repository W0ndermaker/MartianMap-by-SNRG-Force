# Sources and References

Every external resource used in the project: data, libraries, formulas, images, fonts. Required by the NASA Space Apps submission rules ("References" field). Add a line the moment you start using something.

Format: `- Name — what we used it for — link — license (if known)`

## NASA data

- Mars MSL Gale Merged DEM 1m (HRSC, CTX and HiRISE DEMs tied to MOLA) — elevation map of the working area, resampled to 10 m by `backend/scripts/prepare_dem.py` — https://astrogeology.usgs.gov/search/map/mars_msl_gale_merged_dem_1m (file: https://planetarymaps.usgs.gov/mosaic/Mars/MSL/MSL_Gale_DEM_Mosaic_1m_v3.tif) — USGS Astrogeology, public domain
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
- Curiosity drive path (MSL MMGIS) — Curiosity traverse layer, `data/curiosity_traverse.geojson`, and the check of our routes against the real drives (`backend/VALIDATION.md`) — https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_traverse.json — NASA/JPL-Caltech
- NASA EMU spacesuit fact sheet (about 8 h of EVA) — background only; the planner uses 7 h (420 min) from NASA OIG IG-17-018, see Methods — https://www.nasa.gov/reference/extravehicular-mobility-unit/ — public domain
- NASA Image and Video Library — finding POI photos — https://images.nasa.gov — NASA content is generally not subject to U.S. copyright; NASA credited as the source (NASA Images and Media Usage Guidelines, https://www.nasa.gov/nasa-brand-center/images-and-media/)

## Space agency partner data

- None. ESA/DLR/FU Berlin HRSC data are included only inside the USGS HRSC-MOLA blended DEM listed above.

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
- ESLint, typescript-eslint, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals — linting — https://eslint.org, https://typescript-eslint.io — MIT
- @vitejs/plugin-react, @tailwindcss/vite — Vite plugins for React and Tailwind — https://github.com/vitejs/vite-plugin-react, https://tailwindcss.com — MIT
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
- SciPy (ndimage filters) — terrain roughness in the backend — https://scipy.org — BSD-3-Clause
- Mars equatorial radius 3,396,190 m — sphere for coordinate conversion — IAU WGCCRE report — n/a

## Images, icons, fonts

- Inter (Rasmus Andersson) — interface text — https://fonts.google.com/specimen/Inter — SIL Open Font License 1.1 (OFL)
- JetBrains Mono (JetBrains) — numbers and labels — https://fonts.google.com/specimen/JetBrains+Mono — SIL Open Font License 1.1 (OFL)
- Both fonts are loaded from Google Fonts — https://fonts.google.com

All POI photos: NASA/JPL-Caltech/MSSS, via https://images.nasa.gov (NASA Images and Media Usage Guidelines, https://www.nasa.gov/nasa-brand-center/images-and-media/):

- PIA17064 "From Glenelg to Mount Sharp" — Bradbury Landing card — https://images.nasa.gov/details/PIA17064
- PIA16763 "Curiosity Rover Self Portrait at John Klein Drilling Site" — Yellowknife Bay card — https://images.nasa.gov/details/PIA16763
- PIA18390 "Curiosity Self-Portrait at Windjana Drilling Site" — The Kimberley card — https://images.nasa.gov/details/PIA18390
- PIA19114 "Curiosity Rover at Pahrump Hills" — Pahrump Hills card — https://images.nasa.gov/details/PIA19114
- PIA20844 "Curiosity Self-Portrait at Murray Buttes" — Murray Buttes card — https://images.nasa.gov/details/PIA20844
- PIA21717 "Wide 'Vera Rubin Ridge' Ahead of Curiosity Mars Rover" — Vera Rubin Ridge card — https://images.nasa.gov/details/PIA21717
- PIA23047 "Curiosity on the Clay Unit" — Glen Torridon card — https://images.nasa.gov/details/PIA23047
- PIA24543 "Curiosity's Selfie at Mont Mercou" — Mont Mercou card — https://images.nasa.gov/details/PIA24543
- Map markers (base, start, POI pins, hazard triangle), status icons (GO / CAUTION / ALERT / UNKNOWN), speaker icon and favicon — simple shapes drawn as inline SVG in our code (`frontend/src/map/style.ts`, `frontend/src/ui/Status.tsx`, `frontend/src/panels/CopilotPanel.tsx`, `frontend/index.html`); no icon library — n/a
- Emoji 🔊 / 🔇 on the voice button — Unicode characters, drawn by the viewer's system font — n/a
- Base map, terrain and photos on the screen are only the NASA/USGS data listed above; there are no other images in the app.

## Hosting

- Render — backend hosting (`render.yaml`) — https://render.com — Render terms of service
- Vercel — frontend hosting — https://vercel.com — Vercel terms of service
- Google Fonts — font delivery — https://fonts.google.com — fonts under SIL OFL 1.1

## Use of AI tools

**No AI-generated images, video or audio are used in the app.** Every photo and map image is NASA/USGS data (listed above). Icons are simple SVG shapes written as code. The Copilot voice is the browser's built-in speech synthesis reading our fixed texts, not a generated recording.

AI was used as a coding and design assistant:

- Claude Code (Anthropic, Claude Opus models) — https://claude.com/claude-code — helped write code and documents; team members reviewed and tested the result:
  - backend: elevation map preparation, route planning, oxygen and verdict rules, walk-back rings, EVA Copilot logic and scenarios, validation against Curiosity's traverse, tests;
  - frontend: scaffold, panels, state store, API client, offline mode, 3D map (`frontend/src/map/`), UI redesign to the mock-ups;
  - data build scripts (`data/scripts/`, `backend/scripts/`), docs (`docs/`, `backend/VALIDATION.md`) and this list.
- Claude (Anthropic) — the UI mock-ups in `design/reference/` (`Main`, `TurnBack`, `Palette`) that the interface follows. They are AI-generated design drafts, including an AI-made stylised landscape drawn with SVG gradients. Each file carries a visible "AI-generated design mock-up" label. They are a design reference only and are not shown in the app.
- No AI model runs inside the app. The EVA Copilot is fixed rules written in code (`backend/app/core/copilot.py`); suit telemetry in the demo is simulated.
- The project idea, the choice of rules and data, and every decision are the team's own.
