# Sources and References

Every external resource used in the project: data, libraries, formulas, images, fonts. Required by the NASA Space Apps submission rules ("References" field). Add a line the moment you start using something.

Format: `- Name — what we used it for — link — license (if known)`

## NASA data

- Mars MSL Gale Merged DEM 1m (HRSC, CTX and HiRISE DEMs tied to MOLA) — elevation map of the working area, resampled to 10 m — https://astrogeology.usgs.gov/search/map/mars_msl_gale_merged_dem_1m — USGS Astrogeology, public domain

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

- 

## Methods and formulas

- Tobler's hiking function — walking speed vs slope (ASSUMPTION: Earth-based, used as an approximation for Mars EVA) — Tobler, W. (1993), Three presentations on geographical analysis and modeling — n/a
- Mars equatorial radius 3,396,190 m — sphere for coordinate conversion — IAU WGCCRE report — n/a

## Images, icons, fonts

- 

## Use of AI tools

- 
