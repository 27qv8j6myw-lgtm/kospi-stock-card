import { resolveSectorFundBench } from '../fundamentalCards'
import {
  assessFundamental,
  buildEntryReasonShort,
  judgeEntry,
  treeStageToKo,
  type FundamentalInput,
} from '../screening/entryJudgment'
import type { ExecutionEntryDecision, ExecutionStrategyInputs } from './types'

function buildFundamentalInput(i: ExecutionStrategyInputs): FundamentalInput {
  const currentPrice = i.entryPrice != null && i.entryPrice > 0 ? i.entryPrice : i.price
  const consensusAvg =
    i.consensusAvgTargetPrice != null && i.consensusAvgTargetPrice > 0
      ? i.consensusAvgTargetPrice
      : currentPrice
  const consensusHigh =
    i.consensusMaxTargetPrice != null && i.consensusMaxTargetPrice > 0
      ? i.consensusMaxTargetPrice
      : consensusAvg * 1.06

  const bench = resolveSectorFundBench(i.sectorName ?? '')
  const fiveYear = i.fiveYearAvgPer ?? bench.per5y
  const trailing = i.trailingPer ?? 0
  const fwd =
    i.forwardPer != null && i.forwardPer > 0
      ? i.forwardPer
      : trailing > 0
        ? trailing * 0.8
        : 0

  return {
    currentPrice,
    consensusAvg,
    consensusHigh,
    operatingMargin: i.operatingMarginTtmPct ?? 0,
    operatingMarginYoY: i.operatingMarginYoYPp ?? 0,
    forwardPer: fwd,
    fiveYearAvgPer: fiveYear > 0 ? fiveYear : 0,
    epsGrowthYoY: i.epsGrowthYoYPct ?? bench.epsGrowthYoYSector,
  }
}

export type EntryDecisionBundle = {
  decision: ExecutionEntryDecision
  rationale: string
  fundamentalSignal: ReturnType<typeof assessFundamental>['signal']
  fund: ReturnType<typeof assessFundamental>
  reasonShort: string
}

/**
 * 진입 트리 + 펀더멘털 가속 — `computeExecutionStrategy`·UI에서 동일 번들 사용.
 */
export function computeEntryDecisionBundle(i: ExecutionStrategyInputs): EntryDecisionBundle {
  const fundamental = buildFundamentalInput(i)
  const fund = assessFundamental(fundamental)
  const judgment = judgeEntry({
    structureScore: i.structureScore,
    executionScore: i.executionScore,
    rsi: i.rsi14,
    atrGap: i.atrDistanceAbs,
    fundamental,
  })
  const decision = treeStageToKo(judgment.stage)
  const reasonShort = buildEntryReasonShort({
    rsi: i.rsi14,
    atrGap: i.atrDistanceAbs,
    fundamental: fund,
  })
  return {
    decision,
    rationale: judgment.rationale,
    fundamentalSignal: fund.signal,
    fund,
    reasonShort,
  }
}

export function computeEntryDecision(i: ExecutionStrategyInputs): ExecutionEntryDecision {
  return computeEntryDecisionBundle(i).decision
}
