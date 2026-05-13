import { highestClose, sma } from './coreMath'
import type { MetricSeverity, OhlcvBar, RiskStrip } from './types'

export type StatisticsCardResult = {
  primary: string
  line: string
  sub: string
  severity: MetricSeverity
  riskStrip: RiskStrip
  riskBadge?: string
  trend20Pct: number
}

export function computeStatisticsCard(bars: OhlcvBar[]): StatisticsCardResult {
  const closes = bars.map((b) => b.close)
  const last = closes[closes.length - 1]
  const s20 = sma(closes, 20)
  const s60 = sma(closes, 60)
  const hi52 = highestClose(bars, Math.min(252, bars.length))
  let trend20Pct = 0
  if (s20 != null && s20 > 0) {
    trend20Pct = ((last - s20) / s20) * 100
  }
  const primary = `${trend20Pct >= 0 ? '+' : ''}${trend20Pct.toFixed(2)}%`
  const line = `20일 평균 대비 ${primary}`

  let vs60 = '60일 데이터 부족'
  if (s60 != null && s60 > 0) {
    const t60 = ((last - s60) / s60) * 100
    vs60 = `60일 대비 ${t60 >= 0 ? '+' : ''}${t60.toFixed(1)}%`
  }
  let w52 = '52주 위치 n/a'
  if (hi52 != null && hi52 > 0) {
    const dd = ((last / hi52 - 1) * 100).toFixed(1)
    w52 = `52주 신고가 ${dd}%`
  }
  const sub = `${vs60} · ${w52}`

  let severity: MetricSeverity = 'neutral'
  let riskStrip: RiskStrip = 'neutral'
  let riskBadge: string | undefined
  if (trend20Pct > 40) {
    severity = 'danger'
    riskStrip = 'danger'
    riskBadge = '이격 극단'
  } else if (trend20Pct > 25) {
    severity = 'warning'
    riskStrip = 'orange'
    riskBadge = '단기 과열'
  }
  return { primary, line, sub, severity, riskStrip, riskBadge, trend20Pct }
}
