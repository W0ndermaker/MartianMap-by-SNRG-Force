import { useMemo } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { RouteResponse } from '../api/types'
import { useMapStore } from '../map/mapStore'
import { useAppStore } from '../store/useAppStore'
import { token } from '../theme'
import { fmt } from './format'
import { Label } from './ui'

/** Distance along the path (m) for each hazard, from the nearest path vertex. */
function hazardDistances(route: RouteResponse): number[] {
  const coords = route.path?.coordinates
  if (!coords || coords.length < 2 || !route.hazards?.length || !route.distance_m) return []
  // Cumulative planar length in degree units, scaled to the reported path length.
  const cum = [0]
  for (let i = 1; i < coords.length; i++) {
    const [x0, y0] = coords[i - 1]
    const [x1, y1] = coords[i]
    cum.push(cum[i - 1] + Math.hypot((x1 - x0) * Math.cos((y0 * Math.PI) / 180), y1 - y0))
  }
  const total = cum[cum.length - 1] || 1
  return route.hazards.map((h) => {
    let best = 0
    let bestD = Infinity
    coords.forEach(([x, y], i) => {
      const d = Math.hypot(x - h.position[0], y - h.position[1])
      if (d < bestD) {
        bestD = d
        best = i
      }
    })
    return (cum[best] / total) * route.distance_m!
  })
}

export function ProfileChart() {
  const route = useAppStore((s) => s.route)
  const state = useAppStore((s) => s.routeState)
  const setHoverDistM = useMapStore((s) => s.setHoverDistM)
  const profile = route?.status === 'ok' ? route.profile : null
  const hazards = useMemo(() => (route ? hazardDistances(route) : []), [route])

  return (
    <section
      aria-label="Elevation profile"
      className="flex h-full min-h-40 flex-col rounded-card bg-card px-4 py-3"
    >
      <div className="mb-1 flex items-center justify-between">
        <h2>
          <Label>Elevation profile</Label>
        </h2>
        <div className="flex gap-4 text-[11px] text-muted">
          <span><i className="mr-1 inline-block h-2 w-3 bg-muted" />Elevation</span>
          <span><i className="mr-1 inline-block h-0.5 w-3 bg-route align-middle" />Slope</span>
          <span><i className="mr-1 inline-block h-2 w-0.5 bg-caution align-middle" />Steep section</span>
        </div>
      </div>
      {!profile || profile.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted">
          {state === 'loading' ? 'Planning route…' : 'No route yet: the profile appears here.'}
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={profile}
              margin={{ top: 6, right: 8, bottom: 0, left: 0 }}
              // Developer A: tell the 3D map which point of the route is hovered.
              onMouseMove={(e) => setHoverDistM(typeof e?.activeLabel === 'number' ? e.activeLabel : null)}
              onMouseLeave={() => setHoverDistM(null)}
            >
              <CartesianGrid stroke={token('card')} vertical={false} />
              <XAxis
                dataKey="dist_m"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(v: number) => `${(v / 1000).toFixed(1)} km`}
                stroke={token('muted')}
                fontSize={11}
                fontFamily="var(--font-mono)"
              />
              <YAxis
                yAxisId="elev"
                domain={['auto', 'auto']}
                tickFormatter={(v: number) => `${v.toFixed(0)} m`}
                stroke={token('muted')}
                fontSize={11}
                fontFamily="var(--font-mono)"
                width={64}
              />
              <YAxis
                yAxisId="slope"
                orientation="right"
                domain={[0, 'auto']}
                stroke={token('route')}
                fontSize={11}
                fontFamily="var(--font-mono)"
                width={32}
                tickFormatter={(v: number) => `${v}°`}
              />
              <Tooltip
                contentStyle={{ background: token('bg'), border: `1px solid ${token('muted')}`, fontSize: 12 }}
                labelFormatter={(v: number) => `${fmt(v, 0, 'm')} along the route`}
                formatter={(value: number, name: string) =>
                  name === 'slope_deg' ? [fmt(value, 1, '°'), 'Slope'] : [fmt(value, 1, 'm'), 'Elevation']
                }
              />
              <Area
                yAxisId="elev"
                dataKey="elev_m"
                stroke={token('text-2')}
                fill={token('muted')}
                fillOpacity={0.25}
                isAnimationActive={false}
              />
              <Line
                yAxisId="slope"
                dataKey="slope_deg"
                stroke={token('route')}
                dot={false}
                strokeWidth={1}
                isAnimationActive={false}
              />
              {hazards.map((x, i) => (
                <ReferenceLine key={i} yAxisId="elev" x={x} stroke={token('caution')} strokeDasharray="3 3" />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
