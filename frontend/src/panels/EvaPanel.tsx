import { useAppStore } from '../store/useAppStore'
import { fmt, fmtDistance, fmtDuration } from './format'

function Metric({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-lg bg-stone-800/70 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-stone-400">{label}</div>
      <div className={`text-lg font-semibold ${warn ? 'text-amber-300' : 'text-stone-50'}`}>
        {value}
      </div>
    </div>
  )
}

export function EvaPanel() {
  const start = useAppStore((s) => s.start)
  const goal = useAppStore((s) => s.goal)
  const route = useAppStore((s) => s.route)
  const state = useAppStore((s) => s.routeState)
  const clearRoute = useAppStore((s) => s.clearRoute)

  let body
  if (!start) body = <Hint text="Click the map to set a start point." />
  else if (!goal) body = <Hint text="Now click the map to set the goal." />
  else if (state === 'loading' && !route) body = <Hint text="Planning route…" />
  else if (state === 'error') body = <Hint tone="error" text="Route planning failed. Try again." />
  else if (route && route.status !== 'ok')
    body = (
      <Hint
        tone="error"
        text={
          route.reason ??
          (route.status === 'out_of_bounds'
            ? 'A point is outside the working area.'
            : 'No passable route.')
        }
      />
    )
  else if (route) {
    const o2 = route.o2_used_pct
    body = (
      <div className={`grid grid-cols-2 gap-2 ${state === 'loading' ? 'opacity-60' : ''}`}>
        <Metric label="Distance" value={fmtDistance(route.distance_m)} />
        <Metric label="Time" value={fmtDuration(route.duration_min)} />
        <Metric label="Oxygen used" value={fmt(o2, 0, '%')} warn={o2 != null && o2 > 50} />
        <Metric label="Max slope" value={fmt(route.max_slope_deg, 1, '°')} />
        <Metric label="Ascent" value={fmt(route.ascent_m, 0, 'm')} />
        <Metric label="Descent" value={fmt(route.descent_m, 0, 'm')} />
        {o2 != null && o2 > 50 && (
          <p className="col-span-2 text-xs text-amber-300">
            Round trip needs more than the full oxygen supply.
          </p>
        )}
        {route.hazards && route.hazards.length > 0 && (
          <ul className="col-span-2 space-y-1 text-xs text-red-300">
            {route.hazards.slice(0, 4).map((h, i) => (
              <li key={i}>⚠ {h.note}</li>
            ))}
            {route.hazards.length > 4 && <li>…and {route.hazards.length - 4} more</li>}
          </ul>
        )}
      </div>
    )
  }

  return (
    <section aria-label="EVA summary" className="rounded-xl bg-stone-900/80 p-4 ring-1 ring-white/10">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-orange-300">EVA plan</h2>
        {start && (
          <button
            type="button"
            onClick={clearRoute}
            className="text-xs text-stone-400 hover:text-stone-100"
          >
            Clear
          </button>
        )}
      </div>
      {body}
    </section>
  )
}

function Hint({ text, tone = 'muted' }: { text: string; tone?: 'muted' | 'error' }) {
  return <p className={`text-sm ${tone === 'error' ? 'text-red-300' : 'text-stone-400'}`}>{text}</p>
}
