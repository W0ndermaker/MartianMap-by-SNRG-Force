// Typed API client. Every call falls back to offline data when the backend is unreachable,
// so the app keeps working after the hackathon when the free server is asleep. A server that
// answers with an error (HTTP 4xx/5xx) is reachable: that is an error to show, not offline mode.
// Gateway errors (502/503/504) come from a proxy or host in front of a server that is down or
// asleep, so they count as unreachable.

import * as offline from './offline'
import type {
  Conditions,
  CopilotCase,
  CopilotScenario,
  Health,
  LonLat,
  PoiCollection,
  RouteRequest,
  RouteResponse,
} from './types'

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
/** A free-tier server sleeps when idle and needs up to about a minute to wake up. */
const WAKE_TIMEOUT_MS = 60_000
/** Later requests: the server is awake; a route with its way back takes a few seconds at most. */
const REQUEST_TIMEOUT_MS = 20_000

/** The server answered, with an error status. `message` is the server's reason when it gave one. */
export class HttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

/** First reason in a FastAPI error body ({detail: string | [{msg}]}), if any. */
async function errorReason(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { detail?: unknown }
    if (typeof body.detail === 'string') return body.detail
    if (Array.isArray(body.detail) && typeof body.detail[0]?.msg === 'string') return body.detail[0].msg
  } catch {
    // Not JSON: no reason.
  }
  return null
}

/** Bad gateway, unavailable, gateway timeout: the backend behind the proxy did not answer. */
const GATEWAY_ERRORS = new Set([502, 503, 504])

export interface Result<T> {
  data: T
  offline: boolean
}

async function request<T>(path: string, init?: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  if (!API_URL) throw new Error('VITE_API_URL is not set')
  const response = await fetch(`${API_URL}/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (GATEWAY_ERRORS.has(response.status)) throw new Error(`${path}: backend unreachable (HTTP ${response.status})`)
  if (!response.ok) {
    const reason = await errorReason(response)
    throw new HttpError(response.status, reason ?? `Server error (HTTP ${response.status})`)
  }
  return response.json() as Promise<T>
}

/**
 * Online answer, or offline data when the server cannot be reached (no URL, network error,
 * timeout). An HTTP error is rethrown unless `onHttpError` is 'fallback'.
 */
async function withFallback<T>(
  online: () => Promise<T>,
  fallback: () => Promise<T>,
  onHttpError: 'throw' | 'fallback' = 'throw',
) {
  try {
    return { data: await online(), offline: false } satisfies Result<T>
  } catch (error) {
    if (error instanceof HttpError && onHttpError === 'throw') throw error
    console.warn('Backend unavailable, using offline data:', error)
    return { data: await fallback(), offline: true } satisfies Result<T>
  }
}

/** Interval of the connection check while the app is open. */
export const HEARTBEAT_MS = 30_000
/** The connection check gives up after this long (the server is awake if it was online). */
const PING_TIMEOUT_MS = 8_000

/** True when the backend answers GET /api/health; false when it is unreachable or not set. */
export async function ping(): Promise<boolean> {
  if (!API_URL) return false
  try {
    await request<Health>('/health', undefined, PING_TIMEOUT_MS)
    return true
  } catch {
    return false
  }
}

export const hasBackend = Boolean(API_URL)

export const api = {
  /** First call of the session: waits long enough for a sleeping server to wake up. */
  // A failing health check means the server cannot plan: use the offline data.
  health: () =>
    withFallback(
      () => request<Health>('/health', undefined, WAKE_TIMEOUT_MS),
      offline.offlineHealth,
      'fallback',
    ),

  route: (body: RouteRequest) =>
    withFallback(
      () => request<RouteResponse>('/route', { method: 'POST', body: JSON.stringify(body) }),
      () => offline.offlineRoute(body),
    ),

  conditions: (sol?: number) =>
    withFallback(
      () => request<Conditions>(sol === undefined ? '/conditions' : `/conditions?sol=${sol}`),
      () => offline.offlineConditions(sol),
    ),

  // The points of interest are the same bundled file the server reads.
  poi: () => withFallback(() => request<PoiCollection>('/poi'), offline.offlinePoi, 'fallback'),

  /**
   * EVA for the Copilot: simulated suit telemetry on a real route. With `route` the walk follows
   * the user's start and goal; without it (or offline) the precomputed demo walk is used.
   */
  copilotScenario: (scenarioCase: CopilotCase, route?: { start: LonLat; goal: LonLat; maxSlopeDeg: number }) => {
    const query = new URLSearchParams({ case: scenarioCase })
    if (route) {
      for (const v of route.start) query.append('start', String(v))
      for (const v of route.goal) query.append('goal', String(v))
      query.set('max_slope_deg', String(route.maxSlopeDeg))
    }
    return withFallback(
      () => request<CopilotScenario>(`/copilot/scenario?${query}`),
      () => offline.offlineCopilotScenario(scenarioCase),
    )
  },
}
