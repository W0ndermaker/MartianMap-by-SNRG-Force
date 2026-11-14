import type { CopilotLevel } from '../api/types'
import { useCopilotStore } from '../store/useCopilotStore'
import { fmt, fmtDuration } from './format'

// Safety colours from the project brief (cyan / light yellow / magenta).
const LEVEL_STYLE: Record<CopilotLevel, string> = {
  go: 'text-cyan-200 ring-cyan-300/50 bg-cyan-400/10',
  caution: 'text-yellow-100 ring-yellow-100/50 bg-yellow-100/10',
  turn_back: 'text-fuchsia-200 ring-fuchsia-400/60 bg-fuchsia-500/15',
  emergency: 'text-fuchsia-100 ring-fuchsia-300 bg-fuchsia-600/30 animate-pulse',
}

const LEVEL_LABEL: Record<CopilotLevel, string> = {
  go: 'GO',
  caution: 'CAUTION',
  turn_back: 'TURN BACK',
  emergency: 'EMERGENCY',
}

const BAR_COLOR: Record<CopilotLevel, string> = {
  go: 'bg-cyan-400',
  caution: 'bg-yellow-100',
  turn_back: 'bg-fuchsia-400',
  emergency: 'bg-fuchsia-500',
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] uppercase tracking-wide text-stone-400">{label}</span>
      <span className="text-right text-sm font-medium text-stone-100">{children}</span>
    </div>
  )
}

export function CopilotPanel() {
  const { scenario, state, index, message, voice, play, stop, toggleVoice } = useCopilotStore()
  const step = scenario?.steps[index] ?? null
  const air = step?.copilot ?? null
  const active = state === 'playing' || state === 'done'

  return (
    <section
      aria-label="EVA Copilot"
      className="rounded-xl bg-stone-900/80 p-4 ring-1 ring-white/10"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-orange-300">EVA Copilot</h2>
        {active && air && (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${LEVEL_STYLE[air.level]}`}>
            {LEVEL_LABEL[air.level]}
          </span>
        )}
      </div>

      {!active && (
        <p className="mb-3 text-sm text-stone-400">
          Watches the suit&apos;s oxygen on the way and tells the astronaut when to slow down or turn back.
        </p>
      )}

      {active && step && air && (
        <div className="mb-3 space-y-2">
          <div>
            <Row label="Oxygen">
              {fmt(step.o2_pct, 0, '%')}{' '}
              <span className="text-xs text-stone-400">
                ▼ {fmt(air.rate_pct_per_min, 2)} %/min (plan {fmt(air.planned_rate_pct_per_min, 2)})
              </span>
            </Row>
            <div className="mt-1 h-1.5 overflow-hidden rounded bg-stone-800">
              <div
                className={`h-full transition-all ${BAR_COLOR[air.level]}`}
                style={{ width: `${Math.max(0, Math.min(100, step.o2_pct))}%` }}
              />
            </div>
          </div>
          <Row label="EVA time">{fmtDuration(step.t_min)}</Row>
          <Row label={step.phase === 'back' ? 'Heading back · base in' : 'To base'}>
            {air.minutes_to_base == null ? 'no way back' : fmtDuration(air.minutes_to_base)}
          </Row>
          {step.phase === 'out' && (
            <Row label="Turn back within">
              {air.turn_back_in_min == null ? 'now' : fmtDuration(air.turn_back_in_min)}
            </Row>
          )}
          {message && (
            <p
              className={`rounded-lg px-3 py-2 text-sm ring-1 ${LEVEL_STYLE[message.level].replace('animate-pulse', '')}`}
            >
              “{message.text}”
            </p>
          )}
        </div>
      )}

      {state === 'error' && <p className="mb-3 text-sm text-red-300">The demo could not be loaded.</p>}

      <div className="flex flex-wrap items-center gap-2">
        {state === 'playing' ? (
          <button
            type="button"
            onClick={stop}
            className="rounded-md bg-orange-600 px-3 py-1.5 text-xs font-semibold hover:bg-orange-500"
          >
            Stop
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void play('turnback')}
              className="rounded-md bg-orange-600 px-3 py-1.5 text-xs font-semibold hover:bg-orange-500 disabled:opacity-50"
              disabled={state === 'loading'}
              title="A walk to Mont Mercou, beyond the walk-back limit: the Copilot calls the turn"
            >
              {state === 'loading' ? 'Loading…' : 'Play EVA demo'}
            </button>
            <button
              type="button"
              onClick={() => void play('leak')}
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-fuchsia-200 ring-1 ring-fuchsia-400/60 hover:bg-fuchsia-500/15 disabled:opacity-50"
              disabled={state === 'loading'}
              title="A suit leak on the way to Pahrump Hills: emergency return"
            >
              Suit leak demo
            </button>
          </>
        )}
        <button
          type="button"
          onClick={toggleVoice}
          className="rounded-md px-2 py-1.5 text-xs text-stone-300 ring-1 ring-white/15 hover:bg-white/10"
          aria-pressed={voice}
          title="Speak the Copilot's messages"
        >
          {voice ? '🔊 Voice on' : '🔇 Voice off'}
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-stone-500">
        {scenario?.case === 'leak'
          ? 'Simulated suit telemetry on real Gale terrain: a suspected leak on the way out, then the emergency walk back.'
          : 'Simulated suit telemetry on real Gale terrain: a walk toward Mont Mercou; the Copilot calls the turn at the point of no return, keeping the 30-min reserve.'}{' '}
        Rule-based on-board logic, no cloud AI.
      </p>
    </section>
  )
}
