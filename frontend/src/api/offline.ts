// Offline mode: answers every request from the files in data/ when the backend is unreachable.
// The files are loaded lazily so they are not part of the main bundle.

import type {
  Conditions,
  CopilotScenario,
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

/** Coordinates are stored with 6 decimals; points closer than this are the same point. */
const SAME_POINT_DEG = 1e-6

const samePoint = (a: LonLat, b: LonLat) =>
  Math.abs(a[0] - b[0]) < SAME_POINT_DEG && Math.abs(a[1] - b[1]) < SAME_POINT_DEG

export const OFFLINE_ROUTE_REASON =
  'Offline demo: the route server is unreachable, so only the precomputed demo routes below can be shown.'

/**
 * Returns the precomputed route for exactly this start, goal and max slope. Any other request
 * gets an honest "no_route" instead of a different route that would look like the answer.
 */
export async function offlineRoute(request: RouteRequest): Promise<RouteResponse> {
  const { routes } = await loadDemoRoutes()
  const match = routes.find(
    (r) =>
      samePoint(r.request.start, request.start) &&
      samePoint(r.request.goal, request.goal) &&
      (request.max_slope_deg === undefined || r.request.max_slope_deg === request.max_slope_deg),
  )
  return match ? match.response : { status: 'no_route', reason: OFFLINE_ROUTE_REASON }
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

/** Demo route start/goal pairs (and their max slope), offered as buttons in offline mode. */
export async function offlineDemoPairs(): Promise<
  { start: LonLat; goal: LonLat; max_slope_deg: number }[]
> {
  const { routes } = await loadDemoRoutes()
  return routes.map((r) => ({
    start: r.request.start,
    goal: r.request.goal,
    max_slope_deg: r.request.max_slope_deg,
  }))
}

/** Copilot demo scenario precomputed by the backend (data/copilot_scenario.json). */
export async function offlineCopilotScenario(): Promise<CopilotScenario> {
  const m = await import('@data/copilot_scenario.json')
  return m.default as unknown as CopilotScenario
}
