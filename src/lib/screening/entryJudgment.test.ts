import { describe, expect, it } from 'vitest'
import {
  assessFundamental,
  calculateFundamentalAcceleratedWeight,
  judgeEntry,
  treeStageToKo,
} from './entryJudgment'

describe('assessFundamental', () => {
  it('삼성 시나리오: 2/3 moderate (PER 밸류 X)', () => {
    const r = assessFundamental({
      currentPrice: 277_000,
      consensusAvg: 332_000,
      consensusHigh: 360_000,
      operatingMargin: 20,
      operatingMarginYoY: 0,
      forwardPer: 42,
      fiveYearAvgPer: 13,
      epsGrowthYoY: 10,
    })
    expect(r.details.upsideOk).toBe(true)
    expect(r.details.marginOk).toBe(true)
    expect(r.details.valuationOk).toBe(false)
    expect(r.score).toBe(2)
    expect(r.signal).toBe('moderate')
  })

  it('HD 가상: 3/3 strong', () => {
    const r = assessFundamental({
      currentPrice: 100_000,
      consensusAvg: 125_000,
      consensusHigh: 130_000,
      operatingMargin: 18,
      operatingMarginYoY: 0,
      forwardPer: 22,
      fiveYearAvgPer: 18,
      epsGrowthYoY: 12,
    })
    expect(r.signal).toBe('strong')
    expect(r.score).toBe(3)
  })

  it('펀더 약함: 0/3 weak', () => {
    const r = assessFundamental({
      currentPrice: 100_000,
      consensusAvg: 104_000,
      consensusHigh: 105_000,
      operatingMargin: 8,
      operatingMarginYoY: 0,
      forwardPer: 50,
      fiveYearAvgPer: 12,
      epsGrowthYoY: 5,
    })
    expect(r.signal).toBe('weak')
    expect(r.score).toBe(0)
  })
})

describe('judgeEntry 전후 비교 시나리오', () => {
  const baseFundSamsung = {
    currentPrice: 277_000,
    consensusAvg: 332_000,
    consensusHigh: 360_000,
    operatingMargin: 20,
    operatingMarginYoY: 0,
    forwardPer: 42,
    fiveYearAvgPer: 13,
    epsGrowthYoY: 10,
  } as const

  it('A) 삼성: RSI 79·ATR 3.6 + moderate → 보유 유지 (구 예시는 관망/REJECT에 가까웠음)', () => {
    const j = judgeEntry({
      structureScore: 78,
      executionScore: 70,
      rsi: 79,
      atrGap: 3.6,
      fundamental: { ...baseFundSamsung },
    })
    expect(j.stage).toBe('hold')
    expect(treeStageToKo(j.stage)).toBe('보유 유지')
  })

  it('B) HD 가상: RSI 75·ATR 3.8 + strong → 적극 매수', () => {
    const j = judgeEntry({
      structureScore: 80,
      executionScore: 72,
      rsi: 75,
      atrGap: 3.8,
      fundamental: {
        currentPrice: 100_000,
        consensusAvg: 125_000,
        consensusHigh: 130_000,
        operatingMargin: 18,
        operatingMarginYoY: 0,
        forwardPer: 22,
        fiveYearAvgPer: 18,
        epsGrowthYoY: 12,
      },
    })
    expect(j.stage).toBe('buy_aggressive')
    expect(treeStageToKo(j.stage)).toBe('적극 매수')
  })

  it('C) 펀더 약함 + RSI 75 → 관망 (과열)', () => {
    const j = judgeEntry({
      structureScore: 78,
      executionScore: 70,
      rsi: 75,
      atrGap: 2,
      fundamental: {
        currentPrice: 100_000,
        consensusAvg: 104_000,
        consensusHigh: 105_000,
        operatingMargin: 8,
        operatingMarginYoY: 0,
        forwardPer: 50,
        fiveYearAvgPer: 12,
        epsGrowthYoY: 5,
      },
    })
    expect(j.stage).toBe('watch_overheat')
  })
})

describe('calculateFundamentalAcceleratedWeight', () => {
  it('적극 매수 1.5× 후 20% 캡', () => {
    const fund = assessFundamental({
      currentPrice: 100_000,
      consensusAvg: 125_000,
      consensusHigh: 130_000,
      operatingMargin: 18,
      operatingMarginYoY: 0,
      forwardPer: 22,
      fiveYearAvgPer: 18,
      epsGrowthYoY: 12,
    })
    const w = calculateFundamentalAcceleratedWeight({
      baseWeight: 15,
      stage: 'buy_aggressive',
      fundamental: fund,
      rrRatio: 2,
      volatility60d: 30,
    })
    expect(w).toBe(20)
  })
})
