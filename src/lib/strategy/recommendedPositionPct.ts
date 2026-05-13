import {
  calculateFundamentalAcceleratedWeight,
  entryDecisionToTreeStage,
  roundRecommendedPct,
  type FundamentalAssessment,
} from '../screening/entryJudgment'
import type { ExecutionEntryDecision, ExecutionStrategyInputs } from './types'
import { estimateRealizedVol60AnnFromAtr } from './volatilityEstimate'

const BASE = 15

/**
 * [2. 추천 비중] — 펀더멘털 가속 반영(적극 매수 1.5× 등) + 기존 보유·익절 분기 유지.
 */
export function computeRecommendedPositionPct(
  i: ExecutionStrategyInputs,
  entry: ExecutionEntryDecision,
  fund: FundamentalAssessment,
): number {
  const vol60 = i.realizedVol60AnnPct ?? estimateRealizedVol60AnnFromAtr(i.atr14, i.price)

  if (entry === '분할 익절') {
    const cur = i.currentPositionPct
    if (cur == null || !Number.isFinite(cur)) return 0
    return roundRecommendedPct(Math.max(0, cur - 50))
  }

  if (entry === '보유 유지') {
    const cur = i.currentPositionPct
    if (cur != null && Number.isFinite(cur)) return roundRecommendedPct(Math.max(0, Math.min(cur, 100)))
    const coreLegacy =
      BASE *
      (vol60 > 50 ? 0.3 : vol60 > 35 ? 0.5 : 1) *
      (i.atrDistanceAbs >= 3.5 ? 0 : i.atrDistanceAbs >= 2.5 ? 0.5 : 1) *
      (i.rsi14 >= 80 ? 0 : i.rsi14 >= 70 ? 0.5 : 1) *
      (i.weightedRiskReward < 1.0 ? 0 : i.weightedRiskReward < 1.5 ? 0.5 : 1)
    return roundRecommendedPct(Math.max(0, Math.min(coreLegacy, 15)))
  }

  if (
    entry === '회피' ||
    entry === '전량 익절' ||
    entry === '관망 (과열)'
  ) {
    return 0
  }

  const stage = entryDecisionToTreeStage(entry)
  if (
    stage === 'buy_aggressive' ||
    stage === 'buy_new' ||
    stage === 'buy_split'
  ) {
    return roundRecommendedPct(
      calculateFundamentalAcceleratedWeight({
        baseWeight: BASE,
        stage,
        fundamental: fund,
        rrRatio: i.weightedRiskReward,
        volatility60d: vol60,
      }),
    )
  }

  return 0
}
