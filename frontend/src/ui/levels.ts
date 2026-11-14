// Copilot levels mapped to the four safety statuses of the palette.

import type { CopilotLevel } from '../api/types'
import type { Status } from '../theme'

const LEVEL_STATUS: Record<CopilotLevel, Status> = {
  go: 'go',
  caution: 'caution',
  turn_back: 'alert',
  emergency: 'alert',
}

export const levelStatus = (level: CopilotLevel): Status => LEVEL_STATUS[level]
