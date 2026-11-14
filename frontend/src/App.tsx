import { lazy, Suspense, useEffect } from 'react'
import { ConditionsPanel } from './panels/ConditionsPanel'
import { CopilotPanel } from './panels/CopilotPanel'
import { EvaPanel } from './panels/EvaPanel'
import { LayerControls } from './panels/LayerControls'
import { PoiCard } from './panels/PoiCard'
import { ProfileChart } from './panels/ProfileChart'
import { Header } from './layout/Header'
import { useAppStore } from './store/useAppStore'

// The science goal of the EVA, shown in the side panel (also in README.md).
const MISSION_GOAL =
  'Walk from the crew base at Bradbury Landing to the layered rocks of Mount Sharp’s foothills ' +
  'and sample them in order — lake mudstones, clay-bearing and sulfate-bearing units — to trace ' +
  'how Gale crater’s ancient lake stayed habitable and then dried out, within one EVA’s oxygen ' +
  'budget, the slope a suited astronaut can walk, and the surface conditions of the sol.'

// CesiumJS is ~4 MB: load the 3D map separately so the panels appear at once.
const MapView = lazy(() => import('./map/MapView'))

export default function App() {
  const init = useAppStore((s) => s.init)
  const startHeartbeat = useAppStore((s) => s.startHeartbeat)

  useEffect(() => {
    void init()
  }, [init])

  useEffect(() => startHeartbeat(), [startHeartbeat])

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-text lg:h-dvh">
      <Header />
      <div className="flex min-h-0 flex-1 flex-wrap">
        <section
          aria-label="3D map of the route"
          className="relative h-[70dvh] min-w-0 flex-[999_1_560px] overflow-hidden lg:h-full"
        >
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-sm text-muted">Loading 3D map…</div>
            }
          >
            <MapView />
          </Suspense>
        </section>
        <aside
          aria-label="EVA plan"
          className="flex min-w-0 flex-[1_1_var(--size-panel)] flex-col gap-4 border-l border-line p-6 lg:h-full lg:max-w-[440px] lg:overflow-y-auto"
        >
          <EvaPanel />
          <CopilotPanel />
          <PoiCard />
          <ConditionsPanel />
          <LayerControls />
          <div className="h-56 shrink-0">
            <ProfileChart />
          </div>
          <section aria-label="Mission goal" className="text-xs leading-snug text-muted">
            <span className="font-mono text-label uppercase text-muted">Mission goal · </span>
            {MISSION_GOAL}
          </section>
          <footer className="text-[11px] text-unknown">
            NASA Space Apps Challenge 2026 · SNRG Force · Data: NASA/JPL-Caltech, USGS, Curiosity REMS and RAD
          </footer>
        </aside>
      </div>
    </div>
  )
}
