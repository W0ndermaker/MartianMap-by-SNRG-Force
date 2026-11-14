// "Outside" block (design/reference/Main.dc.html): surface conditions of the sol from Curiosity.

import type { RiskLevel } from '../api/types'
import { useAppStore } from '../store/useAppStore'
import type { Status } from '../theme'
import { StatusChip } from '../ui/Status'
import { fmt, NO_DATA, titleCase } from './format'
import { Label } from './ui'

const RISK_STATUS: Record<RiskLevel, Status> = {
  green: 'go',
  yellow: 'caution',
  red: 'alert',
  unknown: 'unknown',
}

const RISK_LABEL: Record<RiskLevel, string> = {
  green: 'Low risk',
  yellow: 'Caution',
  red: 'High risk',
  unknown: 'No data — unknown risk',
}

/**
 * REMS minimum temperatures of exactly this value look like the sensor's lower limit rather than
 * a measured extreme (all "red" sols in the data have it), see docs/risk_rule.md.
 */
const REMS_SENSOR_FLOOR_C = -100

function Row({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <>
      <span className="text-muted" title={title}>
        {label}
      </span>
      <span className={`text-right font-mono ${value === NO_DATA ? 'text-unknown' : ''}`} title={title}>
        {value}
      </span>
    </>
  )
}

export function ConditionsPanel() {
  const conditions = useAppStore((s) => s.conditions)
  const state = useAppStore((s) => s.conditionsState)

  return (
    <section
      aria-label="Surface conditions"
      className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-card border border-line px-4 py-3.5 text-[13px]"
    >
      <span className="col-span-2 flex items-center justify-between gap-2">
        <Label>Outside · Curiosity REMS / RAD</Label>
        {conditions && (
          <StatusChip
            status={RISK_STATUS[conditions.risk_level]}
            label={RISK_LABEL[conditions.risk_level]}
          />
        )}
      </span>

      {state === 'error' && !conditions && (
        <p className="col-span-2 text-unknown">Conditions are unavailable right now.</p>
      )}
      {state === 'loading' && !conditions && <p className="col-span-2 text-muted">Loading…</p>}

      {conditions && (
        <>
          <Row
            label="Temperature"
            value={
              conditions.temp_min_c === null && conditions.temp_max_c === null
                ? NO_DATA
                : `${fmt(conditions.temp_min_c)} … ${fmt(conditions.temp_max_c, 0, '°C')}`
            }
          />
          <Row label="Pressure" value={fmt(conditions.pressure_pa, 0, 'Pa')} />
          <Row
            label="Radiation · mission avg"
            value={fmt(conditions.radiation_usv_per_hour, 1, 'µSv/h')}
            title="RAD mission-average surface dose rate (Hassler et al., 2014); there are no daily values in this data, so it is the same on every sol."
          />
          <Row label="UV" value={conditions.uv_index ? titleCase(conditions.uv_index) : NO_DATA} />
          <Row
            label="Dust opacity"
            value={conditions.dust_opacity === null ? NO_DATA : fmt(conditions.dust_opacity, 2)}
          />
          <p className="col-span-2 text-[11px] leading-snug text-muted">
            Historical conditions on sol <span className="font-mono">{conditions.sol}</span>, not a
            live feed. Weather from the REMS daily summary published for outreach (calibrated data
            is in the NASA PDS); radiation is the RAD mission average.
            {conditions.temp_min_c === REMS_SENSOR_FLOOR_C &&
              ` The ${REMS_SENSOR_FLOOR_C} °C minimum may be the sensor limit, not the real low.`}
            {` Source: ${conditions.source}.`}
          </p>
        </>
      )}
    </section>
  )
}
