import type { EntryStage, Strategy } from '../types/stock'
import type { StatusBadgeStatus } from '../components/ui/StatusBadge'

export function strategyToBadgeStatus(s: Strategy): StatusBadgeStatus {
  if (s === 'WATCH_ONLY') return 'WATCH'
  if (s === 'BUY_AGGRESSIVE') return 'BUY_AGGRESSIVE'
  return s as StatusBadgeStatus
}

export function entryStageToBadgeStatus(e: EntryStage): StatusBadgeStatus {
  switch (e) {
    case 'ACCEPT':
      return 'BUY'
    case 'CAUTION':
      return 'WATCH'
    case 'WATCH':
      return 'WATCH'
    case 'REJECT':
      return 'REJECT'
    default:
      return 'HOLD'
  }
}
