"""All numeric constants with their source. ASSUMPTION marks values not yet backed by a source."""

# Equatorial radius of Mars, IAU. Source: IAU WGCCRE report (3,396,190 m).
MARS_RADIUS_M = 3_396_190.0

# Target grid cell size for the prepared elevation map (project decision).
CELL_SIZE_M = 5.0

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
DEFAULT_MAX_SLOPE_DEG = 20.0  # ASSUMPTION, to be confirmed by developer C
DEFAULT_SPEED_FLAT_M_S = 1.0  # ASSUMPTION, to be confirmed by developer C

# Walking speed vs slope: Tobler's hiking function, exp(-K * |tan(s) + OFFSET|).
# ASSUMPTION: Earth-based form used as an approximation for a suited astronaut on Mars.
TOBLER_K = 3.5
TOBLER_OFFSET = 0.05

# ASSUMPTION: oxygen supply expressed as maximum EVA duration, to be confirmed by developer C.
EVA_MAX_DURATION_MIN = 480.0

# ASSUMPTION: a path cell is hazardous at this fraction of the allowed maximum slope.
HAZARD_SLOPE_FRACTION = 0.8

# API contract: profile has at most this many points.
MAX_PROFILE_POINTS = 300

SECONDS_PER_MINUTE = 60.0
COORD_DECIMALS = 6
