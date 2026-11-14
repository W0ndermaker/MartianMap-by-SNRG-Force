// Offline mode: answers every request from the files in data/ when the backend is unreachable.
// The files are loaded lazily so they are not part of the main bundle.

import type {
  Conditions,
  Health,
  LonLat,
  PoiCollection,
  RouteRequest,
  RouteResponse,
} from './types'

interface DemoRoutes {
  health: Health
  routes: { request: Required<RouteRequest>; response: RouteResponse }[]
}

const loadDemoRoutes = () =>
  import('@data/demo_routes.json').then((m) => m.default as unknown as DemoRoutes)
const loadConditions = () =>
  import('@data/conditions.json').then((m) => m.default as unknown as Conditions[])
const loadPoi = () => import('@data/poi.json').then((m) => m.default as unknown as PoiCollection)

function distance(a: LonLat, b: LonLat): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

/** Returns the precomputed route whose start and goal are closest to the request. */
export async function offlineRoute(request: RouteRequest): Promise<RouteResponse> {
  const { routes } = await loadDemoRoutes()
  const slope = request.max_slope_deg ?? 20
  const score = (r: DemoRoutes['routes'][number]) =>
    distance(r.request.start, request.start) +
    distance(r.request.goal, request.goal) +
    Math.abs(r.request.max_slope_deg - slope) * 1e-4
  return routes.reduce((best, r) => (score(r) < score(best) ? r : best)).response
}

export async function offlineConditions(sol?: number): Promise<Conditions> {
  const rows = await loadConditions()
  if (sol === undefined) return rows[rows.length - 1]
  return rows.reduce((best, r) => (Math.abs(r.sol - sol) < Math.abs(best.sol - sol) ? r : best))
}

export const offlinePoi = loadPoi

/** Health recorded by the backend when the demo routes were computed. */
export async function offlineHealth(): Promise<Health> {
  return (await loadDemoRoutes()).health
}

/** Demo route start/goal pairs, shown as hints in offline mode. */
export async function offlineDemoPairs(): Promise<{ start: LonLat; goal: LonLat }[]> {
  const { routes } = await loadDemoRoutes()
  return routes.map((r) => ({ start: r.request.start, goal: r.request.goal }))
}
