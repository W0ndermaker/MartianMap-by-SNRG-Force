// Map-only UI state (developer A). Shared app state (points, route, POIs, the route/hazards/poi/traverse
// layer switches) lives in ../store/useAppStore.ts.

import { create } from 'zustand'

export type MapLayerId = 'nogo' | 'elevation' | 'slope' | 'thermal' | 'geology' | 'mola'

interface MapState {
  layers: Record<MapLayerId, boolean>
  /** Tint the grayscale HiRISE/CTX imagery with a Mars palette (visualisation, not true colour). */
  tint: boolean
  /** Distance along the route (m) hovered on the elevation profile; the map highlights that spot. */
  hoverDistM: number | null
  toggleLayer: (id: MapLayerId) => void
  setTint: (v: boolean) => void
  setHoverDistM: (d: number | null) => void
}

export const useMapStore = create<MapState>((set) => ({
  layers: { nogo: true, elevation: false, slope: false, thermal: false, geology: false, mola: false },
  tint: true,
  hoverDistM: null,
  toggleLayer: (id) => set((s) => ({ layers: { ...s.layers, [id]: !s.layers[id] } })),
  setTint: (tint) => set({ tint }),
  setHoverDistM: (hoverDistM) => set({ hoverDistM }),
}))
