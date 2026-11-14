// Shared app state for the map (developer A) and the panels (developer C).

import { create } from 'zustand'
import { api, hasBackend, HEARTBEAT_MS, ping } from '../api/client'
import type { Conditions, Health, LonLat, PoiCollection, RouteResponse } from '../api/types'
// Defaults from data/suit_params.json (max_slope_deg, speed_flat_m_s).
import suit from '@data/suit_params.json'

export type LoadState = 'idle' | 'loading' | 'ready' | 'error'

export interface Layers {
  route: boolean
  hazards: boolean
  poi: boolean
  traverse: boolean
  /** Walk-back rings from the base (data/reach_from_base.geojson). */
  reach: boolean
  /** Straight line start to goal, magenta where it crosses slopes above the limit. */
  straight: boolean
}

export interface AppState {
  health: Health | null
  /** True while the first request waits for a sleeping server to wake up. */
  connecting: boolean
  /** True when the latest answer came from offline data (resets once the server answers). */
  offline: boolean
  /** The server answered before but the periodic check now fails. */
  connectionLost: boolean
  /** The shown route came from the server before the connection was lost: may be outdated. */
  routeStale: boolean

  start: LonLat | null
  goal: LonLat | null
  maxSlopeDeg: number
  route: RouteResponse | null
  routeState: LoadState

  sol: number | null
  conditions: Conditions | null
  conditionsState: LoadState

  poi: PoiCollection | null
  selectedPoiId: string | null

  layers: Layers

  init: () => Promise<void>
  /** Checks the server every HEARTBEAT_MS; returns a function that stops the checks. */
  startHeartbeat: () => () => void
  /** Sets start, then goal, then starts over with a new start. */
  placePoint: (point: LonLat) => void
  setStart: (point: LonLat | null) => void
  setGoal: (point: LonLat | null) => void
  setMaxSlope: (deg: number) => void
  planRoute: () => Promise<void>
  clearRoute: () => void
  loadConditions: (sol?: number) => Promise<void>
  selectPoi: (id: string | null) => void
  routeToPoi: (id: string) => void
  /** Shows a precomputed demo route: its start, goal and max slope. */
  showDemo: (pair: { start: LonLat; goal: LonLat; max_slope_deg: number }) => void
  toggleLayer: (layer: keyof Layers) => void
}

export const SLOPE_RANGE_DEG = suit.max_slope_range_deg.value as [number, number]

export const useAppStore = create<AppState>((set, get) => ({
  health: null,
  connecting: false,
  offline: false,
  connectionLost: false,
  routeStale: false,
  start: null,
  goal: null,
  maxSlopeDeg: suit.max_slope_deg.value,
  route: null,
  routeState: 'idle',
  sol: null,
  conditions: null,
  conditionsState: 'idle',
  poi: null,
  selectedPoiId: null,
  layers: { route: true, hazards: true, poi: true, traverse: true, reach: false, straight: true },

  init: async () => {
    set({ connecting: true })
    // Health first: it waits for a sleeping server, then the other requests are fast.
    const health = await api.health()
    const poi = await api.poi()
    set({
      connecting: false,
      health: health.data,
      poi: poi.data,
      offline: health.offline || poi.offline,
    })
    await get().loadConditions()
  },

  startHeartbeat: () => {
    if (!hasBackend) return () => {}
    const id = setInterval(async () => {
      const up = await ping()
      const { connectionLost, offline, route } = get()
      if (!up && !connectionLost && !offline) {
        // Lost contact: whatever the panels show may be outdated; never leave it green.
        set({ connectionLost: true, routeStale: route?.status === 'ok' })
      } else if (up && (connectionLost || offline)) {
        set({ connectionLost: false })
        await get().loadConditions(get().sol ?? undefined) // also re-plans a shown route
      }
    }, HEARTBEAT_MS)
    return () => clearInterval(id)
  },

  placePoint: (point) => {
    const { start, goal } = get()
    if (!start || goal) set({ start: point, goal: null, route: null, routeState: 'idle' })
    else {
      set({ goal: point })
      void get().planRoute()
    }
  },

  setStart: (start) => {
    set({ start })
    void get().planRoute()
  },

  setGoal: (goal) => {
    set({ goal })
    void get().planRoute()
  },

  setMaxSlope: (maxSlopeDeg) => {
    set({ maxSlopeDeg })
    void get().planRoute()
  },

  planRoute: async () => {
    const { start, goal, maxSlopeDeg, sol, conditionsState } = get()
    if (!start || !goal) return
    set({ routeState: 'loading' })
    // Never plan without the sol while conditions are still loading: the verdict would ignore the
    // weather. loadConditions plans the route as soon as the sol is known.
    if (sol === null && conditionsState !== 'error') return
    try {
      const result = await api.route({
        start,
        goal,
        max_slope_deg: maxSlopeDeg,
        speed_flat_m_s: suit.speed_flat_m_s.value,
        ...(sol === null ? {} : { sol }),
      })
      // Ignore a response for points the user has already moved.
      if (get().start !== start || get().goal !== goal || get().maxSlopeDeg !== maxSlopeDeg) return
      set({
        route: result.data,
        routeState: 'ready',
        offline: result.offline,
        routeStale: false,
        connectionLost: result.offline && hasBackend ? get().connectionLost : false,
      })
    } catch (error) {
      console.error(error)
      set({ route: null, routeState: 'error' })
    }
  },

  clearRoute: () => set({ start: null, goal: null, route: null, routeState: 'idle' }),

  loadConditions: async (sol) => {
    set({ conditionsState: 'loading' })
    try {
      const result = await api.conditions(sol)
      set({
        conditions: result.data,
        sol: result.data.sol,
        conditionsState: 'ready',
        offline: result.offline,
      })
      // The verdict depends on the sol: plan or update the route once the sol is known.
      if (get().start && get().goal) void get().planRoute()
    } catch (error) {
      console.error(error)
      set({ conditionsState: 'error' })
    }
  },

  selectPoi: (selectedPoiId) => set({ selectedPoiId }),

  routeToPoi: (id) => {
    const feature = get().poi?.features.find((f) => f.properties.id === id)
    if (!feature) return
    const goal = feature.geometry.coordinates
    // Without a start, walk from the base.
    const base = get().poi?.features.find((f) => f.properties.kind === 'base')
    const start = get().start ?? base?.geometry.coordinates ?? null
    set({ start, goal })
    void get().planRoute()
  },

  showDemo: ({ start, goal, max_slope_deg }) => {
    set({ start, goal, maxSlopeDeg: max_slope_deg, route: null })
    void get().planRoute()
  },

  toggleLayer: (layer) => set({ layers: { ...get().layers, [layer]: !get().layers[layer] } }),
}))
