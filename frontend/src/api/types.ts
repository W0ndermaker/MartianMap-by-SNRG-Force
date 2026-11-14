// Types of the backend API, mirroring docs/API_CONTRACT.md.
// Coordinates are [longitude east 0..360, latitude] in degrees.

export type LonLat = [number, number];
export type LonLatElev = [number, number, number];

export type RouteStatus = 'ok' | 'no_route' | 'out_of_bounds';

export interface RouteRequest {
  start: LonLat;
  goal: LonLat;
  max_slope_deg?: number;
  speed_flat_m_s?: number;
}

export interface ProfilePoint {
  dist_m: number;
  elev_m: number;
  slope_deg: number;
}

export interface Hazard {
  type: string;
  position: LonLat;
  value: number;
  note: string;
}

export interface RouteResponse {
  status: RouteStatus;
  reason?: string | null;
  path?: { type: 'LineString'; coordinates: LonLatElev[] } | null;
  distance_m?: number | null;
  duration_min?: number | null;
  o2_used_pct?: number | null;
  max_slope_deg?: number | null;
  ascent_m?: number | null;
  descent_m?: number | null;
  profile?: ProfilePoint[] | null;
  hazards?: Hazard[] | null;
}

export type PoiKind = 'science' | 'base' | 'rover_stop';

export interface PoiProperties {
  id: string;
  name: string;
  kind: PoiKind;
  description: string;
  photo_url: string | null;
  photo_credit: string | null;
}

export interface PoiCollection {
  type: 'FeatureCollection';
  features: { type: 'Feature'; geometry: { type: 'Point'; coordinates: LonLat }; properties: PoiProperties }[];
}

export interface Health {
  status: string;
  terrain: 'real' | 'synthetic';
  bounds: [number, number, number, number]; // min lon, min lat, max lon, max lat
  cell_size_m: number;
}
