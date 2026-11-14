// Types for the API contract, see docs/API_CONTRACT.md.

/** [longitude, latitude] in degrees, east longitude 0-360. */
export type LonLat = [number, number]

export interface RouteRequest {
  start: LonLat
  goal: LonLat
  max_slope_deg?: number
  speed_flat_m_s?: number
}

export interface ProfilePoint {
  dist_m: number
  elev_m: number
  slope_deg: number
}

export interface Hazard {
  type: 'steep_slope'
  position: LonLat
  value: number
  note: string
}

export type RouteStatus = 'ok' | 'no_route' | 'out_of_bounds'

export interface RouteResponse {
  status: RouteStatus
  reason?: string | null
  path?: { type: 'LineString'; coordinates: [number, number, number][] } | null
  distance_m?: number | null
  duration_min?: number | null
  o2_used_pct?: number | null
  max_slope_deg?: number | null
  ascent_m?: number | null
  descent_m?: number | null
  profile?: ProfilePoint[] | null
  hazards?: Hazard[] | null
}

export type UvIndex = 'low' | 'moderate' | 'high' | 'very_high'
export type RiskLevel = 'green' | 'yellow' | 'red'

export interface Conditions {
  sol: number
  temp_min_c: number | null
  temp_max_c: number | null
  pressure_pa: number | null
  uv_index: UvIndex | null
  radiation_usv_per_hour: number | null
  dust_opacity: number | null
  risk_level: RiskLevel
  source: string
}

export type PoiKind = 'science' | 'base' | 'rover_stop'

export interface PoiProperties {
  id: string
  name: string
  kind: PoiKind
  description: string
  photo_url: string | null
  photo_credit: string | null
}

export interface PoiFeature {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: LonLat }
  properties: PoiProperties
}

export interface PoiCollection {
  type: 'FeatureCollection'
  features: PoiFeature[]
}

/** [min_lon, min_lat, max_lon, max_lat] */
export type Bounds = [number, number, number, number]

export interface Health {
  status: 'ok'
  terrain: 'real' | 'synthetic'
  bounds: Bounds
  cell_size_m: number
}

/** Curiosity traverse layer, data/curiosity_traverse.geojson. */
export interface TraverseCollection {
  type: 'FeatureCollection'
  features: (
    | {
        type: 'Feature'
        geometry: { type: 'LineString'; coordinates: [number, number, number][] }
        properties: { kind: 'drive'; length_m: number | null }
      }
    | {
        type: 'Feature'
        geometry: { type: 'Point'; coordinates: LonLat }
        properties: { kind: 'stop'; sol: number; site: number }
      }
  )[]
}
