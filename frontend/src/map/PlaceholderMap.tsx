// Temporary 2D map so the panels can be built and demoed end to end.
// Developer A replaces this with the 3D scene; it only reads and writes the shared store.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Bounds, LonLat, PoiKind, TraverseCollection } from '../api/types'
import { useAppStore } from '../store/useAppStore'

const WIDTH = 1000

const POI_COLOR: Record<PoiKind, string> = {
  science: '#38bdf8',
  base: '#a3e635',
  rover_stop: '#e879f9',
}

function makeProjection(bounds: Bounds) {
  const [minLon, minLat, maxLon, maxLat] = bounds
  const midLat = ((minLat + maxLat) / 2) * (Math.PI / 180)
  // Equirectangular: keep ground distances square at the area's mid latitude.
  const height = (WIDTH * (maxLat - minLat)) / ((maxLon - minLon) * Math.cos(midLat))
  return {
    height,
    toXY: ([lon, lat]: LonLat | number[]): [number, number] => [
      ((lon - minLon) / (maxLon - minLon)) * WIDTH,
      ((maxLat - lat) / (maxLat - minLat)) * height,
    ],
    toLonLat: (x: number, y: number): LonLat => [
      minLon + (x / WIDTH) * (maxLon - minLon),
      maxLat - (y / height) * (maxLat - minLat),
    ],
  }
}

const polyline = (points: [number, number][]) =>
  points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

export function PlaceholderMap() {
  const health = useAppStore((s) => s.health)
  const poi = useAppStore((s) => s.poi)
  const layers = useAppStore((s) => s.layers)
  const start = useAppStore((s) => s.start)
  const goal = useAppStore((s) => s.goal)
  const route = useAppStore((s) => s.route)
  const selectedPoiId = useAppStore((s) => s.selectedPoiId)
  const placePoint = useAppStore((s) => s.placePoint)
  const selectPoi = useAppStore((s) => s.selectPoi)
  const svgRef = useRef<SVGSVGElement>(null)
  const [traverse, setTraverse] = useState<TraverseCollection | null>(null)

  useEffect(() => {
    import('@data/curiosity_traverse.geojson?url')
      .then((m) => fetch(m.default))
      .then((r) => r.json())
      .then(setTraverse)
      .catch((e) => console.error('Traverse layer failed to load', e))
  }, [])

  const projection = useMemo(() => (health ? makeProjection(health.bounds) : null), [health])

  const traverseLines = useMemo(() => {
    if (!projection || !traverse) return []
    return traverse.features
      .filter((f) => f.geometry.type === 'LineString')
      .map((f) => polyline((f.geometry.coordinates as number[][]).map(projection.toXY)))
  }, [projection, traverse])

  if (!projection) {
    return (
      <div className="flex h-full items-center justify-center text-stone-500">Loading map…</div>
    )
  }

  const { toXY, height } = projection
  const onClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse())
    const [lon, lat] = projection.toLonLat(p.x, p.y)
    placePoint([Number(lon.toFixed(6)), Number(lat.toFixed(6))])
  }

  const marker = (point: LonLat | null, label: string, color: string) => {
    if (!point) return null
    const [x, y] = toXY(point)
    return (
      <g pointerEvents="none">
        <circle cx={x} cy={y} r={9} fill={color} stroke="#0c0a09" strokeWidth={3} />
        <text x={x} y={y + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="#0c0a09">
          {label}
        </text>
      </g>
    )
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${WIDTH} ${height}`}
      className="h-full w-full cursor-crosshair select-none"
      preserveAspectRatio="xMidYMid meet"
      onClick={onClick}
      role="img"
      aria-label="Working area map. Click to set start and goal."
    >
      <defs>
        <radialGradient id="ground" cx="50%" cy="40%" r="75%">
          <stop offset="0%" stopColor="#7c3a1d" />
          <stop offset="100%" stopColor="#3b1a0e" />
        </radialGradient>
      </defs>
      <rect width={WIDTH} height={height} fill="url(#ground)" />

      {layers.traverse &&
        traverseLines.map((pts, i) => (
          <polyline key={i} points={pts} fill="none" stroke="#fde68a" strokeOpacity={0.55} strokeWidth={1.5} />
        ))}

      {layers.route && route?.status === 'ok' && route.path && (
        <polyline
          points={polyline(route.path.coordinates.map(toXY))}
          fill="none"
          stroke="#f97316"
          strokeWidth={4}
          strokeLinejoin="round"
        />
      )}

      {layers.hazards &&
        route?.status === 'ok' &&
        route.hazards?.map((h, i) => {
          const [x, y] = toXY(h.position)
          return (
            <g key={i}>
              <title>{h.note}</title>
              <polygon
                points={`${x},${y - 9} ${x + 8},${y + 6} ${x - 8},${y + 6}`}
                fill="#ef4444"
                stroke="#0c0a09"
                strokeWidth={1.5}
              />
            </g>
          )
        })}

      {layers.poi &&
        poi?.features.map((f) => {
          const [x, y] = toXY(f.geometry.coordinates)
          const selected = f.properties.id === selectedPoiId
          return (
            <g
              key={f.properties.id}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation()
                selectPoi(f.properties.id)
              }}
            >
              <title>{f.properties.name}</title>
              <circle
                cx={x}
                cy={y}
                r={selected ? 10 : 7}
                fill={POI_COLOR[f.properties.kind]}
                stroke={selected ? '#fff' : '#0c0a09'}
                strokeWidth={selected ? 3 : 2}
              />
              <text x={x + 12} y={y + 4} fontSize={13} fill="#fafaf9" stroke="#0c0a09" strokeWidth={3} paintOrder="stroke">
                {f.properties.name}
              </text>
            </g>
          )
        })}

      {marker(start, 'S', '#a3e635')}
      {marker(goal, 'G', '#facc15')}
    </svg>
  )
}
