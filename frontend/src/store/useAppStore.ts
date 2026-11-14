// Shared app state for the map (developer A) and the panels (developer C).

import { create } from 'zustand'
import { api } from '../api/client'
import type { Conditions, Health, LonLat, PoiCollection, RouteResponse } from '../api/types'
// Defaults from data/suit_params.json (max_slope_deg, speed_flat_m_s).
import suit from '@data/suit_params.json'

export type LoadState = 'idle' | 'loading' | 'ready' | 'error'

export interface Layers {
  route: boolean
  hazards: boolean
  poi: boolean
  traverse: boolean
}

export interface AppState {
  health: Health | null
  /** True once any request has been answered from offline data. */
  offline: boolean

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
  toggleLayer: (layer: keyof Layers) => void
}

export const SLOPE_RANGE_DEG = suit.max_slope_range_deg.value as [number, number]

export const useAppStore = create<AppState>((set, get) => ({
  health: null,
  offline: false,
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
  layers: { route: true, hazards: true, poi: true, traverse: true },

  init: async () => {
    const [health, poi] = await Promise.all([api.health(), api.poi()])
    set({ health: health.data, poi: poi.data, offline: health.offline || poi.offline })
    await get().loadConditions()
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
    const { start, goal, maxSlopeDeg } = get()
    if (!start || !goal) return
    set({ routeState: 'loading' })
    try {
      const result = await api.route({
        start,
        goal,
        max_slope_deg: maxSlopeDeg,
        speed_flat_m_s: suit.speed_flat_m_s.value,
      })
      // Ignore a response for points the user has already moved.
      if (get().start !== start || get().goal !== goal || get().maxSlopeDeg !== maxSlopeDeg) return
      set({ route: result.data, routeState: 'ready', offline: get().offline || result.offline })
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
        offline: get().offline || result.offline,
      })
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

  toggleLayer: (layer) => set({ layers: { ...get().layers, [layer]: !get().layers[layer] } }),
}))
