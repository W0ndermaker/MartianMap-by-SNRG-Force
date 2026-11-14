// EVA Copilot demo player: replays the backend's scenario (simulated suit telemetry on a real route)
// at video speed, pauses on each Copilot event and speaks it with the browser's speech synthesis.

import { create } from 'zustand'
import { api } from '../api/client'
import type { CopilotCase, CopilotScenario } from '../api/types'

export type PlayerState = 'idle' | 'loading' | 'playing' | 'done' | 'error'

/** Walking time of the whole walk out and back on screen (scenario minutes are compressed). With the
 *  pauses on the Copilot's messages the demo fits a 30-second video. */
const PLAYBACK_S = 17
/** Hold on an event while the voice speaks, at most this long (ms). */
const EVENT_HOLD_MAX_MS = 3500
/** Hold on an event when speech is unavailable (ms). */
const EVENT_HOLD_SILENT_MS = 1800

interface CopilotState {
  /** Scenario being shown, and the ones already loaded (by case). */
  scenario: CopilotScenario | null
  loaded: Partial<Record<CopilotCase, CopilotScenario>>
  state: PlayerState
  /** Index of the current step in scenario.steps. */
  index: number
  /** Last spoken message and its level, for the panel. */
  message: { text: string; level: CopilotScenario['events'][number]['level'] } | null
  voice: boolean
  play: (scenarioCase: CopilotCase) => Promise<void>
  stop: () => void
  toggleVoice: () => void
}

let timer: ReturnType<typeof setTimeout> | null = null
let runId = 0

function speak(text: string, enabled: boolean): Promise<void> {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
  if (!enabled || !synth) return new Promise((r) => setTimeout(r, EVENT_HOLD_SILENT_MS))
  return new Promise((resolve) => {
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    u.rate = 1.05
    const done = () => resolve()
    u.onend = done
    u.onerror = done
    setTimeout(done, EVENT_HOLD_MAX_MS)
    synth.speak(u)
  })
}

export const useCopilotStore = create<CopilotState>((set, get) => ({
  scenario: null,
  loaded: {},
  state: 'idle',
  index: 0,
  message: null,
  voice: true,

  play: async (scenarioCase) => {
    get().stop()
    const id = ++runId
    set({ state: 'loading', index: 0, message: null })
    let scenario = get().loaded[scenarioCase]
    try {
      scenario ??= (await api.copilotScenario(scenarioCase)).data
      set({ loaded: { ...get().loaded, [scenarioCase]: scenario } })
    } catch (error) {
      console.error(error)
      set({ state: 'error' })
      return
    }
    if (id !== runId) return
    set({ scenario, state: 'playing' })

    const steps = scenario.steps
    const stepMs = (PLAYBACK_S * 1000) / Math.max(steps.length, 1)
    // Events by step: the step whose time equals the event time (first match).
    const eventsAt = new Map<number, CopilotScenario['events']>()
    for (const e of scenario.events) {
      const i = steps.findIndex((s) => s.t_min >= e.t_min)
      if (i >= 0) eventsAt.set(i, [...(eventsAt.get(i) ?? []), e])
    }

    const tick = async (i: number) => {
      if (id !== runId) return
      set({ index: i })
      for (const e of eventsAt.get(i) ?? []) {
        set({ message: { text: e.message, level: e.level } })
        // "All good" is spoken while walking on; warnings pause the walk until they are said.
        if (e.level === 'go') void speak(e.message, get().voice)
        else await speak(e.message, get().voice)
        if (id !== runId) return
      }
      if (i + 1 >= steps.length) {
        set({ state: 'done' })
        return
      }
      timer = setTimeout(() => void tick(i + 1), stepMs)
    }
    void tick(0)
  },

  stop: () => {
    runId++
    if (timer) clearTimeout(timer)
    timer = null
    window.speechSynthesis?.cancel()
    if (get().state === 'playing' || get().state === 'loading') set({ state: 'idle' })
  },

  toggleVoice: () => {
    if (get().voice) window.speechSynthesis?.cancel()
    set({ voice: !get().voice })
  },
}))
