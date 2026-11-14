import { useEffect } from 'react'
import { PlaceholderMap } from './map/PlaceholderMap'
import { ConditionsPanel } from './panels/ConditionsPanel'
import { EvaPanel } from './panels/EvaPanel'
import { LayerControls } from './panels/LayerControls'
import { PoiCard } from './panels/PoiCard'
import { ProfileChart } from './panels/ProfileChart'
import { useAppStore } from './store/useAppStore'

function Badge({ children, title }: { children: string; title: string }) {
  return (
    <span
      title={title}
      className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-300 ring-1 ring-amber-400/40"
    >
      {children}
    </span>
  )
}

export default function App() {
  const init = useAppStore((s) => s.init)
  const offline = useAppStore((s) => s.offline)
  const terrain = useAppStore((s) => s.health?.terrain)

  useEffect(() => {
    void init()
  }, [init])

  return (
    <div className="flex min-h-dvh flex-col gap-3 bg-stone-950 p-3 text-stone-100 lg:h-dvh">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-bold tracking-tight">
          Martian Map <span className="font-normal text-stone-400">· Gale crater EVA planner</span>
        </h1>
        {offline && (
          <Badge title="The server is unreachable; showing precomputed demo routes and bundled data.">
            Offline demo
          </Badge>
        )}
        {terrain === 'synthetic' && (
          <Badge title="Routes are planned on generated test terrain, not the real elevation map.">
            Synthetic terrain
          </Badge>
        )}
      </header>

      <ConditionsPanel />

      <main className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_20rem] lg:grid-rows-[1fr_14rem]">
        <div className="min-h-[50vh] overflow-hidden rounded-xl bg-stone-900 ring-1 ring-white/10 lg:min-h-0">
          <PlaceholderMap />
        </div>
        <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto lg:row-span-2">
          <EvaPanel />
          <PoiCard />
          <LayerControls />
        </aside>
        <div className="h-56 lg:h-auto">
          <ProfileChart />
        </div>
      </main>

      <footer className="text-[11px] text-stone-500">
        NASA Space Apps Challenge 2026 · SNRG Force · Data: NASA/JPL-Caltech, Curiosity REMS and RAD
      </footer>
    </div>
  )
}
