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

# Request limits: values outside them are rejected with 422.
# Coordinates: geometric limits (longitude may come as -180..180 or 0..360, normalized later).
LON_RANGE_DEG = (-360.0, 360.0)
LAT_RANGE_DEG = (-90.0, 90.0)
# A slope limit cannot exceed a vertical wall.
MAX_SLOPE_LIMIT_DEG = 90.0
# ASSUMPTION: plausible flat-ground walking speeds of a suited astronaut (slow walk to run).
SPEED_FLAT_RANGE_M_S = (0.1, 3.0)

# Request defaults (API contract).
DEFAULT_MAX_SLOPE_DEG = 20.0  # ASSUMPTION (same value in developer C suit_params.json)
DEFAULT_SPEED_FLAT_M_S = 1.0  # ASSUMPTION (same value in developer C suit_params.json)

# Walking speed vs slope: Tobler's hiking function, exp(-K * |tan(s) + OFFSET|).
# ASSUMPTION: Earth-based form used as an approximation for a suited astronaut on Mars.
TOBLER_K = 3.5
TOBLER_OFFSET = 0.05

# Oxygen supply expressed as maximum EVA duration (upper end of the documented range).
# The EMU primary life support provides "~7 to 8 hours" of breathing oxygen (NASA, Human
# Spaceflight Operations: EVA, NTRS 20150006014, slide 18); NASA OIG IG-17-018 gives "up to
# 7 hours" for the current EMU and 8 hours per EVA for the next-generation xEMU.
# https://ntrs.nasa.gov/citations/20150006014  https://oig.nasa.gov/docs/IG-17-018.pdf
# (same value as data/suit_params.json, developer C; the URL cited there no longer resolves).
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

# The whole oxygen supply in percent (definition of o2_used_pct, not a physical value).
O2_SUPPLY_PCT = 100.0

# ASSUMPTION: a path cell is hazardous at this fraction of the allowed maximum slope.
HAZARD_SLOPE_FRACTION = 0.8

# Reachability rings from the base (presentation steps, not physical limits). The outer ring is
# always the walk-back limit: half of EVA_MAX_DURATION_MIN, so out and back fit in the supply.
REACH_RING_MINUTES = (30.0, 60.0, 120.0, 180.0)
# Contour simplification tolerance, in grid cells (keeps the GeoJSON small for the browser).
REACH_SIMPLIFY_CELLS = 1.0
# Contour loops shorter than this many cells (about 1 km) are dropped as map-scale noise.
REACH_MIN_RING_CELLS = 100

# EVA Copilot (Air module).
# Emergency oxygen kept back: the EMU secondary oxygen pack holds 30 minutes of oxygen
# (NASA OIG IG-17-018, p. 9; NTRS 20150006014, slide 18: "minimum of 30 minutes").
COPILOT_RESERVE_MIN = 30.0
# Consumption rate is fitted over the readings of the last N minutes (algorithm setting).
COPILOT_RATE_WINDOW_MIN = 10.0
# ASSUMPTION: breathing 20 % faster than planned is worth a "slow down" message.
COPILOT_CAUTION_RATE_FACTOR = 1.2
# ASSUMPTION: oxygen falling 3x faster than planned on level ground is treated as a possible leak.
COPILOT_LEAK_RATE_FACTOR = 3.0
# ASSUMPTION: slopes from this value count as a climb (a faster breathing rate is expected).
COPILOT_CLIMB_SLOPE_DEG = 8.0
# Floor for the fitted rate so a flat or noisy reading never divides by zero (numerical guard).
COPILOT_MIN_RATE_PCT_PER_MIN = 1e-6

# Request size limit for /api/copilot/assess (one reading per second over a long EVA is far less).
COPILOT_MAX_READINGS = 5000

# Copilot demo scenario (simulated telemetry, presentation settings, not physical data).
SIM_STEP_MIN = 1.0
SIM_CLIMB_RATE_FACTOR = 1.4  # breathing harder on climbs, to show the "slow down" advice
SIM_LEAK_AT_FRACTION = 0.6  # the leak starts after 60 % of the planned walk out
SIM_LEAK_RATE_FACTOR = 4.0  # leak: oxygen falls 4x faster than planned
SIM_ROUTE = ("poi-01", "poi-04")  # Bradbury Landing (base) -> Pahrump Hills

# API contract: profile has at most this many points.
MAX_PROFILE_POINTS = 300

SECONDS_PER_MINUTE = 60.0
COORD_DECIMALS = 6
