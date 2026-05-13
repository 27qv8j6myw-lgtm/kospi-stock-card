import type { ThreeMonthStrategyInput } from '../../types/stock'
import type { ExecutionStrategyInputs } from './types'

/** `ThreeMonthStrategyInput` → 실행 전략 순수 입력 (기본값만 여기서 보강) */
export function fromThreeMonthStrategyInput(input: ThreeMonthStrategyInput): ExecutionStrategyInputs {
  const recentLow20 =
    input.recentLow20 != null && input.recentLow20 > 0
      ? input.recentLow20
      : Math.min(input.supportPrice, Math.round(input.currentPrice * 0.94))

  return {
    price: input.currentPrice,
    entryPrice: input.entryPrice,
    structureScore: input.structureScore,
    executionScore: input.executionScore,
    rsi14: input.rsi14,
    atrDistanceAbs: input.atrDistance,
    atr14: input.atr14,
    weightedRiskReward: input.riskRewardRatio,
    consensusAvgTargetPrice: input.consensusAvgTargetPrice,
    consensusMaxTargetPrice: input.consensusMaxTargetPrice ?? null,
    recentLow20,
    realizedVol60AnnPct: input.realizedVol60AnnPct ?? null,
    ma5: input.ma5 ?? null,
    priorSwingHigh: input.priorSwingHigh ?? null,
    volumeVs5dAvgRatio: input.volumeVs5dAvgRatio ?? null,
    pnlSinceEntryPct: input.pnlSinceEntryPct ?? null,
    firstTakeProfitReached: input.firstTakeProfitReached,
    stopBreachedReentry: input.stopBreachedReentry,
    currentPositionPct: input.currentPositionPct ?? null,
    daysSinceEntry: input.daysSinceEntry ?? null,
    sectorName: input.sectorName ?? null,
    operatingMarginTtmPct: input.operatingMarginTtmPct ?? null,
    operatingMarginYoYPp: input.operatingMarginYoYPp ?? null,
    forwardPer: input.forwardPer ?? null,
    fiveYearAvgPer: input.fiveYearAvgPer ?? null,
    epsGrowthYoYPct: input.epsGrowthYoYPct ?? null,
    trailingPer: input.trailingPer ?? null,
  }
}
