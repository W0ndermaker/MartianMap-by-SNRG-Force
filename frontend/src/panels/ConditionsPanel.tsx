import { useState } from 'react'
import type { RiskLevel } from '../api/types'
import { useAppStore } from '../store/useAppStore'
import { fmt, titleCase } from './format'

const RISK_STYLE: Record<RiskLevel, string> = {
  green: 'bg-emerald-500/20 text-emerald-300 ring-emerald-400/50',
  yellow: 'bg-amber-500/20 text-amber-300 ring-amber-400/50',
  red: 'bg-red-500/20 text-red-300 ring-red-400/50',
}

const RISK_LABEL: Record<RiskLevel, string> = {
  green: 'Low risk',
  yellow: 'Caution',
  red: 'High risk',
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-stone-400">{label}</div>
      <div className="truncate text-sm font-medium text-stone-100">{value}</div>
    </div>
  )
}

export function ConditionsPanel() {
  const conditions = useAppStore((s) => s.conditions)
  const state = useAppStore((s) => s.conditionsState)
  const sol = useAppStore((s) => s.sol)
  const loadConditions = useAppStore((s) => s.loadConditions)
  const [draft, setDraft] = useState('')

  const goTo = (value: number) => {
    if (Number.isFinite(value) && value >= 0) void loadConditions(Math.round(value))
  }

  return (
    <section
      aria-label="Surface conditions"
      className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl bg-stone-900/80 px-4 py-3 ring-1 ring-white/10"
    >
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-stone-400">Sol</span>
        <button
          type="button"
          className="rounded px-2 py-1 text-stone-300 hover:bg-white/10 disabled:opacity-40"
          disabled={sol === null || state === 'loading'}
          onClick={() => sol !== null && goTo(sol - 1)}
          aria-label="Previous sol"
        >
          ‹
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            goTo(Number(draft))
            setDraft('')
          }}
        >
          <input
            className="w-20 rounded bg-stone-800 px-2 py-1 text-center text-sm text-stone-100 ring-1 ring-white/10 focus:outline-none focus:ring-orange-400"
            inputMode="numeric"
            placeholder={sol === null ? '…' : String(sol)}
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
            aria-label="Go to sol"
          />
        </form>
        <button
          type="button"
          className="rounded px-2 py-1 text-stone-300 hover:bg-white/10 disabled:opacity-40"
          disabled={sol === null || state === 'loading'}
          onClick={() => sol !== null && goTo(sol + 1)}
          aria-label="Next sol"
        >
          ›
        </button>
      </div>

      {state === 'error' && !conditions && (
        <p className="text-sm text-red-300">Conditions are unavailable right now.</p>
      )}
      {state === 'loading' && !conditions && <p className="text-sm text-stone-400">Loading…</p>}

      {conditions && (
        <>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${RISK_STYLE[conditions.risk_level]}`}
          >
            {RISK_LABEL[conditions.risk_level]}
          </span>
          <div
            className={`grid flex-1 grid-cols-3 gap-x-5 gap-y-2 sm:grid-cols-6 ${state === 'loading' ? 'opacity-60' : ''}`}
          >
            <Stat
              label="Air temp"
              value={
                conditions.temp_min_c === null && conditions.temp_max_c === null
                  ? 'No data'
                  : `${fmt(conditions.temp_min_c)} … ${fmt(conditions.temp_max_c, 0, '°C')}`
              }
            />
            <Stat label="Pressure" value={fmt(conditions.pressure_pa, 0, 'Pa')} />
            <Stat label="UV" value={titleCase(conditions.uv_index)} />
            <Stat label="Radiation" value={fmt(conditions.radiation_usv_per_hour, 1, 'µSv/h')} />
            <Stat
              label="Dust opacity"
              value={conditions.dust_opacity === null ? 'No data' : fmt(conditions.dust_opacity, 2)}
            />
            <Stat label="Source" value={conditions.source} />
          </div>
        </>
      )}
    </section>
  )
}
