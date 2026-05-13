import { describe, expect, it } from 'vitest'
import { calculateStopPriceV2 } from './stopPriceV2'

describe('calculateStopPriceV2 — 삼성 시나리오 (진입가 285,500, RSI 84)', () => {
  it('RSI≥80 → max(-4%, ATR1.5배), 사유 문구', () => {
    const entryPrice = 285_500
    const atr14 = 7613
    const tight4 = entryPrice * 0.96
    const atr15 = entryPrice - 1.5 * atr14
    const expected = Math.round(Math.max(tight4, atr15))

    const r = calculateStopPriceV2({
      currentPrice: entryPrice,
      entryPrice,
      atr14,
      low20: 270_000,
      rsi: 84,
      atrRatio: atr14 / entryPrice,
    })

    expect(r.reason).toBe('RSI 과열권 타이트 적용 (-4%)')
    expect(r.price).toBe(expected)
    expect(Number.parseFloat(r.lossPct)).toBeLessThan(0)
    expect(r.atrSanitized).toBe(false)
  })
})

describe('calculateStopPriceV2 — 일반 분기 (룰북 예시)', () => {
  it('base 279,000 · RSI 79 · ATR 5,500 · LOW20 268,500 → 후보 중 최댓값은 ATR', () => {
    const basePrice = 279_000
    const atr14 = 5_500
    const fixed = Math.round(basePrice * 0.94)
    const atr = Math.round(basePrice - 1.5 * atr14)
    const low20 = 268_500
    const tight = Math.round(basePrice * 0.96)
    const expected = Math.max(fixed, atr, low20, tight)

    const r = calculateStopPriceV2({
      currentPrice: basePrice,
      entryPrice: basePrice,
      atr14,
      low20,
      rsi: 79,
      atrRatio: atr14 / basePrice,
    })

    expect(r.basis).toBe('ATR')
    expect(r.price).toBe(expected)
    expect(r.candidates.find((c) => c.basis === 'ATR')?.price).toBe(atr)
    expect(r.atrSanitized).toBe(false)
    expect(fixed).toBe(262_260)
    expect(atr).toBe(270_750)
    expect(tight).toBe(267_840)
  })

  it('ATR 누락 시 후보용 ATR은 가격×1.8% 추정', () => {
    const basePrice = 100_000
    const r = calculateStopPriceV2({
      currentPrice: basePrice,
      entryPrice: basePrice,
      atr14: 0,
      low20: 90_000,
      rsi: 50,
      atrRatio: 0,
    })
    expect(r.usedAtrFallback).toBe(true)
    expect(r.atrSanitized).toBe(false)
    expect(r.candidates.some((c) => c.basis === 'ATR')).toBe(true)
  })

  it('ATR이 기준가의 5% 초과(단위 오류 의심)이면 상한 클램프 + atrSanitized', () => {
    const basePrice = 312_000
    const r = calculateStopPriceV2({
      currentPrice: basePrice,
      entryPrice: basePrice,
      atr14: 21_830,
      low20: 290_000,
      rsi: 50,
      atrRatio: 21_830 / basePrice,
    })
    expect(r.atrSanitized).toBe(true)
    const atrCand = r.candidates.find((c) => c.basis === 'ATR')
    expect(atrCand).toBeDefined()
    const atrUsed = basePrice - (atrCand?.price ?? 0)
    expect(atrUsed / basePrice).toBeLessThanOrEqual(0.041)
  })
})
