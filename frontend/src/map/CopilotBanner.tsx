// Alert banner over the map during the Copilot demo (design/reference/TurnBack.dc.html).
// Red levels blink until acknowledged; caution is amber and steady; GO shows no banner.

import { useCopilotStore } from '../store/useCopilotStore'
import { StatusIcon } from '../ui/Status'
import { levelStatus } from '../ui/levels'

export function CopilotBanner() {
  const scenario = useCopilotStore((s) => s.scenario)
  const index = useCopilotStore((s) => s.index)
  const state = useCopilotStore((s) => s.state)
  const acknowledged = useCopilotStore((s) => s.acknowledged)
  if (!scenario || (state !== 'playing' && state !== 'done')) return null
  const step = scenario.steps[Math.min(index, scenario.steps.length - 1)]
  const level = step.copilot.level
  const status = levelStatus(level)
  if (status === 'go' || status === 'unknown') return null

  const back = step.phase === 'back'
  const text =
    level === 'emergency'
      ? back
        ? 'EMERGENCY · RETURNING TO BASE'
        : 'EMERGENCY · RETURN TO BASE'
      : level === 'turn_back'
        ? back
          ? 'TURN BACK NOW · REROUTED TO BASE'
          : 'TURN BACK NOW'
        : 'CAUTION · OXYGEN USE ABOVE PLAN'
  const alert = status === 'alert'
  return (
    <div
      role="alert"
      className={`pointer-events-none absolute left-1/2 top-5 z-20 flex -translate-x-1/2 items-center gap-3 rounded-card px-5 py-3 text-bg shadow-2xl ${
        alert ? 'bg-alert/92' : 'bg-caution/92'
      } ${alert && !acknowledged && state === 'playing' ? 'animate-alert-pulse' : ''}`}
    >
      <StatusIcon status={status} size={22} />
      <span className="font-mono text-sm font-semibold tracking-[0.12em]">{text}</span>
    </div>
  )
}
