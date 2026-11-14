// Safety status: always color + icon + word (design/reference/Palette.dc.html).

import type { Status } from '../theme'
import { statusText } from './statusClasses'

/** Icon of a status, drawn in the current text color: ✓ go, ▲ caution, ⛔ alert, ? unknown. */
export function StatusIcon({ status, size = 20 }: { status: Status; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 48 48',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 3.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  if (status === 'go')
    return (
      <svg {...common}>
        <circle cx="24" cy="24" r="21" />
        <path d="M14 25 L21 32 L34 17" />
      </svg>
    )
  if (status === 'caution')
    return (
      <svg {...common}>
        <path d="M24 5 L45 42 H3 Z" />
        <path d="M24 19 V29" />
        <path d="M24 35 V35.5" />
      </svg>
    )
  if (status === 'alert')
    return (
      <svg {...common}>
        <path d="M16 4 H32 L44 16 V32 L32 44 H16 L4 32 V16 Z" />
        <path d="M15 24 H33" />
      </svg>
    )
  return (
    <svg {...common}>
      <circle cx="24" cy="24" r="21" />
      <path d="M18.5 18.5 A5.5 5.5 0 1 1 24 25 V28" />
      <path d="M24 34 V34.5" />
    </svg>
  )
}

/** Small status chip: icon + word in the status color. */
export function StatusChip({ status, label }: { status: Status; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold ${statusText(status)}`}>
      <StatusIcon status={status} size={14} />
      {label}
    </span>
  )
}
