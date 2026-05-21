import type { EntryStage, Strategy } from '../types/stock'
import type { StatusBadgeStatus } from '../components/ui/StatusBadge'

export function strategyToLabelKo(s: Strategy): string {
  switch (s) {
    case 'REJECT':
      return '제외'
    case 'WATCH_ONLY':
      return '관망'
    case 'TAKE_PROFIT':
      return '익절'
    case 'BUY_AGGRESSIVE':
      return '적극매수'
    case 'BUY':
      return '매수'
    case 'HOLD':
    default:
      return '보유'
  }
}

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
