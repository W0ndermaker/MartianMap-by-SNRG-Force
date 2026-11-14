import { useAppStore, type Layers } from '../store/useAppStore'
import { Label } from './ui'

const LAYER_LABEL: Record<keyof Layers, string> = {
  route: 'Planned route',
  hazards: 'Steep sections',
  poi: 'Points of interest',
  traverse: 'Curiosity traverse',
  reach: 'Walk-back rings from base',
  straight: 'Straight line vs route',
}

/** Switches for the map layers of the shared store. */
export function LayerControls() {
  const layers = useAppStore((s) => s.layers)
  const toggleLayer = useAppStore((s) => s.toggleLayer)
  return (
    <fieldset className="flex flex-col">
      <legend className="mb-1">
        <Label>Layers</Label>
      </legend>
      {(Object.keys(LAYER_LABEL) as (keyof Layers)[]).map((key) => (
        <label key={key} className="flex min-h-(--size-tap) cursor-pointer items-center gap-2.5 text-sm text-text-2">
          <input
            type="checkbox"
            checked={layers[key]}
            onChange={() => toggleLayer(key)}
            className="h-[18px] w-[18px] accent-route"
          />
          {LAYER_LABEL[key]}
        </label>
      ))}
    </fieldset>
  )
}
