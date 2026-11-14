"""Pydantic models for every request and response in the API contract."""

from typing import Literal

from pydantic import BaseModel, Field

# [longitude, latitude], degrees, east longitude 0-360.
LonLat = tuple[float, float]


class RouteRequest(BaseModel):
    """POST /api/route request body."""

    start: LonLat
    goal: LonLat
    max_slope_deg: float = Field(default=20, gt=0)
    speed_flat_m_s: float = Field(default=1.0, gt=0)


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


class ConditionsResponse(BaseModel):
    """GET /api/conditions response. Any measurement may be null."""

    sol: int
    temp_min_c: float | None = None
    temp_max_c: float | None = None
    pressure_pa: float | None = None
    uv_index: Literal["low", "moderate", "high", "very_high"] | None = None
    radiation_usv_per_hour: float | None = None
    dust_opacity: float | None = None
    risk_level: Literal["green", "yellow", "red"]
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
