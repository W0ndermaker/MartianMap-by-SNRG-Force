// Display helpers: every value may be null, and null renders as a dash.

export const NO_DATA = '—'

export function fmt(value: number | null | undefined, digits = 0, unit = ''): string {
  if (value === null || value === undefined || Number.isNaN(value)) return NO_DATA
  const text = value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  return unit ? `${text} ${unit}` : text
}

export function fmtDistance(m: number | null | undefined): string {
  if (m === null || m === undefined) return NO_DATA
  return m >= 1000 ? fmt(m / 1000, 2, 'km') : fmt(m, 0, 'm')
}

export function fmtDuration(min: number | null | undefined): string {
  if (min === null || min === undefined) return NO_DATA
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h > 0 ? `${h} h ${m} min` : `${m} min`
}

export function titleCase(value: string | null | undefined): string {
  if (!value) return NO_DATA
  return value.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}
