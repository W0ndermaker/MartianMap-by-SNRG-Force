// Backend client with offline fallbacks.
// When the backend is unreachable, the app keeps working: bounds and POIs fall back to built-in
// defaults and routes fall back to precomputed ones (public/data/fallback-routes.json), as the
// submission rules require.

import type { Health, LonLat, PoiCollection, RouteRequest, RouteResponse } from './types';

const BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');
const TIMEOUT_MS = 15000;

export class BackendUnavailable extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, { ...init, signal: ctrl.signal });
  } catch (e) {
    throw new BackendUnavailable(e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(timer);
  }
  if (res.status >= 500 || res.status === 404) throw new BackendUnavailable(`HTTP ${res.status}`);
  if (!res.ok) throw new Error(`Request failed: HTTP ${res.status}`);
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('json')) throw new BackendUnavailable(`Unexpected response type: ${type || 'none'}`);
  return (await res.json()) as T;
}

/** Working-area example from the API contract; used only when the backend is offline. */
export const DEFAULT_HEALTH: Health = {
  status: 'offline',
  terrain: 'real',
  bounds: [137.3, -4.78, 137.46, -4.56],
  cell_size_m: 5,
};

export function fetchHealth(): Promise<Health> {
  return request<Health>('/health');
}

export function fetchPoi(): Promise<PoiCollection> {
  return request<PoiCollection>('/poi');
}

export function postRoute(body: RouteRequest): Promise<RouteResponse> {
  return request<RouteResponse>('/route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ---------- precomputed fallback routes ----------

export interface FallbackRoute {
  id: string;
  name: string;
  start: LonLat;
  goal: LonLat;
  request: RouteRequest;
  computed_at: string;
  terrain: string;
  response: RouteResponse;
}

export interface FallbackFile {
  note: string;
  routes: FallbackRoute[];
  poi?: PoiCollection;
}

let fallbackCache: Promise<FallbackFile | null> | null = null;

export function loadFallback(): Promise<FallbackFile | null> {
  fallbackCache ??= fetch(`${import.meta.env.BASE_URL}data/fallback-routes.json`)
    .then((r) => (r.ok ? (r.json() as Promise<FallbackFile>) : null))
    .catch(() => null);
  return fallbackCache;
}

const R_MARS = 3396190;

/** Great-circle distance on the Mars sphere, metres. */
export function distanceM(a: LonLat, b: LonLat): number {
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad;
  const dLon = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R_MARS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Precomputed route whose endpoints are closest to the requested ones. */
export function nearestFallback(file: FallbackFile, start: LonLat, goal: LonLat): FallbackRoute | null {
  let best: FallbackRoute | null = null;
  let bestD = Infinity;
  for (const r of file.routes) {
    const d = distanceM(r.start, start) + distanceM(r.goal, goal);
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  return best;
}
