"""All numeric constants with their source. ASSUMPTION marks values not yet backed by a source."""

# Equatorial radius of Mars, IAU. Source: IAU WGCCRE report (3,396,190 m).
MARS_RADIUS_M = 3_396_190.0

# Cell size of the prepared elevation map.
# ASSUMPTION: 10 m keeps the working area (SYNTHETIC_BOUNDS) near 1 million cells (CLAUDE.md
# budget); the 1 m source is averaged down. 5 m would give about 5 million cells.
CELL_SIZE_M = 10.0

# Working area of the prepared elevation map: min lon, min lat, max lon, max lat (degrees).
# Same as the contract example bounds, so frontend examples and points of interest stay inside.
DEM_BOUNDS = (137.30, -4.78, 137.46, -4.56)

# Source elevation map: USGS Astropedia "Mars MSL Gale Merged DEM 1m" (see docs/sources.md).
DEM_SOURCE_URL = "https://planetarymaps.usgs.gov/mosaic/Mars/MSL/MSL_Gale_DEM_Mosaic_1m_v3.tif"
# Source projection (from the file metadata): equirectangular on a Mars sphere,
# central meridian 0, standard parallel 0. Elevation in meters; no-data value below.
DEM_SOURCE_NODATA = -32767.0
# Index of the 8 m overview in the source file (overviews: 4, 8, 16, 32, 64, 128, 256).
DEM_SOURCE_OVERVIEW_INDEX = 1

# GeoTIFF tag names written by scripts/prepare_dem.py and read by terrain.load_terrain.
DEM_TAG_LON0 = "GRID_LON0"
DEM_TAG_LAT_TOP = "GRID_LAT_TOP"
DEM_TAG_LAT_TS = "GRID_LAT_TS"
DEM_TAG_CELL_SIZE_M = "GRID_CELL_SIZE_M"

# Curiosity landing site (Bradbury Landing), used as a sanity check of the real map.
# Approximate values from the MSL mission documentation; elevation is the order of magnitude
# stated in docs/DATA_NOTES.md.
LANDING_LON_LAT = (137.4417, -4.5895)
LANDING_ELEV_RANGE_M = (-4600.0, -4400.0)

# Synthetic terrain (development and tests only).
# ASSUMPTION: 10 m cells keep the synthetic grid near 1 million cells over these bounds
# (bounds are the temporary contract example: min lon, min lat, max lon, max lat).
SYNTHETIC_BOUNDS = (137.30, -4.78, 137.46, -4.56)
SYNTHETIC_CELL_SIZE_M = 10.0
SYNTHETIC_BASE_ELEV_M = -4490.0  # Gale crater floor level, order of magnitude from the contract
SYNTHETIC_HILL_AMPLITUDE_M = 15.0  # ASSUMPTION
SYNTHETIC_HILL_WAVELENGTH_M = 900.0  # ASSUMPTION
SYNTHETIC_RIDGE_HEIGHT_M = 400.0  # ASSUMPTION: tall enough to be impassable
SYNTHETIC_RIDGE_SIGMA_M = 60.0  # ASSUMPTION
SYNTHETIC_RIDGE_ROW_FRACTION = 0.5  # ridge position across the grid
SYNTHETIC_RIDGE_GAP_COL_FRACTION = 0.35  # position of the gap in the ridge
SYNTHETIC_RIDGE_GAP_HALF_WIDTH_M = 200.0  # ASSUMPTION

# Request defaults (API contract).
DEFAULT_MAX_SLOPE_DEG = 20.0  # ASSUMPTION (same value in developer C suit_params.json)
DEFAULT_SPEED_FLAT_M_S = 1.0  # ASSUMPTION (same value in developer C suit_params.json)

# Walking speed vs slope: Tobler's hiking function, exp(-K * |tan(s) + OFFSET|).
# ASSUMPTION: Earth-based form used as an approximation for a suited astronaut on Mars.
TOBLER_K = 3.5
TOBLER_OFFSET = 0.05

# Oxygen supply expressed as maximum EVA duration: the NASA EMU spacesuit supports about 8 hours
# of EVA (plus a reserve). Source: https://www.nasa.gov/reference/extravehicular-mobility-unit/
# (data/suit_params.json, developer C).
EVA_MAX_DURATION_MIN = 480.0

# Terrain roughness (local relief at the 10 m grid scale: ridges, scarps, knobs) adds travel cost:
# multiplier = 1 + roughness_m / ROUGHNESS_REF_M, at most ROUGHNESS_MAX_FACTOR.
# ASSUMPTION: 1 m of local relief makes walking twice as costly; no suited-EVA source yet.
ROUGHNESS_REF_M = 1.0
ROUGHNESS_MAX_FACTOR = 4.0

# Cells near Curiosity's driven path are known to be trafficable, so they cost less and routes follow
# the rover's track like a road. ASSUMPTION: half the cost within 10 m of the path (one grid cell:
# track width plus localisation error). Tuned so routes stay within 10 m of the track for >95 % of
# their length on the demo routes, instead of cutting across its bends.
TRAVERSE_BUFFER_M = 10.0
TRAVERSE_COST_FACTOR = 0.5

# ASSUMPTION: a path cell is hazardous at this fraction of the allowed maximum slope.
HAZARD_SLOPE_FRACTION = 0.8

# API contract: profile has at most this many points.
MAX_PROFILE_POINTS = 300

SECONDS_PER_MINUTE = 60.0
COORD_DECIMALS = 6
