import { atrWilder, sma } from './coreMath'
import type { OhlcvBar, RiskStrip } from './types'

export type AtrDistanceResult = {
  value: number
  line: string
  sub: string
  riskStrip: RiskStrip
  riskBadge?: string
}

export function computeAtrDistance(bars: OhlcvBar[]): AtrDistanceResult {
  const closes = bars.map((b) => b.close)
  const sma20 = sma(closes, 20)
  const last = closes[closes.length - 1]
  const atr = atrWilder(bars, 14)
  if (sma20 == null || atr == null || !(atr > 0)) {
    return {
      value: 0,
      line: '0.0 ATR',
      sub: '데이터 부족',
      riskStrip: 'neutral',
    }
  }
  const raw = (last - sma20) / atr
  const valueAbs = Math.abs(raw)
  const line = `${raw >= 0 ? '+' : ''}${raw.toFixed(1)} ATR`
  const side = raw >= 0 ? '20MA 위' : '20MA 아래'
  const sub = `현재 ${valueAbs.toFixed(1)} ATR · ${side}`

  let riskStrip: RiskStrip = 'neutral'
  let riskBadge: string | undefined
  if (valueAbs >= 7) {
    riskStrip = 'danger'
    riskBadge = '임계값 2배 초과 · 익절 우선'
  } else if (valueAbs >= 5) {
    riskStrip = 'orange'
    riskBadge = '임계값 1.5배 초과'
  } else if (valueAbs >= 3.5) {
    riskStrip = 'warning'
    riskBadge = '추격매수 금지선 초과'
  } else if (valueAbs > 1.5) {
    riskStrip = 'info'
  }
  return { value: valueAbs, line, sub, riskStrip, riskBadge }
}
