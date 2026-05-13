import { describe, expect, it } from 'vitest'
import { atrWilder } from './coreMath'
import { calculateAtr14Sma, trueRangesFromBars } from './atr14'
import type { OhlcvBar } from './types'

function bar(
  o: number,
  h: number,
  l: number,
  c: number,
  v = 1_000_000,
): OhlcvBar {
  return { ts: '', open: o, high: h, low: l, close: c, volume: v }
}

describe('calculateAtr14Sma', () => {
  it('최근 14 TR 평균이며 합계가 아님', () => {
    const bars: OhlcvBar[] = []
    let c = 300_000
    bars.push(bar(c, c, c, c))
    for (let i = 0; i < 20; i++) {
      const prev = c
      c += 1000
      const o = prev
      const h = Math.max(o, c) + 500
      const l = Math.min(o, c) - 500
      bars.push(bar(o, h, l, c))
    }
    const trs = trueRangesFromBars(bars)
    const last14 = trs.slice(-14)
    const manual = last14.reduce((a, b) => a + b, 0) / 14
    const atrSma = calculateAtr14Sma(bars, 14)
    expect(atrSma).not.toBeNull()
    expect(atrSma).toBeCloseTo(manual, 6)
    const bogusSum = last14.reduce((a, b) => a + b, 0)
    expect(bogusSum / (atrSma as number)).toBeGreaterThan(10)
  })
})

describe('atrWilder sanity', () => {
  it('Wilder 값이 TR 평균의 10배 초과면 SMA(TR)로 보정', () => {
    const bars: OhlcvBar[] = []
    let c = 310_000
    bars.push(bar(c, c, c, c))
    for (let i = 0; i < 25; i++) {
      const prev = c
      c += 800
      const o = prev
      const h = Math.max(o, c) + 400
      const l = Math.min(o, c) - 400
      bars.push(bar(o, h, l, c))
    }
    const smaTr = calculateAtr14Sma(bars, 14)
    const w = atrWilder(bars, 14)
    expect(smaTr).not.toBeNull()
    expect(w).not.toBeNull()
    if (smaTr != null && w != null) {
      expect(w / smaTr).toBeLessThan(12)
    }
  })
})
