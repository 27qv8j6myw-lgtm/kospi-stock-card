import { mfi14, rsiFromCloses } from './coreMath'
import type { OhlcvBar, RiskStrip } from './types'

export type RsiMfiCardResult = {
  primary: string
  line: string
  sub: string
  riskStrip: RiskStrip
  riskBadge?: string
  showRiskInfoIcon?: boolean
}

export function computeRsiMfiCard(bars: OhlcvBar[]): RsiMfiCardResult {
  const closes = bars.map((b) => b.close)
  const rsi = rsiFromCloses(closes, 14)
  const mfi = mfi14(bars)
  const rsiV = rsi != null ? Math.round(rsi) : null
  const mfiV = mfi != null ? Math.round(mfi) : null
  const primary = rsiV != null ? `RSI ${rsiV}` : 'RSI N/A'
  const line = `RSI ${rsiV ?? 'N/A'} / MFI ${mfiV ?? 'N/A'}`

  let rsiZone = '중립 구간'
  if (rsiV != null) {
    if (rsiV >= 80) rsiZone = '과매수 영역'
    else if (rsiV >= 70) rsiZone = '과매수 진입'
    else if (rsiV <= 30) rsiZone = '과매도 근접'
  }
  const sub = mfiV != null ? `MFI ${mfiV} · ${rsiZone}` : 'MFI 데이터 부족'

  let riskStrip: RiskStrip = 'neutral'
  let riskBadge: string | undefined
  let showRiskInfoIcon: boolean | undefined
  if (rsiV != null) {
    if (rsiV >= 90) {
      riskStrip = 'danger'
      riskBadge = '익절 강제 검토'
    } else if (rsiV >= 80) {
      riskStrip = 'orange'
      riskBadge = '추격매수 금지'
    } else if (rsiV >= 70) {
      riskStrip = 'warning'
      riskBadge = '과매수 진입'
    } else if (rsiV <= 30) {
      riskStrip = 'info'
      showRiskInfoIcon = true
    }
  }
  return { primary, line, sub, riskStrip, riskBadge, showRiskInfoIcon }
}
