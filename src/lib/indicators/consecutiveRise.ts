import { consecutiveYangDays, rsiFromCloses } from './coreMath'
import type { MetricSeverity, OhlcvBar } from './types'

export type ConsecutiveRiseResult = {
  days: number
  line: string
  sub: string
  severity: MetricSeverity
}

export function computeConsecutiveRise(bars: OhlcvBar[]): ConsecutiveRiseResult {
  const days = consecutiveYangDays(bars)
  const closes = bars.map((b) => b.close)
  const rsi = rsiFromCloses(closes, 14)
  const line = days > 0 ? `${days}일` : '없음'
  let sub = '연속 상승 없음'
  let severity: MetricSeverity = 'neutral'
  if (days >= 1 && days <= 2) {
    sub = '단기 상승'
    severity = 'neutral'
  } else if (days >= 3 && days <= 4) {
    sub = '단기 상승 누적'
    severity = 'caution'
  } else if (days >= 5) {
    sub = `연속상승 ${days}일 · 일시 조정 가능성`
    severity = 'warning'
    if (rsi != null && rsi >= 75) {
      sub = `연속상승 ${days}일 · 과열 신호 동시 발생`
      severity = 'danger'
    }
  }
  return { days, line, sub, severity }
}
