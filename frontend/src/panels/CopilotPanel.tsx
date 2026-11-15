// EVA Copilot panel during the demo (design/reference/TurnBack.dc.html): status block with the
// Copilot's words, oxygen, time to base, elapsed time and the message log.

import type { CopilotLevel } from '../api/types'
import { useCopilotStore } from '../store/useCopilotStore'
import { StatusIcon } from '../ui/Status'
import { levelStatus } from '../ui/levels'
import { statusBorder, statusFill, statusText, statusTint } from '../ui/statusClasses'
import suit from '@data/suit_params.json'
import { fmt, hhmm } from './format'
import { Card, Label, Metric, OxygenBar } from './ui'

const LEVEL_WORD: Record<CopilotLevel, string> = {
  go: 'GO',
  caution: 'CAUTION',
  turn_back: 'TURN BACK',
  emergency: 'EMERGENCY',
}

const LEVEL_KIND: Record<CopilotLevel, string> = {
  go: 'NOMINAL',
  caution: 'CAUTION',
  turn_back: 'WARNING',
  emergency: 'WARNING',
}

/** Where the reserve starts on the remaining-oxygen bar, % of the supply. */
const RESERVE_PCT = (suit.emergency_reserve_min.value / suit.eva_max_duration_min.value) * 100

function SpeakerIcon() {
  return (
    <svg
      aria-hidden="true"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 flex-none text-text"
    >
      <path d="M4 9 H8 L13 5 V19 L8 15 H4 Z" />
      <path d="M16.5 8.5 A5 5 0 0 1 16.5 15.5" />
      <path d="M19 6 A8.5 8.5 0 0 1 19 18" />
    </svg>
  )
}

const tPlus = (min: number) => `T+${hhmm(min)}`
const secondary =
  'min-h-(--size-tap) flex-1 rounded-card border border-line-strong text-sm text-text-2 hover:border-route'

export function CopilotPanel() {
  const { scenario, state, index, message, voice, acknowledged, demoInsteadOfRoute, route } =
    useCopilotStore()
  const { play, stop, toggleVoice, acknowledge, close } = useCopilotStore()
  if (!scenario) return null
  const step = scenario.steps[Math.min(index, scenario.steps.length - 1)]
  const air = step.copilot
  const status = levelStatus(air.level)
  const quote = message?.text ?? air.reasons[0]
  const abovePlan = (air.rate_pct_per_min / air.planned_rate_pct_per_min - 1) * 100
  const log = scenario.events.filter((e) => e.t_min <= step.t_min).reverse()
  const alert = status === 'alert'

  return (
    <section aria-label="EVA Copilot" className="flex flex-col gap-4">
      <div
        className={`flex flex-col gap-3.5 rounded-panel p-5 ${alert ? 'border-2' : 'border'} ${statusBorder(status)} ${statusTint(status)}`}
      >
        <div className="flex items-center gap-3.5">
          <span className={statusText(status)}>
            <StatusIcon status={status} size={48} />
          </span>
          <div className="flex flex-col gap-1">
            <span className={`text-status-sm font-bold tracking-[0.02em] ${statusText(status)}`}>
              {LEVEL_WORD[air.level]}
            </span>
            <span className="font-mono text-label uppercase text-text-2">
              {LEVEL_KIND[air.level]} · EVA Copilot
            </span>
          </div>
        </div>
        {quote && (
          <div className="flex items-start gap-3 rounded-[10px] bg-bg/60 p-3.5" role="status" aria-live="polite">
            <SpeakerIcon />
            <span className="text-quote font-medium">“{quote}”</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Card wide>
          <div className="flex items-baseline justify-between">
            <Label>Oxygen</Label>
            {abovePlan >= 1 ? (
              <span className="flex items-center gap-1.5 font-mono text-[13px] text-caution">
                <StatusIcon status="caution" size={12} />+{fmt(abovePlan, 0)} % above plan
              </span>
            ) : (
              <span className="font-mono text-[13px] text-muted">on plan</span>
            )}
          </div>
          <span className="font-mono text-number-lg font-semibold">
            {fmt(step.o2_pct, 0)}
            <span className="text-sm font-normal text-muted">
              {' '}
              % · {fmt(air.minutes_of_o2_left, 0)} min left
            </span>
          </span>
          <OxygenBar usedPct={step.o2_pct} reserveMarkPct={RESERVE_PCT} fillClass={statusFill(status)} />
          <span className="text-xs text-muted">
            Amber mark: <span className="font-mono">{suit.emergency_reserve_min.value}</span>-min safety reserve
          </span>
        </Card>
        <Metric
          label={step.phase === 'back' ? 'Base in' : 'To base'}
          value={air.minutes_to_base == null ? null : fmt(air.minutes_to_base, 0)}
          unit="min"
          sub={`+ ${suit.emergency_reserve_min.value} min reserve`}
        />
        <Metric label="Elapsed" value={hhmm(step.t_min)} unit="h" sub="since base" />
      </div>

      <div className="flex flex-col gap-2.5 rounded-card border border-line px-4 py-3.5">
        <Label>Copilot log</Label>
        {log.map((e, i) => (
          <div key={i} className="flex gap-2.5 text-[13px] leading-snug">
            <span className="w-14 flex-none font-mono text-muted">{tPlus(e.t_min)}</span>
            <span
              className={`flex flex-none items-center gap-1 font-semibold ${statusText(levelStatus(e.level))}`}
            >
              <StatusIcon status={levelStatus(e.level)} size={12} />
              {LEVEL_WORD[e.level]}
            </span>
            <span className="text-text-2">{e.message}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {alert && !acknowledged && state === 'playing' ? (
          <button
            type="button"
            onClick={acknowledge}
            className="h-[52px] rounded-card bg-alert text-base font-semibold tracking-[0.02em] text-bg"
          >
            {step.phase === 'back' ? 'Acknowledge & follow return route' : 'Acknowledge'}
          </button>
        ) : state === 'playing' ? (
          <button type="button" onClick={stop} className={secondary}>
            Stop demo
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void play(scenario.case, route)}
            className="h-[52px] rounded-card bg-route text-base font-semibold text-bg hover:bg-route-hover"
          >
            Replay
          </button>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={close} className={secondary}>
            Back to planning
          </button>
          <button
            type="button"
            onClick={toggleVoice}
            aria-pressed={voice}
            className={secondary}
            title="Speak the Copilot's messages"
          >
            {voice ? '🔊 Voice on' : '🔇 Voice off'}
          </button>
        </div>
      </div>

      {demoInsteadOfRoute && (
        <span className="rounded-card border border-line px-3 py-2 text-[13px] text-text-2">
          Offline: this is the precomputed demo walk, not your route.
        </span>
      )}
      <span className="text-[11px] text-muted">
        Suit telemetry is simulated. Terrain and route are real NASA data. Rule-based on-board logic,
        no cloud AI.
      </span>
    </section>
  )
}
