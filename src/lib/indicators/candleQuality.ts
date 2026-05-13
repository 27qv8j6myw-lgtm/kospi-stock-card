import { clvSingle } from './coreMath'
import type { OhlcvBar } from './types'

export type CandleQualityResult = {
  primary: string
  line: string
  sub: string
  clv5: number | null
  clv10: number | null
}

function clvAvg(bars: OhlcvBar[], n: number): number | null {
  if (bars.length < n) return null
  const slice = bars.slice(-n)
  const vals: number[] = []
  for (const b of slice) {
    const c = clvSingle(b)
    if (c != null) vals.push(c)
  }
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

function labelForAvg(v: number | null): string {
  if (v == null) return 'n/a'
  if (v >= 0.5) return '강함 (종가 고점 근접)'
  if (v >= 0) return '중립 (중간대)'
  return '약함 (종가 저점 근접)'
}

function fmtSignedClv(n: number): string {
  if (!Number.isFinite(n)) return '0.00'
  if (n === 0) return '0.00'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}`
}

export function computeCandleQuality(bars: OhlcvBar[]): CandleQualityResult {
  const c5 = clvAvg(bars, 5)
  const c10 = clvAvg(bars, 10)
  const l5 = labelForAvg(c5)
  const l10 = labelForAvg(c10)
  const primary =
    c5 != null && c10 != null
      ? `CLV5 ${fmtSignedClv(c5)} · CLV10 ${fmtSignedClv(c10)}`
      : 'CLV 데이터 부족'
  const line = primary
  const sub =
    c5 != null && c10 != null
      ? `${l5.includes('강함') || l10.includes('강함') ? '매수세 우위' : l5.includes('약함') || l10.includes('약함') ? '매도세 우위' : '수급 균형'} · ${l5} / ${l10}`
      : '고가·저가 데이터 필요'
  return { primary, line, sub, clv5: c5, clv10: c10 }
}
