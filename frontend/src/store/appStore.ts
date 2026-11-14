// Shared application state.
// OWNER: developer C. This is a minimal stub created by developer A so the map can run
// ("stub first, real data later"). C may extend or replace it; the map only uses the fields below.

import { create } from 'zustand';
import type { Health, LonLat, PoiCollection, RouteResponse } from '../api/types';

export type LayerId = 'elevation' | 'slope' | 'thermal' | 'geology' | 'mola' | 'curiosity';

export type RoutePhase = 'idle' | 'loading' | 'ok' | 'no_route' | 'out_of_bounds' | 'error';

export interface AppState {
  health: Health | null;
  backendOnline: boolean | null;
  poi: PoiCollection | null;

  start: LonLat | null;
  goal: LonLat | null;
  maxSlopeDeg: number;
  speedFlatMS: number;

  route: RouteResponse | null;
  routePhase: RoutePhase;
  routeMessage: string | null;
  /** 'backend' or 'fallback' (precomputed route shown because the backend is offline). */
  routeSource: 'backend' | 'fallback' | null;
  routeLabel: string | null;

  layers: Record<LayerId, boolean>;
  /** Tint the grayscale HiRISE/CTX imagery with a Mars palette (visualisation, not true colour). */
  tint: boolean;
  selectedPoiId: string | null;
  /** Index into route.profile hovered on the profile chart; the map highlights that spot. */
  profileHoverIndex: number | null;

  setHealth: (h: Health, online: boolean) => void;
  setPoi: (p: PoiCollection | null) => void;
  setStart: (p: LonLat | null) => void;
  setGoal: (p: LonLat | null) => void;
  resetPoints: () => void;
  setRoute: (phase: RoutePhase, route: RouteResponse | null, message?: string | null,
             source?: 'backend' | 'fallback' | null, label?: string | null) => void;
  toggleLayer: (id: LayerId) => void;
  setTint: (v: boolean) => void;
  selectPoi: (id: string | null) => void;
  setProfileHoverIndex: (i: number | null) => void;
  setMaxSlopeDeg: (v: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  health: null,
  backendOnline: null,
  poi: null,
  start: null,
  goal: null,
  maxSlopeDeg: 20,
  speedFlatMS: 1.0,
  route: null,
  routePhase: 'idle',
  routeMessage: null,
  routeSource: null,
  routeLabel: null,
  layers: { elevation: false, slope: false, thermal: false, geology: false, mola: false, curiosity: true },
  tint: true,
  selectedPoiId: null,
  profileHoverIndex: null,

  setHealth: (health, backendOnline) => set({ health, backendOnline }),
  setPoi: (poi) => set({ poi }),
  setStart: (start) => set({ start }),
  setGoal: (goal) => set({ goal }),
  resetPoints: () =>
    set({ start: null, goal: null, route: null, routePhase: 'idle', routeMessage: null, routeSource: null,
          routeLabel: null, profileHoverIndex: null }),
  setRoute: (routePhase, route, routeMessage = null, routeSource = null, routeLabel = null) =>
    set({ routePhase, route, routeMessage, routeSource, routeLabel, profileHoverIndex: null }),
  toggleLayer: (id) => set((s) => ({ layers: { ...s.layers, [id]: !s.layers[id] } })),
  setTint: (tint) => set({ tint }),
  selectPoi: (selectedPoiId) => set({ selectedPoiId }),
  setProfileHoverIndex: (profileHoverIndex) => set({ profileHoverIndex }),
  setMaxSlopeDeg: (maxSlopeDeg) => set({ maxSlopeDeg }),
}));
