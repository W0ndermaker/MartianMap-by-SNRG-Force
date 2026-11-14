// Building blocks of the side panel (design/reference/Main.dc.html): labels, cards, metrics.

import type { ReactNode } from 'react'
import { NO_DATA } from './format'

/** Mono caps label: "DISTANCE", "OXYGEN — ROUND TRIP". */
export function Label({ children }: { children: ReactNode }) {
  return <span className="font-mono text-label uppercase text-muted">{children}</span>
}

export function Card({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className={`flex flex-col gap-1.5 rounded-card bg-card p-3.5 ${wide ? 'col-span-2' : ''}`}>
      {children}
    </div>
  )
}

/**
 * A big monospace number with its unit. A missing value is a grey dash, never a zero.
 * `value` is already formatted (without the unit) or null when there is no data.
 */
export function Metric({
  label,
  value,
  unit,
  sub,
  wide,
}: {
  label: string
  value: string | null
  unit?: string
  sub?: ReactNode
  wide?: boolean
}) {
  return (
    <Card wide={wide}>
      <Label>{label}</Label>
      {value === null || value === NO_DATA ? (
        <span className="font-mono text-number font-semibold text-unknown" aria-label="No data">
          {NO_DATA}
        </span>
      ) : (
        <span className="font-mono text-number font-semibold">
          {value}
          {unit && <span className="text-sm font-normal text-muted"> {unit}</span>}
        </span>
      )}
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </Card>
  )
}

/** Oxygen bar: used share (0-100 %) and an amber mark where the reserve starts. */
export function OxygenBar({
  usedPct,
  reserveMarkPct,
  fillClass = 'bg-text',
}: {
  usedPct: number
  reserveMarkPct: number
  fillClass?: string
}) {
  return (
    <div className="relative h-2 overflow-hidden rounded bg-track" aria-hidden="true">
      <div
        className={`absolute inset-y-0 left-0 rounded ${fillClass}`}
        style={{ width: `${Math.max(0, Math.min(100, usedPct))}%` }}
      />
      <div className="absolute inset-y-0 w-0.5 bg-caution" style={{ left: `${reserveMarkPct}%` }} />
    </div>
  )
}
