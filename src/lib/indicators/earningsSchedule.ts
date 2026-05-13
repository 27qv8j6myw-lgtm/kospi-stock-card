import type { MetricSeverity, RiskStrip } from './types'

export type EarningsCardResult = {
  primary: string
  sub: string
  severity: MetricSeverity
  riskStrip: RiskStrip
}

/** 네이버/KIND 연동 전 — 플레이스홀더 */
export function computeEarningsCard(_code6: string): EarningsCardResult {
  return {
    primary: '미연동',
    sub: '실적 D-day·서프라이즈는 KIND/네이버 IR 연동 예정',
    severity: 'neutral',
    riskStrip: 'neutral',
  }
}
