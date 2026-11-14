import { useEffect, useState } from 'react'
import { SLOPE_RANGE_DEG, useAppStore, type Layers } from '../store/useAppStore'

const LAYER_LABEL: Record<keyof Layers, string> = {
  route: 'Planned route',
  hazards: 'Hazards',
  poi: 'Points of interest',
  traverse: 'Curiosity traverse',
}

export function LayerControls() {
  const layers = useAppStore((s) => s.layers)
  const toggleLayer = useAppStore((s) => s.toggleLayer)
  const maxSlope = useAppStore((s) => s.maxSlopeDeg)
  const setMaxSlope = useAppStore((s) => s.setMaxSlope)
  // Local value while dragging; the route is recalculated on release.
  const [draft, setDraft] = useState(maxSlope)
  useEffect(() => setDraft(maxSlope), [maxSlope])

  const commit = () => {
    if (draft !== maxSlope) setMaxSlope(draft)
  }

  return (
    <section aria-label="Map controls" className="rounded-xl bg-stone-900/80 p-4 ring-1 ring-white/10">
      <label className="block">
        <div className="flex justify-between text-sm">
          <span className="text-stone-300">Max slope</span>
          <span className="font-semibold text-stone-50">{draft}°</span>
        </div>
        <input
          type="range"
          min={SLOPE_RANGE_DEG[0]}
          max={SLOPE_RANGE_DEG[1]}
          step={1}
          value={draft}
          onChange={(e) => setDraft(Number(e.target.value))}
          onPointerUp={commit}
          onKeyUp={commit}
          onBlur={commit}
          className="mt-1 w-full accent-orange-500"
        />
      </label>
      <fieldset className="mt-3 space-y-1">
        <legend className="mb-1 text-[11px] uppercase tracking-wide text-stone-400">Layers</legend>
        {(Object.keys(LAYER_LABEL) as (keyof Layers)[]).map((key) => (
          <label key={key} className="flex items-center gap-2 text-sm text-stone-300">
            <input
              type="checkbox"
              checked={layers[key]}
              onChange={() => toggleLayer(key)}
              className="accent-orange-500"
            />
            {LAYER_LABEL[key]}
          </label>
        ))}
      </fieldset>
    </section>
  )
}
