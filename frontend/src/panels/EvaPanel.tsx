import { useEffect, useState } from 'react'
import { OFFLINE_LOAD_REASON, OFFLINE_ROUTE_REASON, offlineDemoPairs } from '../api/offline'
import type { LonLat, Verdict } from '../api/types'
import { useMapStore } from '../map/mapStore'
import { useAppStore } from '../store/useAppStore'
import { fmt, fmtDistance, fmtDuration } from './format'

// Safety colours from the project brief: red and green get lost on the rust-coloured map.
const VERDICT_STYLE: Record<Verdict, string> = {
  go: 'bg-cyan-400/15 text-cyan-200 ring-cyan-300/50',
  caution: 'bg-yellow-100/10 text-yellow-100 ring-yellow-100/50',
  no_go: 'bg-fuchsia-500/20 text-fuchsia-200 ring-fuchsia-400/60',
}

/** The whole oxygen supply in percent (definition of the API's oxygen fields). */
const O2_SUPPLY_PCT = 100

const VERDICT_LABEL: Record<Verdict, string> = {
  go: 'GO',
  caution: 'CAUTION',
  no_go: 'NO-GO',
}

function Metric({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-lg bg-stone-800/70 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-stone-400">{label}</div>
      <div className={`text-lg font-semibold ${warn ? 'text-fuchsia-300' : 'text-stone-50'}`}>
        {value}
      </div>
    </div>
  )
}

function VerdictBanner({
  verdict,
  reasons,
  stale,
}: {
  verdict: Verdict
  reasons: string[]
  stale: boolean
}) {
  // A verdict from before the connection was lost is grey, never green or cyan.
  const style = stale ? 'bg-stone-700/40 text-stone-300 ring-stone-500/60' : VERDICT_STYLE[verdict]
  return (
    <div className={`col-span-2 rounded-lg px-3 py-2 ring-1 ${style}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-base font-bold tracking-wide">{VERDICT_LABEL[verdict]}</span>
        <span className="text-[10px] uppercase tracking-wide opacity-70">
          {stale ? 'Last known — may be outdated' : 'planning estimate'}
        </span>
      </div>
      {reasons.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-xs">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

type DemoPair = { start: LonLat; goal: LonLat; max_slope_deg: number }

/** Offline: the precomputed routes are the only ones available, so offer them as buttons. */
function DemoRoutes() {
  const showDemo = useAppStore((s) => s.showDemo)
  const poi = useAppStore((s) => s.poi)
  const [pairs, setPairs] = useState<DemoPair[]>([])
  useEffect(() => {
    void offlineDemoPairs().then(setPairs)
  }, [])

  const name = (p: LonLat) =>
    poi?.features.find(
      (f) => f.geometry.coordinates[0] === p[0] && f.geometry.coordinates[1] === p[1],
    )?.properties.name ?? `${p[0].toFixed(3)}, ${p[1].toFixed(3)}`

  return (
    <div className="mt-3 space-y-1.5">
      <p className="text-[11px] uppercase tracking-wide text-stone-400">Demo routes (offline)</p>
      {pairs.map((pair, i) => (
        <button
          key={i}
          type="button"
          onClick={() => showDemo(pair)}
          className="block w-full rounded-md bg-stone-800/70 px-2 py-1.5 text-left text-xs text-stone-200 hover:bg-stone-700"
        >
          {name(pair.start)} → {name(pair.goal)}{' '}
          <span className="text-stone-400">· max {pair.max_slope_deg}°</span>
        </button>
      ))}
    </div>
  )
}

export function EvaPanel() {
  const start = useAppStore((s) => s.start)
  const goal = useAppStore((s) => s.goal)
  const route = useAppStore((s) => s.route)
  const state = useAppStore((s) => s.routeState)
  const offline = useAppStore((s) => s.offline)
  const routeStale = useAppStore((s) => s.routeStale)
  const clearRoute = useAppStore((s) => s.clearRoute)
  const straight = useMapStore((s) => s.straight)
  const maxSlopeDeg = useAppStore((s) => s.maxSlopeDeg)

  let body
  if (!start) body = <Hint text="Click the map to set a start point." />
  else if (!goal) body = <Hint text="Now click the map to set the goal." />
  else if (state === 'loading' && !route) body = <Hint text="Planning route and the way back…" />
  else if (state === 'error') body = <Hint tone="error" text="Route planning failed. Try again." />
  else if (route && route.status !== 'ok')
    body = (
      <Hint
        tone={route.reason === OFFLINE_ROUTE_REASON || route.reason === OFFLINE_LOAD_REASON ? 'muted' : 'error'}
        text={
          route.reason ??
          (route.status === 'out_of_bounds'
            ? 'A point is outside the working area.'
            : 'No passable route.')
        }
      />
    )
  else if (route) {
    // Show the reserve as "100 − rounded round trip" so the two tiles always add up to 100 %.
    const roundTrip = route.round_trip_o2_used_pct
    const reserve =
      roundTrip === null || roundTrip === undefined || route.o2_reserve_pct == null
        ? route.o2_reserve_pct
        : O2_SUPPLY_PCT - Math.round(roundTrip)
    body = (
      <div className={`grid grid-cols-2 gap-2 ${state === 'loading' ? 'opacity-60' : ''}`}>
        {route.verdict && (
          <VerdictBanner
            verdict={route.verdict}
            reasons={route.verdict_reasons ?? []}
            stale={routeStale}
          />
        )}
        <Metric label="Distance" value={fmtDistance(route.distance_m)} />
        <Metric label="Time out" value={fmtDuration(route.duration_min)} />
        <Metric label="Time back" value={fmtDuration(route.return_duration_min)} />
        <Metric label="Max slope" value={fmt(route.max_slope_deg, 1, '°')} />
        <Metric
          label="O₂ round trip"
          value={fmt(route.round_trip_o2_used_pct ?? route.o2_used_pct, 0, '%')}
        />
        <Metric
          label="O₂ reserve"
          value={fmt(reserve, 0, '%')}
          warn={reserve !== null && reserve !== undefined && reserve < 0}
        />
        <Metric
          label="EVA dose"
          value={route.eva_dose_usv == null ? 'No data' : fmt(route.eva_dose_usv, 0, 'µSv')}
        />
        <Metric label="Ascent" value={fmt(route.ascent_m, 0, 'm')} />
        <Metric label="Descent" value={fmt(route.descent_m, 0, 'm')} />
        {straight && (
          <p
            className={`col-span-2 rounded-lg px-3 py-2 text-xs ring-1 ${
              straight.steepM > 0
                ? 'bg-fuchsia-500/10 text-fuchsia-200 ring-fuchsia-400/40'
                : 'bg-stone-800/70 text-stone-300 ring-white/10'
            }`}
          >
            {straight.steepM > 0
              ? `Walking straight there crosses ${fmt(straight.steepM, 0, 'm')} steeper than ${maxSlopeDeg}° (up to ${fmt(straight.maxSlopeDeg, 0, '°')}). The route goes around.`
              : `The straight line stays within ${maxSlopeDeg}° here; the route follows easier ground.`}
          </p>
        )}
        {route.hazards && route.hazards.length > 0 && (
          <ul className="col-span-2 space-y-1 text-xs text-fuchsia-300">
            {route.hazards.slice(0, 4).map((h, i) => (
              <li key={i}>⚠ {h.note}</li>
            ))}
            {route.hazards.length > 4 && <li>…and {route.hazards.length - 4} more</li>}
          </ul>
        )}
        <p className="col-span-2 text-[11px] leading-snug text-stone-500">
          Estimates: walking speed from Tobler&apos;s hiking function and oxygen as a share of an
          7-hour EMU suit supply with a 30-min reserve (Earth-based assumptions); slope on a 10 m grid.
        </p>
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
      {offline && <DemoRoutes />}
    </section>
  )
}

function Hint({ text, tone = 'muted' }: { text: string; tone?: 'muted' | 'error' }) {
  return <p className={`text-sm ${tone === 'error' ? 'text-red-300' : 'text-stone-400'}`}>{text}</p>
}
