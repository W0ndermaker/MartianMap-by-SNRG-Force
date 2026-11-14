// Typed API client. Every call falls back to offline data when the backend is unreachable,
// so the app keeps working after the hackathon when the free server is asleep.

import * as offline from './offline'
import type {
  Conditions,
  CopilotScenario,
  Health,
  PoiCollection,
  RouteRequest,
  RouteResponse,
} from './types'

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
/** A free-tier server sleeps when idle and needs up to about a minute to wake up. */
const WAKE_TIMEOUT_MS = 60_000
/** Later requests: the server is awake; a route with its way back takes a few seconds at most. */
const REQUEST_TIMEOUT_MS = 20_000

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
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`)
  return response.json() as Promise<T>
}

async function withFallback<T>(online: () => Promise<T>, fallback: () => Promise<T>) {
  try {
    return { data: await online(), offline: false } satisfies Result<T>
  } catch (error) {
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
  health: () =>
    withFallback(() => request<Health>('/health', undefined, WAKE_TIMEOUT_MS), offline.offlineHealth),

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

  poi: () => withFallback(() => request<PoiCollection>('/poi'), offline.offlinePoi),

  /** Demo EVA for the Copilot: simulated suit telemetry on a real route. */
  copilotScenario: () =>
    withFallback(() => request<CopilotScenario>('/copilot/scenario'), offline.offlineCopilotScenario),
}
