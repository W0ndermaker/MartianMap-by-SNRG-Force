// On-map controls and status (developer A): hints, route state, layer toggles, legends, credits.
// Side panels and charts belong to other developers; this stays compact and over the map.

import type { FallbackRoute } from '../api/client';
import { useAppStore, type LayerId } from '../store/appStore';
import { ELEVATION_RAMP, SLOPE_RAMP, rampCss } from './demOverlays';
import type { TerrainMode } from './MapView';
import { BAND_SPLIT } from './routeGeometry';

interface Props {
  mode: TerrainMode;
  ionAvailable: boolean;
  onModeChange: (m: TerrainMode) => void;
  terrainNote: string | null;
  elevRange: [number, number] | null;
  notice: string | null;
  onDismissNotice: () => void;
  flying: boolean;
  onFlyover: () => void;
  onHome: () => void;
  fallbackRoutes: FallbackRoute[];
  onPickFallback: (r: FallbackRoute) => void;
}

const LAYER_LABELS: { id: LayerId; label: string; hint: string }[] = [
  { id: 'elevation', label: 'Elevation', hint: 'USGS HiRISE DEM, ~10 m grid' },
  { id: 'slope', label: 'Slope', hint: 'Computed from the HiRISE DEM' },
  { id: 'thermal', label: 'Thermal (THEMIS day IR)', hint: 'Mars Odyssey THEMIS, 100 m' },
  { id: 'geology', label: 'Geology (USGS SIM 3292)', hint: 'Global geologic map, 1:20M' },
  { id: 'curiosity', label: 'Curiosity path', hint: 'NASA/JPL rover traverse' },
];

const panel = 'pointer-events-auto rounded-xl border border-white/10 bg-neutral-950/80 text-neutral-100 shadow-lg backdrop-blur';

function fmt(v: number | null | undefined, digits = 0, unit = ''): string {
  return v == null || Number.isNaN(v) ? '—' : `${v.toFixed(digits)}${unit}`;
}

export default function MapHud(p: Props) {
  const health = useAppStore((s) => s.health);
  const backendOnline = useAppStore((s) => s.backendOnline);
  const start = useAppStore((s) => s.start);
  const goal = useAppStore((s) => s.goal);
  const route = useAppStore((s) => s.route);
  const routePhase = useAppStore((s) => s.routePhase);
  const routeMessage = useAppStore((s) => s.routeMessage);
  const routeSource = useAppStore((s) => s.routeSource);
  const routeLabel = useAppStore((s) => s.routeLabel);
  const layers = useAppStore((s) => s.layers);
  const toggleLayer = useAppStore((s) => s.toggleLayer);
  const resetPoints = useAppStore((s) => s.resetPoints);
  const maxSlopeDeg = useAppStore((s) => s.maxSlopeDeg);
  const setMaxSlopeDeg = useAppStore((s) => s.setMaxSlopeDeg);

  const hint = !health
    ? 'Loading the working area…'
    : !start
      ? 'Click inside the dashed frame to set the Start point.'
      : !goal
        ? 'Click to set the Goal point.'
        : routePhase === 'loading'
          ? 'Planning a route around steep slopes…'
          : 'Click again to start a new route.';

  const isError = routePhase === 'no_route' || routePhase === 'out_of_bounds' || routePhase === 'error';
  const mid = Math.round(maxSlopeDeg * BAND_SPLIT.mid);
  const high = Math.round(maxSlopeDeg * BAND_SPLIT.high);

  return (
    <div className="pointer-events-none absolute inset-0 flex select-none flex-col justify-between p-3 text-sm">
      {/* top row */}
      <div className="flex items-start justify-between gap-3">
        <div className={`${panel} max-w-md px-4 py-3`}>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-base font-semibold tracking-wide">Martian Map · Gale crater</h1>
            {backendOnline === false && (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">Offline · precomputed routes</span>
            )}
            {health?.terrain === 'synthetic' && (
              <span className="rounded-full bg-fuchsia-500/25 px-2 py-0.5 text-xs font-medium text-fuchsia-200">Synthetic terrain (demo)</span>
            )}
          </div>
          <p className="mt-1 flex items-center gap-2 text-neutral-300">
            {routePhase === 'loading' && (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" aria-label="Loading" />
            )}
            {hint}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button className="rounded-md bg-white/10 px-3 py-1 hover:bg-white/20 disabled:opacity-40" onClick={resetPoints}
              disabled={!start && !goal}>Reset points</button>
            <button className="rounded-md bg-sky-600 px-3 py-1 font-medium hover:bg-sky-500 disabled:opacity-40" onClick={p.onFlyover}
              disabled={routePhase !== 'ok' || !route?.path}>{p.flying ? 'Stop flyover' : 'Flyover'}</button>
            <button className="rounded-md bg-white/10 px-3 py-1 hover:bg-white/20" onClick={p.onHome}>Home view</button>
            <label className="flex items-center gap-1 text-neutral-300" title="Steeper cells are impassable for the route planner. Default 20° from the API contract (model assumption).">
              Max slope
              <select className="rounded bg-white/10 px-1 py-0.5" value={maxSlopeDeg}
                onChange={(e) => setMaxSlopeDeg(Number(e.target.value))}>
                {[10, 15, 20, 25, 30].map((v) => <option key={v} value={v} className="bg-neutral-900">{v}°</option>)}
              </select>
            </label>
          </div>
          {p.ionAvailable && (
            <div className="mt-2 flex items-center gap-2 text-xs text-neutral-300">
              Terrain:
              {(['local', 'ion'] as const).map((m) => (
                <button key={m} onClick={() => p.onModeChange(m)}
                  className={`rounded px-2 py-0.5 ${p.mode === m ? 'bg-sky-600 text-white' : 'bg-white/10 hover:bg-white/20'}`}>
                  {m === 'local' ? 'HiRISE local' : 'Cesium Mars'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* layers */}
        <div className={`${panel} w-64 px-4 py-3`}>
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-400">Layers</h2>
          <p className="mb-2 text-xs text-neutral-400">Base: HiRISE + CTX imagery on MOLA</p>
          {LAYER_LABELS.map((l) => (
            <label key={l.id} className="flex cursor-pointer items-start gap-2 py-0.5" title={l.hint}>
              <input type="checkbox" className="mt-0.5 accent-sky-500" checked={layers[l.id]} onChange={() => toggleLayer(l.id)} />
              <span>{l.label}</span>
            </label>
          ))}
          {layers.elevation && p.elevRange && (
            <div className="mt-2">
              <div className="h-2 rounded" style={{ background: rampCss(ELEVATION_RAMP) }} />
              <div className="flex justify-between text-xs text-neutral-400">
                <span>{Math.round(p.elevRange[0])} m</span><span>{Math.round(p.elevRange[1])} m</span>
              </div>
            </div>
          )}
          {layers.slope && (
            <div className="mt-2">
              <div className="h-2 rounded" style={{ background: rampCss(SLOPE_RAMP) }} />
              <div className="flex justify-between text-xs text-neutral-400"><span>0°</span><span>15°</span><span>30°</span><span>45°+</span></div>
              <p className="text-[11px] leading-tight text-neutral-500">~20 m baseline: boulder-scale steps are smoothed.</p>
            </div>
          )}
          {layers.curiosity && (
            <div className="mt-2 flex items-center gap-2 text-xs text-neutral-400">
              <span className="inline-block h-1 w-6 rounded bg-[#ff7b39]" /> Curiosity traverse
            </div>
          )}
        </div>
      </div>

      {/* bottom area */}
      <div className="flex flex-col gap-2">
        {(p.notice || (isError && routeMessage)) && (
          <div className={`${panel} flex items-start gap-3 self-center border-red-400/40 px-4 py-2`} role="alert">
            <span className="text-red-300">{p.notice ?? routeMessage}</span>
            {p.notice && <button className="text-neutral-400 hover:text-white" onClick={p.onDismissNotice} aria-label="Dismiss">✕</button>}
          </div>
        )}

        {backendOnline === false && p.fallbackRoutes.length > 0 && (
          <div className={`${panel} flex flex-wrap items-center gap-2 self-center px-4 py-2`}>
            <span className="text-neutral-300">Precomputed routes:</span>
            {p.fallbackRoutes.map((r) => (
              <button key={r.id} className="rounded-md bg-white/10 px-2 py-0.5 hover:bg-white/20" onClick={() => p.onPickFallback(r)}>{r.name}</button>
            ))}
          </div>
        )}

        {routePhase === 'ok' && route && (
          <div className={`${panel} flex flex-wrap items-center gap-x-5 gap-y-1 self-center px-4 py-2`}>
            {routeSource === 'fallback' && (
              <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">Precomputed{routeLabel ? `: ${routeLabel}` : ''}</span>
            )}
            <span>Distance <b>{fmt(route.distance_m != null ? route.distance_m / 1000 : null, 2, ' km')}</b></span>
            <span>Time <b>{fmt(route.duration_min, 0, ' min')}</b></span>
            <span>O₂ used <b>{fmt(route.o2_used_pct, 0, '%')}</b></span>
            <span>Max slope <b>{fmt(route.max_slope_deg, 1, '°')}</b></span>
            <span>Climb <b>{fmt(route.ascent_m, 0, ' m')}</b> / descent <b>{fmt(route.descent_m, 0, ' m')}</b></span>
            <span className="flex items-center gap-2 text-xs text-neutral-400" title="Bands are relative to the max slope limit; the split points are a display convention (model assumption).">
              <i className="inline-block h-1.5 w-4 rounded bg-[#2ea043]" />&lt;{mid}°
              <i className="inline-block h-1.5 w-4 rounded bg-[#f0b429]" />{mid}–{high}°
              <i className="inline-block h-1.5 w-4 rounded bg-[#e5484d]" />&gt;{high}°
              <span className="text-neutral-500">(model assumption)</span>
            </span>
          </div>
        )}

        <footer className={`${panel} self-stretch px-3 py-1.5 text-[11px] leading-snug text-neutral-400`}>
          Imagery and data: NASA/JPL/University of Arizona (HiRISE) · NASA/JPL/MSSS (CTX) · NASA/JPL/ASU (THEMIS) ·
          NASA/GSFC (MOLA) · ESA/DLR/FU Berlin (HRSC) · USGS Astrogeology (DEMs, SIM 3292 geologic map) ·
          Curiosity traverse NASA/JPL-Caltech · tiles via NASA Mars Trek (trek.nasa.gov).
          {p.terrainNote && <span className="block text-neutral-500">{p.terrainNote}</span>}
        </footer>
      </div>
    </div>
  );
}
