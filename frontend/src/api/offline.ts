// Offline mode: answers every request from the files in data/ when the backend is unreachable.
// The files are loaded lazily so they are not part of the main bundle.

import type {
  Conditions,
  CopilotCase,
  CopilotScenario,
  Health,
  LonLat,
  PoiCollection,
  RiskLevel,
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

export const OFFLINE_LOAD_REASON =
  'Offline demo: the precomputed demo routes assume no science gear. Turn off "Carrying science gear" to see them.'

export const OFFLINE_ROUTE_REASON =
  'Offline demo: the route server is unreachable, so only the precomputed demo routes below can be shown.'

/**
 * Returns the precomputed route for exactly this start, goal and max slope. Any other request
 * gets an honest "no_route" instead of a different route that would look like the answer.
 */
export async function offlineRoute(request: RouteRequest): Promise<RouteResponse> {
  const { routes } = await loadDemoRoutes()
  // Demo routes were computed without science gear: with the gear they would understate time
  // and oxygen, so they are not offered.
  if (request.carrying_load) return { status: 'no_route', reason: OFFLINE_LOAD_REASON }
  const match = routes.find(
    (r) =>
      samePoint(r.request.start, request.start) &&
      samePoint(r.request.goal, request.goal) &&
      (request.max_slope_deg === undefined || r.request.max_slope_deg === request.max_slope_deg),
  )
  if (!match) return { status: 'no_route', reason: OFFLINE_ROUTE_REASON }
  // Demo routes were computed without a sol: apply the selected sol's risk to the verdict here,
  // with the same rule as the backend (red: NO-GO; yellow or unknown: at least CAUTION).
  if (request.sol === undefined) return match.response
  const conditions = await offlineConditions(request.sol)
  const route = withWeather(match.response, conditions.risk_level, conditions.sol)
  // EVA dose for the selected sol, as the backend computes it.
  const rate = conditions.radiation_usv_per_hour
  const out = route.duration_min
  const back = route.return_duration_min
  const dose =
    rate == null || out == null || back == null ? null : Math.round(rate * ((out + back) / 60) * 10) / 10
  return { ...route, eva_dose_usv: dose }
}

/** The route verdict adjusted for the surface risk of a sol (mirrors backend core/verdict.py). */
export function withWeather(route: RouteResponse, risk: RiskLevel, sol: number): RouteResponse {
  if (route.status !== 'ok' || !route.verdict) return route
  const reasons = route.verdict_reasons ?? []
  if (risk === 'red') {
    return {
      ...route,
      verdict: 'no_go',
      verdict_reasons: [`High-risk surface conditions on sol ${sol}`, ...reasons],
    }
  }
  if (risk === 'yellow' || risk === 'unknown') {
    const text =
      risk === 'yellow' ? `Elevated-risk surface conditions on sol ${sol}` : `No weather data for sol ${sol}`
    return {
      ...route,
      verdict: route.verdict === 'go' ? 'caution' : route.verdict,
      verdict_reasons: [...reasons, text],
    }
  }
  return route
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

/** Copilot demo scenarios precomputed by the backend (data/copilot_scenario_<case>.json). */
export async function offlineCopilotScenario(scenarioCase: CopilotCase): Promise<CopilotScenario> {
  const m =
    scenarioCase === 'leak'
      ? await import('@data/copilot_scenario_leak.json')
      : await import('@data/copilot_scenario_turnback.json')
  return m.default as unknown as CopilotScenario
}
