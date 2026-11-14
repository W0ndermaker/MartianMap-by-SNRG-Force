// Top bar (design/reference/Main.dc.html): name, place, sol, EVA clock, connection status.

import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useCopilotStore } from '../store/useCopilotStore'
import { StatusIcon } from '../ui/Status'

const chip =
  'inline-flex min-h-(--size-tap) items-center gap-1.5 rounded-chip border border-line-strong px-3 font-mono text-xs text-text-2'

function SolControl() {
  const sol = useAppStore((s) => s.sol)
  const state = useAppStore((s) => s.conditionsState)
  const loadConditions = useAppStore((s) => s.loadConditions)
  const [draft, setDraft] = useState('')
  const goTo = (value: number) => {
    if (Number.isFinite(value) && value >= 0) void loadConditions(Math.round(value))
  }
  const step = 'min-w-(--size-tap) self-stretch rounded-chip px-2 text-text-2 hover:bg-line disabled:opacity-40'
  return (
    <div className={`${chip} gap-0 px-0`} role="group" aria-label="Sol">
      <button
        type="button"
        className={step}
        disabled={sol === null || state === 'loading'}
        onClick={() => sol !== null && goTo(sol - 1)}
        aria-label="Previous sol"
      >
        ‹
      </button>
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault()
          goTo(Number(draft))
          setDraft('')
        }}
      >
        <span aria-hidden="true">SOL</span>
        <input
          className="w-14 bg-transparent text-center font-mono text-xs text-text placeholder:text-text-2 focus:outline-none"
          inputMode="numeric"
          placeholder={sol === null ? '…' : String(sol)}
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
          aria-label="Go to sol"
        />
      </form>
      <button
        type="button"
        className={step}
        disabled={sol === null || state === 'loading'}
        onClick={() => sol !== null && goTo(sol + 1)}
        aria-label="Next sol"
      >
        ›
      </button>
    </div>
  )
}

/** Elapsed EVA time during the Copilot demo, otherwise the planning mode. */
function ClockChip() {
  const scenario = useCopilotStore((s) => s.scenario)
  const index = useCopilotStore((s) => s.index)
  const state = useCopilotStore((s) => s.state)
  const active = (state === 'playing' || state === 'done') && scenario
  if (!active) return <span className={chip}>PLANNING</span>
  const t = Math.round(scenario.steps[Math.min(index, scenario.steps.length - 1)].t_min)
  return (
    <>
      <span className={chip} aria-label="Elapsed EVA time">
        T+{Math.floor(t / 60)}:{String(t % 60).padStart(2, '0')}
      </span>
      <span className={chip}>SIMULATED SUIT TELEMETRY</span>
    </>
  )
}

function ConnectionChip() {
  const connecting = useAppStore((s) => s.connecting)
  const offline = useAppStore((s) => s.offline)
  const lost = useAppStore((s) => s.connectionLost)
  if (connecting)
    return (
      <span
        className={chip}
        title="The free-tier server sleeps when idle; the first request can take up to a minute."
      >
        WAKING UP THE SERVER…
      </span>
    )
  if (lost)
    return (
      <span
        className={`${chip} border-caution/45 text-caution`}
        title="The route server stopped answering. Shown values are the last known ones and may be outdated."
      >
        <StatusIcon status="caution" size={14} />
        CONNECTION LOST
      </span>
    )
  if (offline)
    return (
      <span
        className={`${chip} border-unknown/45 text-unknown`}
        title="The server is unreachable; showing precomputed demo routes and bundled data."
      >
        <StatusIcon status="unknown" size={14} />
        OFFLINE DEMO
      </span>
    )
  return (
    <span className={`${chip} border-route/40 text-route`} title="Connected to the route server">
      <span className="h-[7px] w-[7px] rounded-full bg-route" aria-hidden="true" />
      LIVE
    </span>
  )
}

export function Header() {
  const terrain = useAppStore((s) => s.health?.terrain)
  const copilot = useCopilotStore((s) => s.state)
  const scenario = useCopilotStore((s) => s.scenario)
  const poi = useAppStore((s) => s.poi)
  const evaActive = (copilot === 'playing' || copilot === 'done') && scenario
  const target = evaActive
    ? poi?.features.find((f) => {
        const c = scenario.outbound_path.coordinates.at(-1)
        return c && Math.abs(f.geometry.coordinates[0] - c[0]) < 1e-4 && Math.abs(f.geometry.coordinates[1] - c[1]) < 1e-4
      })?.properties.name
    : null

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-2.5">
      <div className="flex flex-wrap items-baseline gap-4">
        <h1 className="font-mono text-[15px] font-semibold tracking-[0.18em]">MARTIAN MAP</h1>
        <span className="text-[13px] text-muted">
          {evaActive ? `EVA in progress${target ? ` · ${target}` : ''}` : 'Gale Crater · Mount Sharp'}
        </span>
        {terrain === 'synthetic' && (
          <span className="text-[13px] text-unknown" title="Routes are planned on generated test terrain">
            Synthetic terrain
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SolControl />
        <ClockChip />
        <ConnectionChip />
      </div>
    </header>
  )
}
