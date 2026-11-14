"""Pydantic models for every request and response in the API contract."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.core import constants as c

# [longitude, latitude], degrees, east longitude 0-360.
LonLat = tuple[float, float]

_Lon = Annotated[float, Field(ge=c.LON_RANGE_DEG[0], le=c.LON_RANGE_DEG[1])]
_Lat = Annotated[float, Field(ge=c.LAT_RANGE_DEG[0], le=c.LAT_RANGE_DEG[1])]
RequestLonLat = tuple[_Lon, _Lat]


class RouteRequest(BaseModel):
    """POST /api/route request body. NaN, infinity and out-of-range values give 422."""

    model_config = ConfigDict(allow_inf_nan=False)

    start: RequestLonLat
    goal: RequestLonLat
    max_slope_deg: float = Field(default=c.DEFAULT_MAX_SLOPE_DEG, gt=0, le=c.MAX_SLOPE_LIMIT_DEG)
    speed_flat_m_s: float = Field(
        default=c.DEFAULT_SPEED_FLAT_M_S,
        ge=c.SPEED_FLAT_RANGE_M_S[0],
        le=c.SPEED_FLAT_RANGE_M_S[1],
    )
    # Optional: the sol whose surface conditions feed the verdict (not part of v1 contract).
    sol: int | None = Field(default=None, ge=0)
    # Optional: the astronaut carries science gear (slower walk, more oxygen; constants.py).
    carrying_load: bool = False


class LineString(BaseModel):
    """GeoJSON LineString with [lon, lat, elevation_m] coordinates."""

    type: Literal["LineString"]
    coordinates: list[tuple[float, float, float]]


class ProfilePoint(BaseModel):
    dist_m: float
    elev_m: float
    slope_deg: float


class Hazard(BaseModel):
    type: Literal["steep_slope"]
    position: LonLat
    value: float
    note: str


class RouteResponse(BaseModel):
    """POST /api/route response. Route fields are None unless status is ok."""

    status: Literal["ok", "no_route", "out_of_bounds"]
    reason: str | None = None
    path: LineString | None = None
    distance_m: float | None = None
    duration_min: float | None = None
    o2_used_pct: float | None = None
    max_slope_deg: float | None = None
    ascent_m: float | None = None
    descent_m: float | None = None
    profile: list[ProfilePoint] | None = Field(default=None, max_length=300)
    hazards: list[Hazard] | None = None
    # Round trip and decision (added 2026-11-14, optional for older clients).
    return_duration_min: float | None = None
    return_o2_used_pct: float | None = None
    round_trip_o2_used_pct: float | None = None
    o2_reserve_pct: float | None = None
    verdict: Literal["go", "caution", "no_go"] | None = None
    verdict_reasons: list[str] | None = None
    # Radiation dose for the whole EVA (out and back), microsieverts; null without data.
    eva_dose_usv: float | None = None


class ConditionsResponse(BaseModel):
    """GET /api/conditions response. Any measurement may be null."""

    sol: int
    temp_min_c: float | None = None
    temp_max_c: float | None = None
    pressure_pa: float | None = None
    uv_index: Literal["low", "moderate", "high", "very_high"] | None = None
    radiation_usv_per_hour: float | None = None
    dust_opacity: float | None = None
    risk_level: Literal["green", "yellow", "red", "unknown"]
    source: str


class PointGeometry(BaseModel):
    type: Literal["Point"]
    coordinates: LonLat


class PoiProperties(BaseModel):
    id: str
    name: str
    kind: Literal["science", "base", "rover_stop"]
    description: str
    photo_url: str | None = None
    photo_credit: str | None = None


class PoiFeature(BaseModel):
    type: Literal["Feature"]
    geometry: PointGeometry
    properties: PoiProperties


class PoiCollection(BaseModel):
    """GET /api/poi response: GeoJSON FeatureCollection."""

    type: Literal["FeatureCollection"]
    features: list[PoiFeature]


class HealthResponse(BaseModel):
    """GET /api/health response."""

    status: Literal["ok"]
    terrain: Literal["real", "synthetic"]
    # [min_lon, min_lat, max_lon, max_lat]
    bounds: tuple[float, float, float, float]
    cell_size_m: float


# ---- EVA Copilot (added 2026-11-14) ----

CopilotLevel = Literal["go", "caution", "turn_back", "emergency"]
_Minutes = Annotated[float, Field(ge=0, le=c.EVA_MAX_DURATION_MIN * 2)]
_Pct = Annotated[float, Field(ge=0, le=c.O2_SUPPLY_PCT)]


class CopilotAssessRequest(BaseModel):
    """POST /api/copilot/assess: suit tank readings so far and the current position."""

    model_config = ConfigDict(allow_inf_nan=False)

    position: RequestLonLat
    times_min: list[_Minutes] = Field(min_length=1, max_length=c.COPILOT_MAX_READINGS)
    o2_pct: list[_Pct] = Field(min_length=1, max_length=c.COPILOT_MAX_READINGS)


class CopilotAir(BaseModel):
    """Air module decision."""

    level: CopilotLevel
    reasons: list[str]
    o2_remaining_pct: float
    rate_pct_per_min: float
    planned_rate_pct_per_min: float
    minutes_of_o2_left: float
    minutes_to_base: float | None
    turn_back_in_min: float | None


class CopilotStep(BaseModel):
    t_min: float
    position: LonLat
    phase: Literal["out", "back"]
    o2_pct: float
    slope_deg: float
    copilot: CopilotAir


class CopilotEvent(BaseModel):
    t_min: float
    level: CopilotLevel
    message: str


class CopilotScenario(BaseModel):
    """GET /api/copilot/scenario: simulated telemetry on a real route, with the decisions."""

    case: Literal["turnback", "leak"]
    note: str
    outbound_path: LineString
    return_path: LineString | None
    leak_at_min: float | None
    turned_back_at_min: float | None
    arrived_back: bool
    final_o2_pct: float
    events: list[CopilotEvent]
    steps: list[CopilotStep]
