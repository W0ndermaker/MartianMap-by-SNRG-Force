// Tailwind classes of each safety status (tokens from src/theme.css).

import type { Status } from '../theme'

const TEXT: Record<Status, string> = {
  go: 'text-go',
  caution: 'text-caution',
  alert: 'text-alert',
  unknown: 'text-unknown',
}
const BORDER: Record<Status, string> = {
  go: 'border-go/45',
  caution: 'border-caution/45',
  alert: 'border-alert',
  unknown: 'border-unknown/45',
}
const TINT: Record<Status, string> = {
  go: 'bg-go/8',
  caution: 'bg-caution/8',
  alert: 'bg-alert/12',
  unknown: 'bg-unknown/8',
}
const FILL: Record<Status, string> = {
  go: 'bg-go',
  caution: 'bg-caution',
  alert: 'bg-alert',
  unknown: 'bg-unknown',
}

export const statusText = (s: Status) => TEXT[s]
export const statusBorder = (s: Status) => BORDER[s]
export const statusTint = (s: Status) => TINT[s]
export const statusFill = (s: Status) => FILL[s]
