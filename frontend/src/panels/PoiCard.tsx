import type { PoiKind } from '../api/types'
import { useAppStore } from '../store/useAppStore'

const POI_KIND_LABEL: Record<PoiKind, string> = {
  science: 'Science target',
  base: 'Base',
  rover_stop: 'Rover stop',
}

export function PoiCard() {
  const poi = useAppStore((s) => s.poi)
  const selectedId = useAppStore((s) => s.selectedPoiId)
  const selectPoi = useAppStore((s) => s.selectPoi)
  const routeToPoi = useAppStore((s) => s.routeToPoi)
  const feature = poi?.features.find((f) => f.properties.id === selectedId)

  if (!feature) {
    return (
      <section className="rounded-xl bg-stone-900/80 p-4 text-sm text-stone-400 ring-1 ring-white/10">
        {poi ? 'Select a point of interest on the map.' : 'Loading points of interest…'}
      </section>
    )
  }

  const p = feature.properties
  return (
    <section
      aria-label="Point of interest"
      className="overflow-hidden rounded-xl bg-stone-900/80 ring-1 ring-white/10"
    >
      {p.photo_url ? (
        <figure>
          <img src={p.photo_url} alt={p.name} className="h-36 w-full object-cover" loading="lazy" />
          {p.photo_credit && (
            <figcaption className="px-4 pt-1 text-[10px] text-stone-500">
              Photo: {p.photo_credit}
            </figcaption>
          )}
        </figure>
      ) : (
        <div className="flex h-20 items-center justify-center bg-stone-800 text-xs text-stone-500">
          No photo
        </div>
      )}
      <div className="p-4 pt-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-orange-300">
              {POI_KIND_LABEL[p.kind]}
            </div>
            <h3 className="font-semibold text-stone-50">{p.name}</h3>
          </div>
          <button
            type="button"
            onClick={() => selectPoi(null)}
            className="text-stone-500 hover:text-stone-200"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <p className="mt-1 text-sm text-stone-300">{p.description}</p>
        <button
          type="button"
          onClick={() => routeToPoi(p.id)}
          className="mt-3 w-full rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-stone-950 hover:bg-orange-400"
        >
          Route here
        </button>
      </div>
    </section>
  )
}
