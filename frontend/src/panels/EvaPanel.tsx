// EVA plan panel in the planning state (design/reference/Main.dc.html): verdict, target with photo,
// metric cards, oxygen bar with the reserve mark, dose, slope limit, science gear, Start EVA.

import { useEffect, useState } from 'react'
import { OFFLINE_LOAD_REASON, OFFLINE_ROUTE_REASON, offlineDemoPairs } from '../api/offline'
import type { LonLat, PoiFeature, RouteResponse, Verdict } from '../api/types'
import { useMapStore } from '../map/mapStore'
import { SLOPE_RANGE_DEG, useAppStore } from '../store/useAppStore'
import { useCopilotStore } from '../store/useCopilotStore'
import type { Status } from '../theme'
import { StatusIcon } from '../ui/Status'
import { statusBorder, statusText, statusTint } from '../ui/statusClasses'
// Supply and reserve: data/suit_params.json (sourced, NASA OIG IG-17-018).
import suit from '@data/suit_params.json'
import { ConditionsPanel } from './ConditionsPanel'
import { fmt, hhmm } from './format'
import { Card, Label, Metric, OxygenBar } from './ui'

/** The whole oxygen supply in percent (definition of the API's oxygen fields). */
const O2_SUPPLY_PCT = 100
/** Where the 30-minute reserve starts on the oxygen bar, % of the supply. */
const RESERVE_MARK_PCT =
  O2_SUPPLY_PCT - (suit.emergency_reserve_min.value / suit.eva_max_duration_min.value) * O2_SUPPLY_PCT

const VERDICT_STATUS: Record<Verdict, Status> = { go: 'go', caution: 'caution', no_go: 'alert' }
const VERDICT_LABEL: Record<Verdict, string> = { go: 'GO', caution: 'CAUTION', no_go: 'NO-GO' }
const VERDICT_LINE: Record<Verdict, string> = {
  go: 'Safe to reach the target and walk back',
  caution: 'Possible, with the risks below',
  no_go: 'Do not start this EVA',
}

const sameLonLat = (a: LonLat, b: LonLat) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6

/** Big status block: icon + word + one line, then the reasons. */
function VerdictBlock({
  status,
  word,
  line,
  reasons,
  note,
}: {
  status: Status
  word: string
  line: string
  reasons?: string[]
  note?: string
}) {
  return (
    <div className={`flex flex-col gap-3 rounded-panel border p-5 ${statusBorder(status)} ${statusTint(status)}`}>
      <div className="flex items-center gap-4">
        <span className={statusText(status)}>
          <StatusIcon status={status} size={48} />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <span className={`text-status font-bold tracking-[0.02em] ${statusText(status)}`}>{word}</span>
          <span className="text-sm text-text-2">{line}</span>
        </div>
      </div>
      {reasons && reasons.length > 0 && (
        <ul className="flex flex-col gap-1 text-[13px] text-text-2">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      {note && <span className="font-mono text-label uppercase text-muted">{note}</span>}
    </div>
  )
}

/** The goal as a point of interest (photo, name, description), or the clicked coordinates. */
function TargetBlock({ goal, feature }: { goal: LonLat; feature: PoiFeature | undefined }) {
  const p = feature?.properties
  return (
    <div className="flex flex-col gap-2.5">
      <Label>Target</Label>
      <div className="flex items-center gap-3.5">
        {p?.photo_url ? (
          <img
            src={p.photo_url}
            alt={`Curiosity photo of ${p.name}`}
            title={p.photo_credit ? `Photo: ${p.photo_credit}` : undefined}
            className="h-[66px] w-[88px] flex-none rounded-lg object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-[66px] w-[88px] flex-none items-center justify-center rounded-lg bg-card font-mono text-[9px] text-muted">
            NO PHOTO
          </div>
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-lg font-semibold">{p?.name ?? 'Selected point'}</span>
          {p ? (
            <span className="line-clamp-3 text-[13px] leading-snug text-muted">{p.description}</span>
          ) : (
            <span className="font-mono text-[13px] text-muted">
              {goal[0].toFixed(4)}° E, {goal[1].toFixed(4)}°
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/** A point of interest picked on the map that is not the current goal: photo and "Route here". */
function PoiPick({ feature }: { feature: PoiFeature }) {
  const routeToPoi = useAppStore((s) => s.routeToPoi)
  const selectPoi = useAppStore((s) => s.selectPoi)
  const p = feature.properties
  return (
    <section aria-label="Point of interest" className="flex flex-col gap-3 rounded-card bg-card p-3.5">
      <div className="flex items-start justify-between gap-2">
        <Label>{p.kind === 'base' ? 'Base' : p.kind === 'rover_stop' ? 'Rover stop' : 'Science target'}</Label>
        <button
          type="button"
          onClick={() => selectPoi(null)}
          className="-m-2 min-h-(--size-tap) min-w-(--size-tap) text-muted hover:text-text"
          aria-label="Close"
        >
          ×
        </button>
      </div>
      {p.photo_url && (
        <figure>
          <img src={p.photo_url} alt={p.name} className="h-36 w-full rounded-lg object-cover" loading="lazy" />
          {p.photo_credit && (
            <figcaption className="pt-1 text-[11px] text-muted">Photo: {p.photo_credit}</figcaption>
          )}
        </figure>
      )}
      <span className="text-lg font-semibold">{p.name}</span>
      <p className="text-[13px] leading-snug text-text-2">{p.description}</p>
      <button
        type="button"
        onClick={() => routeToPoi(p.id)}
        className="min-h-(--size-tap) rounded-card bg-route px-4 font-semibold text-bg hover:bg-route-hover"
      >
        Route here
      </button>
    </section>
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
    poi?.features.find((f) => sameLonLat(f.geometry.coordinates, p))?.properties.name ??
    `${p[0].toFixed(3)}, ${p[1].toFixed(3)}`
  return (
    <div className="flex flex-col gap-2">
      <Label>Demo routes (offline)</Label>
      {pairs.map((pair, i) => (
        <button
          key={i}
          type="button"
          onClick={() => showDemo(pair)}
          className="min-h-(--size-tap) rounded-card border border-line-strong bg-card px-3 text-left text-[13px] text-text-2 hover:border-route"
        >
          {name(pair.start)} → {name(pair.goal)}{' '}
          <span className="font-mono text-muted">· max {pair.max_slope_deg}°</span>
        </button>
      ))}
    </div>
  )
}

/** Metric cards of a planned route. */
function RouteCards({ route }: { route: RouteResponse }) {
  const maxSlopeDeg = useAppStore((s) => s.maxSlopeDeg)
  const setMaxSlope = useAppStore((s) => s.setMaxSlope)
  const [draft, setDraft] = useState(maxSlopeDeg)
  useEffect(() => setDraft(maxSlopeDeg), [maxSlopeDeg])
  const commit = () => {
    if (draft !== maxSlopeDeg) setMaxSlope(draft)
  }

  const roundTrip = route.round_trip_o2_used_pct
  // Reserve as "100 − rounded round trip" so used and reserve always add up to 100 %.
  const reserve = roundTrip == null ? null : O2_SUPPLY_PCT - Math.round(roundTrip)
  const out = route.duration_min
  const back = route.return_duration_min
  const total = out != null && back != null ? out + back : null

  return (
    <div className="grid grid-cols-2 gap-2.5">
      <Metric
        label="Distance"
        value={route.distance_m == null ? null : fmt(route.distance_m / 1000, 1)}
        unit="km"
        sub="one way"
      />
      <Metric
        label="Round trip"
        value={hhmm(total)}
        unit="h"
        sub={
          <>
            out <span className="font-mono">{hhmm(out) ?? '—'}</span> · back{' '}
            <span className="font-mono">{hhmm(back) ?? '—'}</span>
          </>
        }
      />
      <Card wide>
        <div className="flex items-baseline justify-between">
          <Label>Oxygen — round trip</Label>
          <span className={`font-mono text-[13px] ${reserve == null ? 'text-unknown' : 'text-text-2'}`}>
            {reserve == null ? '—' : `${reserve} %`} reserve
          </span>
        </div>
        {roundTrip == null ? (
          <span className="font-mono text-number font-semibold text-unknown">—</span>
        ) : (
          <span className="font-mono text-number font-semibold">
            {Math.round(roundTrip)}
            <span className="text-sm font-normal text-muted"> % used</span>
          </span>
        )}
        <OxygenBar usedPct={roundTrip ?? 0} reserveMarkPct={RESERVE_MARK_PCT} />
        <span className="text-xs text-muted">
          Amber mark: <span className="font-mono">{suit.emergency_reserve_min.value}</span>-min safety reserve
        </span>
      </Card>
      <Metric
        label="EVA dose"
        value={route.eva_dose_usv == null ? null : `≈${fmt(route.eva_dose_usv, 0)}`}
        unit="µSv"
        sub="round trip"
      />
      <Card>
        <Label>Slope limit</Label>
        <span className="font-mono text-number font-semibold">
          {draft}
          <span className="text-sm font-normal text-muted"> °</span>
        </span>
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
          className="h-(--size-tap) w-full accent-route"
          aria-label="Maximum walkable slope"
        />
        <span className="text-xs text-muted">
          route max <span className="font-mono">{fmt(route.max_slope_deg, 1, '°')}</span>
        </span>
      </Card>
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
  const poi = useAppStore((s) => s.poi)
  const selectedPoiId = useAppStore((s) => s.selectedPoiId)
  const carryingLoad = useAppStore((s) => s.carryingLoad)
  const setCarryingLoad = useAppStore((s) => s.setCarryingLoad)
  const maxSlopeDeg = useAppStore((s) => s.maxSlopeDeg)
  const straight = useMapStore((s) => s.straight)
  const play = useCopilotStore((s) => s.play)
  const copilotState = useCopilotStore((s) => s.state)

  const goalFeature = goal ? poi?.features.find((f) => sameLonLat(f.geometry.coordinates, goal)) : undefined
  const picked = poi?.features.find((f) => f.properties.id === selectedPoiId)
  const showPick = picked && picked !== goalFeature

  let top
  if (!start)
    top = <Hint text="Pick a target on the map, or click the map to set a start point and a goal." />
  else if (!goal) top = <Hint text="Now click the map to set the goal." />
  else if (state === 'loading' && !route) top = <Hint text="Planning the route and the way back…" />
  else if (state === 'error')
    top = <VerdictBlock status="unknown" word="NO DATA" line="Route planning failed. Try again." />
  else if (route && route.status !== 'ok') {
    const offlineOnly = route.reason === OFFLINE_ROUTE_REASON || route.reason === OFFLINE_LOAD_REASON
    top = offlineOnly ? (
      <Hint text={route.reason ?? ''} />
    ) : (
      <VerdictBlock
        status="alert"
        word="NO ROUTE"
        line={
          route.reason ??
          (route.status === 'out_of_bounds' ? 'A point is outside the working area.' : 'No passable route.')
        }
      />
    )
  } else if (route?.verdict) {
    // A verdict from before the connection was lost is grey, never green.
    top = (
      <VerdictBlock
        status={routeStale ? 'unknown' : VERDICT_STATUS[route.verdict]}
        word={VERDICT_LABEL[route.verdict]}
        line={routeStale ? 'Last known — may be outdated' : VERDICT_LINE[route.verdict]}
        reasons={route.verdict_reasons ?? []}
        note={routeStale ? undefined : 'Planning estimate'}
      />
    )
  }

  const ok = route?.status === 'ok' && goal
  return (
    <section aria-label="EVA plan" className={`flex flex-col gap-4 ${state === 'loading' && route ? 'opacity-70' : ''}`}>
      <div className="flex items-center justify-between">
        <Label>EVA plan</Label>
        {start && (
          <button
            type="button"
            onClick={clearRoute}
            className="min-h-(--size-tap) px-2 text-[13px] text-muted hover:text-text"
          >
            Clear
          </button>
        )}
      </div>

      {top}
      {showPick && <PoiPick feature={picked} />}

      {ok && goal && <TargetBlock goal={goal} feature={goalFeature} />}
      {ok && route && <RouteCards route={route} />}

      {ok && straight && (
        <p className="rounded-card border border-line px-4 py-3 text-[13px] text-text-2">
          {straight.steepM > 0 ? (
            <>
              Walking straight there crosses{' '}
              <span className="font-mono">{fmt(straight.steepM, 0, 'm')}</span> steeper than{' '}
              <span className="font-mono">{maxSlopeDeg}°</span> (up to{' '}
              <span className="font-mono">{fmt(straight.maxSlopeDeg, 0, '°')}</span>). The route goes
              around.
            </>
          ) : (
            <>
              The straight line stays within <span className="font-mono">{maxSlopeDeg}°</span> here; the
              route follows easier ground.
            </>
          )}
        </p>
      )}

      {ok && route?.hazards && route.hazards.length > 0 && (
        <ul className="flex flex-col gap-1.5 text-[13px] text-text-2">
          {route.hazards.slice(0, 4).map((h, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="text-caution">
                <StatusIcon status="caution" size={14} />
              </span>
              <span className="font-semibold text-caution">STEEP</span> {h.note}
            </li>
          ))}
          {route.hazards.length > 4 && (
            <li className="text-muted">…and {route.hazards.length - 4} more steep sections</li>
          )}
        </ul>
      )}

      <ConditionsPanel />

      <label className="flex min-h-(--size-tap) cursor-pointer items-center gap-2.5 text-sm text-text-2">
        <input
          type="checkbox"
          checked={carryingLoad}
          onChange={() => setCarryingLoad(!carryingLoad)}
          className="h-[18px] w-[18px] accent-route"
        />
        <span title="Slower walk and more oxygen per minute (model assumption)">Carrying science gear</span>
      </label>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => void play('turnback')}
          disabled={copilotState === 'loading'}
          className="h-[52px] rounded-card bg-route text-base font-semibold tracking-[0.02em] text-bg hover:bg-route-hover disabled:opacity-60"
          title="Plays the EVA Copilot on simulated suit telemetry: a walk toward Mont Mercou"
        >
          {copilotState === 'loading' ? 'Loading…' : 'Start EVA'}
        </button>
        <button
          type="button"
          onClick={() => void play('leak')}
          disabled={copilotState === 'loading'}
          className="min-h-(--size-tap) rounded-card border border-line-strong text-sm text-text-2 hover:border-route disabled:opacity-60"
        >
          Suit leak demo
        </button>
        <span className="text-[11px] text-muted">
          Start EVA plays the EVA Copilot on simulated suit telemetry over real Gale terrain.
        </span>
      </div>

      {offline && <DemoRoutes />}
    </section>
  )
}

function Hint({ text }: { text: string }) {
  return <p className="rounded-card border border-line px-4 py-3 text-sm text-text-2">{text}</p>
}
