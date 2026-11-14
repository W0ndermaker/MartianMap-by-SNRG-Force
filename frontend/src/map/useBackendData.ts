// Loads /api/health and /api/poi once, and plans a route whenever start and goal are both set.
// If the backend is offline, falls back to default bounds, the POIs bundled with the fallback file,
// and the nearest precomputed route.

import { useEffect, useRef } from 'react';
import {
  BackendUnavailable,
  DEFAULT_HEALTH,
  fetchHealth,
  fetchPoi,
  loadFallback,
  nearestFallback,
  postRoute,
} from '../api/client';
import { useAppStore } from '../store/appStore';

export function useBackendBootstrap() {
  const setHealth = useAppStore((s) => s.setHealth);
  const setPoi = useAppStore((s) => s.setPoi);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const h = await fetchHealth();
        if (cancelled) return;
        setHealth(h, true);
        try {
          const p = await fetchPoi();
          if (!cancelled) setPoi(p);
        } catch {
          const fb = await loadFallback();
          if (!cancelled) setPoi(fb?.poi ?? null);
        }
      } catch {
        const fb = await loadFallback();
        if (cancelled) return;
        setHealth(DEFAULT_HEALTH, false);
        setPoi(fb?.poi ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setHealth, setPoi]);
}

export function useRoutePlanner() {
  const start = useAppStore((s) => s.start);
  const goal = useAppStore((s) => s.goal);
  const maxSlopeDeg = useAppStore((s) => s.maxSlopeDeg);
  const speedFlatMS = useAppStore((s) => s.speedFlatMS);
  const setRoute = useAppStore((s) => s.setRoute);
  const setHealth = useAppStore((s) => s.setHealth);
  const seq = useRef(0);

  useEffect(() => {
    if (!start || !goal) return;
    // A route picked from the precomputed list is already set; do not re-request it.
    const st = useAppStore.getState();
    if (st.routeSource === 'fallback' && st.routePhase === 'ok' && st.route) return;
    const id = ++seq.current;
    setRoute('loading', null);
    (async () => {
      try {
        const r = await postRoute({ start, goal, max_slope_deg: maxSlopeDeg, speed_flat_m_s: speedFlatMS });
        if (id !== seq.current) return;
        if (r.status === 'ok') setRoute('ok', r, null, 'backend');
        else if (r.status === 'no_route')
          setRoute('no_route', null, r.reason || 'No passable route between these points.', 'backend');
        else setRoute('out_of_bounds', null, r.reason || 'A point is outside the working area.', 'backend');
      } catch (e) {
        if (id !== seq.current) return;
        if (!(e instanceof BackendUnavailable)) {
          setRoute('error', null, 'Route request failed. Please try again.');
          return;
        }
        const s = useAppStore.getState();
        if (s.backendOnline !== false && s.health) setHealth(s.health, false);
        const fb = await loadFallback();
        const near = fb && nearestFallback(fb, start, goal);
        if (id !== seq.current) return;
        if (near && near.response.status === 'ok') {
          setRoute('ok', near.response, 'Route service is offline. Showing the closest precomputed route.',
                   'fallback', near.name);
        } else {
          setRoute('error', null, 'Route service is offline and no precomputed route is available.');
        }
      }
    })();
  }, [start, goal, maxSlopeDeg, speedFlatMS, setRoute, setHealth]);
}
