// On-map controls of the 3D map (developer A): camera actions, map-only layers and legends, status, credits.
// EVA metrics, POI cards, the profile chart and the route/hazard/POI/traverse switches are in the side panels
// (developer C), so they are not repeated here.

import { useAppStore } from '../store/useAppStore'
import { ELEVATION_RAMP, SLOPE_RAMP, rampCss } from './demOverlays'
import { useMapStore, type MapLayerId } from './mapStore'
import type { TerrainMode } from './MapView'
import { BAND_SPLIT } from './routeGeometry'

interface Props {
  mode: TerrainMode
  ionAvailable: boolean
  onModeChange: (m: TerrainMode) => void
  terrainNote: string | null
  elevRange: [number, number] | null
  notice: string | null
  onDismissNotice: () => void
  flying: boolean
  canFly: boolean
  onFlyover: () => void
  onHome: () => void
  routeLoading: boolean
  hasRoute: boolean
  tilesPending: number
}

const MAP_LAYERS: { id: MapLayerId; label: string; hint: string }[] = [
  { id: 'nogo', label: 'No-go zones (steeper than max slope)', hint: 'Cells the route planner treats as impassable at the current max slope' },
  { id: 'elevation', label: 'Elevation', hint: 'USGS HiRISE DEM, ~10 m grid' },
  { id: 'slope', label: 'Slope', hint: 'Computed from the HiRISE DEM' },
  { id: 'thermal', label: 'Thermal (THEMIS day IR)', hint: 'Mars Odyssey THEMIS, 100 m' },
  { id: 'geology', label: 'Geology (USGS SIM 3292)', hint: 'Global geologic map, 1:20M' },
  { id: 'mola', label: 'MOLA shaded relief', hint: 'MGS MOLA colour hillshade, 463 m' },
]

const panel =
  'pointer-events-auto rounded-lg border border-white/10 bg-stone-950/80 text-stone-100 shadow-lg backdrop-blur'

export default function MapHud(p: Props) {
  const layers = useMapStore((s) => s.layers)
  const toggleLayer = useMapStore((s) => s.toggleLayer)
  const tint = useMapStore((s) => s.tint)
  const setTint = useMapStore((s) => s.setTint)
  const maxSlopeDeg = useAppStore((s) => s.maxSlopeDeg)
  const mid = Math.round(maxSlopeDeg * BAND_SPLIT.mid)
  const high = Math.round(maxSlopeDeg * BAND_SPLIT.high)

  return (
    <div className="pointer-events-none absolute inset-0 flex select-none flex-col justify-between p-2 text-xs">
      <div className="flex items-start justify-between gap-2">
        {/* camera + status */}
        <div className={`${panel} flex flex-col gap-1.5 px-2.5 py-2`}>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className="rounded-md bg-orange-600 px-2.5 py-1 font-medium hover:bg-orange-500 disabled:opacity-40"
              onClick={p.onFlyover}
              disabled={!p.canFly}
              title="Camera follows the route from start to goal"
            >
              {p.flying ? 'Stop flyover' : 'Flyover'}
            </button>
            <button type="button" className="rounded-md bg-white/10 px-2.5 py-1 hover:bg-white/20" onClick={p.onHome}>
              Home view
            </button>
            {p.ionAvailable &&
              (['local', 'ion'] as const).map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => p.onModeChange(m)}
                  className={`rounded-md px-2 py-1 ${p.mode === m ? 'bg-sky-700' : 'bg-white/10 hover:bg-white/20'}`}
                >
                  {m === 'local' ? 'HiRISE terrain' : 'Cesium Mars'}
                </button>
              ))}
          </div>
          {p.routeLoading && (
            <span className="flex items-center gap-2 text-sky-300">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-sky-300 border-t-transparent" />
              Planning route…
            </span>
          )}
          {p.tilesPending > 0 && (
            <span className="flex items-center gap-2 text-stone-400">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-stone-400 border-t-transparent" />
              Loading imagery ({p.tilesPending} tiles)
            </span>
          )}
        </div>

        {/* map-only layers */}
        <div className={`${panel} w-56 px-3 py-2`}>
          <div className="mb-1 text-[11px] uppercase tracking-wide text-stone-400">Map layers</div>
          <label
            className="flex cursor-pointer items-start gap-2 py-0.5"
            title="HiRISE and CTX are grayscale. The tint maps gray levels to a Mars palette; it is not true colour."
          >
            <input type="checkbox" className="mt-0.5 accent-orange-500" checked={tint} onChange={() => setTint(!tint)} />
            <span>
              Mars colour tint <span className="text-stone-500">(visual, not true colour)</span>
            </span>
          </label>
          {MAP_LAYERS.map((l) => (
            <label key={l.id} className="flex cursor-pointer items-start gap-2 py-0.5" title={l.hint}>
              <input type="checkbox" className="mt-0.5 accent-orange-500" checked={layers[l.id]} onChange={() => toggleLayer(l.id)} />
              <span>{l.label}</span>
            </label>
          ))}
          {layers.nogo && (
            <div className="mt-1 flex items-center gap-2 text-stone-400">
              <i className="inline-block h-2.5 w-4 rounded-sm bg-[#e52a2a]/75" /> steeper than {maxSlopeDeg}°
            </div>
          )}
          {layers.elevation && p.elevRange && (
            <div className="mt-1.5">
              <div className="h-2 rounded" style={{ background: rampCss(ELEVATION_RAMP) }} />
              <div className="flex justify-between text-stone-400">
                <span>{Math.round(p.elevRange[0])} m</span>
                <span>{Math.round(p.elevRange[1])} m</span>
              </div>
            </div>
          )}
          {layers.slope && (
            <div className="mt-1.5">
              <div className="h-2 rounded" style={{ background: rampCss(SLOPE_RAMP) }} />
              <div className="flex justify-between text-stone-400">
                <span>0°</span>
                <span>15°</span>
                <span>30°</span>
                <span>45°+</span>
              </div>
              <p className="text-[10px] leading-tight text-stone-500">~20 m baseline: boulder-scale steps are smoothed.</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center gap-1.5">
        {p.notice && (
          <div className={`${panel} flex items-start gap-3 border-red-400/40 px-3 py-1.5`} role="alert">
            <span className="text-red-300">{p.notice}</span>
            <button type="button" className="text-stone-400 hover:text-white" onClick={p.onDismissNotice} aria-label="Dismiss">
              ✕
            </button>
          </div>
        )}
        {p.hasRoute && (
          <div
            className={`${panel} flex items-center gap-2 px-3 py-1 text-stone-300`}
            title="Bands are relative to the max-slope limit; the split points are a display convention (model assumption)."
          >
            Route slope:
            <i className="inline-block h-1.5 w-4 rounded bg-[#2ea043]" />&lt;{mid}°
            <i className="inline-block h-1.5 w-4 rounded bg-[#f0b429]" />
            {mid}–{high}°
            <i className="inline-block h-1.5 w-4 rounded bg-[#e5484d]" />&gt;{high}°
            <span className="text-stone-500">(model assumption)</span>
          </div>
        )}
        <details className={`${panel} group self-stretch px-2.5 py-1 text-[10px] leading-snug text-stone-400`}>
          <summary className="cursor-pointer list-none truncate marker:hidden">
            Data: NASA Mars Trek (Viking, HiRISE, CTX, THEMIS, MOLA), USGS Astrogeology ·{' '}
            <span className="text-stone-300 underline decoration-dotted group-open:hidden">credits</span>
          </summary>
          Imagery: NASA/JPL/USGS (Viking MDIM 2.1) · NASA/JPL/University of Arizona (HiRISE) · NASA/JPL/MSSS (CTX) ·
          NASA/JPL/ASU (THEMIS) · NASA/GSFC (MOLA) · USGS (SIM 3292), via NASA Mars Trek. Terrain: USGS Astrogeology
          DEMs (HiRISE, HRSC-MOLA; ESA/DLR/FU Berlin).
          {p.terrainNote && <span className="block text-stone-500">{p.terrainNote}</span>}
        </details>
      </div>
    </div>
  )
}
