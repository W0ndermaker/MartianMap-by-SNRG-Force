// Typed API client. Every call falls back to offline data when the backend is unreachable,
// so the app keeps working after the hackathon when the free server is asleep.

import * as offline from './offline'
import type { Conditions, Health, PoiCollection, RouteRequest, RouteResponse } from './types'

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
const TIMEOUT_MS = 8000

export interface Result<T> {
  data: T
  offline: boolean
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_URL) throw new Error('VITE_API_URL is not set')
  const response = await fetch(`${API_URL}/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    signal: AbortSignal.timeout(TIMEOUT_MS),
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

export const api = {
  health: () => withFallback(() => request<Health>('/health'), offline.offlineHealth),

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
}
