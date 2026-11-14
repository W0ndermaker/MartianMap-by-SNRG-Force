// On-map controls of the 3D map (design/reference/Main.dc.html): layers menu, home view, terrain
// mode, vertical exaggeration, notices, legend, flyover and data credits, on translucent panels.

import { useState } from 'react'
import { LayerControls } from '../panels/LayerControls'
import { useAppStore } from '../store/useAppStore'
import { useCopilotStore } from '../store/useCopilotStore'
import { VERTICAL_EXAGGERATION } from './style'
import { ELEVATION_RAMP, SLOPE_RAMP, rampCss } from './demOverlays'
import { useMapStore, type MapLayerId } from './mapStore'
import type { TerrainMode } from './MapView'

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

/** Panels over the map: translucent dark glass with background blur (Main.dc.html). */
const glass = 'pointer-events-auto rounded-card bg-glass text-text-2 backdrop-blur-[10px]'
const glassButton =
  'pointer-events-auto inline-flex min-h-(--size-tap) items-center rounded-[10px] border border-line-strong bg-glass px-4 text-sm font-medium text-text backdrop-blur-[10px] hover:border-route disabled:opacity-40'

export default function MapHud(p: Props) {
  const layers = useMapStore((s) => s.layers)
  const toggleLayer = useMapStore((s) => s.toggleLayer)
  const tint = useMapStore((s) => s.tint)
  const setTint = useMapStore((s) => s.setTint)
  const maxSlopeDeg = useAppStore((s) => s.maxSlopeDeg)
  const appLayers = useAppStore((s) => s.layers)
  const copilotState = useCopilotStore((s) => s.state)
  const scenario = useCopilotStore((s) => s.scenario)
  const index = useCopilotStore((s) => s.index)
  const [menuOpen, setMenuOpen] = useState(false)
  const demo = (copilotState === 'playing' || copilotState === 'done') && scenario
  const turned = demo && scenario.steps[Math.min(index, scenario.steps.length - 1)].phase === 'back'

  return (
    <div className="pointer-events-none absolute inset-0 select-none p-5 text-[13px]">
      {/* top left: camera and layers */}
      <div className="absolute left-5 top-5 flex flex-col items-start gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={glassButton}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
          >
            Layers
          </button>
          <button type="button" className={glassButton} onClick={p.onHome}>
            Home view
          </button>
          {p.ionAvailable &&
            (['local', 'ion'] as const).map((m) => (
              <button
                type="button"
                key={m}
                onClick={() => p.onModeChange(m)}
                aria-pressed={p.mode === m}
                className={`${glassButton} ${p.mode === m ? 'border-route text-route' : ''}`}
              >
                {m === 'local' ? 'HiRISE terrain' : 'Cesium Mars'}
              </button>
            ))}
        </div>
        {(p.routeLoading || p.tilesPending > 0) && (
          <div className={`${glass} flex flex-col gap-1 px-3 py-2 font-mono text-xs`}>
            {p.routeLoading && <span>Planning route…</span>}
            {p.tilesPending > 0 && <span>Loading imagery ({p.tilesPending} tiles)</span>}
          </div>
        )}
        {menuOpen && (
          <div className={`${glass} max-h-[60vh] w-72 overflow-y-auto px-4 py-3`}>
            <LayerControls />
            <span className="mt-3 block font-mono text-label uppercase text-muted">Map layers</span>
            <label
              className="flex min-h-(--size-tap) cursor-pointer items-center gap-2.5"
              title="HiRISE and CTX are grayscale. The tint maps gray levels to a Mars palette; it is not true colour."
            >
              <input type="checkbox" className="h-[18px] w-[18px] accent-route" checked={tint} onChange={() => setTint(!tint)} />
              <span>
                Mars colour tint <span className="text-muted">(visual, not true colour)</span>
              </span>
            </label>
            {MAP_LAYERS.map((l) => (
              <label key={l.id} className="flex min-h-(--size-tap) cursor-pointer items-center gap-2.5" title={l.hint}>
                <input
                  type="checkbox"
                  className="h-[18px] w-[18px] accent-route"
                  checked={layers[l.id]}
                  onChange={() => toggleLayer(l.id)}
                />
                <span>{l.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* top right: vertical exaggeration */}
      <div className={`${glass} absolute right-5 top-20 px-3 py-2 font-mono text-[11px] tracking-[0.08em] sm:top-5`}>
        TERRAIN ×{VERTICAL_EXAGGERATION} VERTICAL
      </div>

      {/* notice under the alert banner */}
      {p.notice && (
        <div className={`${glass} absolute left-1/2 top-20 flex -translate-x-1/2 items-center gap-3 px-4 py-2`} role="status">
          <span className="text-text">{p.notice}</span>
          <button
            type="button"
            className="min-h-(--size-tap) min-w-(--size-tap) text-muted hover:text-text"
            onClick={p.onDismissNotice}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* bottom left: legend */}
      <div className={`${glass} absolute bottom-14 left-5 flex flex-col gap-2.5 p-4`} aria-label="Map legend">
        {demo ? (
          <>
            <Legend swatch={<span className="h-1 w-6 rounded-sm bg-route" />}>
              {turned ? 'Return route to base' : 'EVA route'}
            </Legend>
            {turned && (
              <Legend swatch={<span className="w-6 border-t-[3px] border-dotted border-text/50" />}>Cancelled leg</Legend>
            )}
          </>
        ) : (
          <>
            {appLayers.route && <Legend swatch={<span className="h-1 w-6 rounded-sm bg-route" />}>Safe route</Legend>}
            {appLayers.straight && (
              <Legend swatch={<span className="w-6 border-t-2 border-dashed border-white" />}>Straight line</Legend>
            )}
            {appLayers.reach && (
              <Legend swatch={<span className="w-6 border-t-2 border-dotted border-text/70" />}>Walk-back rings</Legend>
            )}
            {appLayers.hazards && (
              <Legend
                swatch={
                  <span className="text-caution">
                    <svg aria-hidden="true" width="24" height="16" viewBox="0 0 24 16">
                      <path d="M12 1 L22 15 L2 15 Z" fill="currentColor" />
                    </svg>
                  </span>
                }
              >
                Steep section
              </Legend>
            )}
          </>
        )}
        {layers.nogo && (
          <Legend swatch={<span className="h-2.5 w-6 rounded-sm bg-alert/75" />}>No-go: steeper than {maxSlopeDeg}°</Legend>
        )}
        {layers.elevation && p.elevRange && (
          <div className="flex flex-col gap-1">
            <div className="h-2 w-40 rounded" style={{ background: rampCss(ELEVATION_RAMP) }} />
            <div className="flex justify-between font-mono text-[11px] text-muted">
              <span>{Math.round(p.elevRange[0])} m</span>
              <span>{Math.round(p.elevRange[1])} m</span>
            </div>
          </div>
        )}
        {layers.slope && (
          <div className="flex flex-col gap-1">
            <div className="h-2 w-40 rounded" style={{ background: rampCss(SLOPE_RAMP) }} />
            <div className="flex justify-between font-mono text-[11px] text-muted">
              <span>0°</span>
              <span>15°</span>
              <span>30°</span>
              <span>45°+</span>
            </div>
            <span className="text-[11px] text-muted">~20 m baseline: boulder-scale steps are smoothed.</span>
          </div>
        )}
      </div>

      {/* bottom right: flyover */}
      <div className="absolute bottom-14 right-5 flex gap-2">
        <button
          type="button"
          className={glassButton}
          onClick={p.onFlyover}
          disabled={!p.canFly}
          title="Camera follows the route from start to goal"
        >
          {p.flying ? 'Stop flyover' : 'Flyover'}
        </button>
      </div>

      {/* bottom: data credits */}
      <details className={`${glass} group absolute bottom-3 left-5 right-5 px-3 py-1 text-[11px] leading-snug text-muted`}>
        <summary className="cursor-pointer list-none truncate marker:hidden">
          Data: NASA Mars Trek (Viking, HiRISE, CTX, THEMIS, MOLA), USGS Astrogeology ·{' '}
          <span className="text-text-2 underline decoration-dotted group-open:hidden">credits</span>
        </summary>
        Imagery: NASA/JPL/USGS (Viking MDIM 2.1) · NASA/JPL/University of Arizona (HiRISE) · NASA/JPL/MSSS (CTX) ·
        NASA/JPL/ASU (THEMIS) · NASA/GSFC (MOLA) · USGS (SIM 3292), via NASA Mars Trek. Terrain: USGS Astrogeology
        DEMs (HiRISE, HRSC-MOLA; ESA/DLR/FU Berlin).
        {p.terrainNote && <span className="block">{p.terrainNote}</span>}
      </details>
    </div>
  )
}

function Legend({ swatch, children }: { swatch: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex w-6 items-center justify-center">{swatch}</span>
      {children}
    </div>
  )
}
