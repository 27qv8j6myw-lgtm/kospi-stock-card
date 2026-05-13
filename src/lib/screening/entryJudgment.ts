import type { ExecutionEntryDecision } from '../strategy/types'

/** 펀더멘털 가속 트랙 입력 */
export type FundamentalInput = {
  currentPrice: number
  consensusAvg: number
  consensusHigh: number
  operatingMargin: number
  operatingMarginYoY: number
  forwardPer: number
  fiveYearAvgPer: number
  epsGrowthYoY: number
}

export type FundamentalSignal = 'strong' | 'moderate' | 'weak'

/** 진입 트리 단계 (영문 코드) — `stock.ts` 의 `EntryStage`(ACCEPT…)와 별개 */
export type EntryTreeStage =
  | 'avoid'
  | 'take_full_profit'
  | 'take_partial_profit'
  | 'watch_overheat'
  | 'buy_new'
  | 'buy_split'
  | 'buy_aggressive'
  | 'hold'

export type EntryTreeJudgment = {
  stage: EntryTreeStage
  stageLabel: string
  rationale: string
  fundamentalSignal: FundamentalSignal
}

export function assessFundamental(input: FundamentalInput): {
  signal: FundamentalSignal
  score: number
  details: {
    upsideOk: boolean
    marginOk: boolean
    valuationOk: boolean
  }
} {
  const upsidePct = ((input.consensusAvg - input.currentPrice) / input.currentPrice) * 100
  const upsideOk = upsidePct >= 10

  const marginOk = input.operatingMargin >= 15 || input.operatingMarginYoY >= 2

  let valuationOk: boolean
  if (input.forwardPer > 0 && input.fiveYearAvgPer > 0) {
    valuationOk = input.forwardPer <= input.fiveYearAvgPer * 1.5
  } else {
    valuationOk = input.epsGrowthYoY >= 20
  }

  const score = [upsideOk, marginOk, valuationOk].filter(Boolean).length

  let signal: FundamentalSignal
  if (score >= 3) signal = 'strong'
  else if (score >= 2) signal = 'moderate'
  else signal = 'weak'

  return {
    signal,
    score,
    details: { upsideOk, marginOk, valuationOk },
  }
}

const KO: Record<EntryTreeStage, ExecutionEntryDecision> = {
  avoid: '회피',
  take_full_profit: '전량 익절',
  take_partial_profit: '분할 익절',
  watch_overheat: '관망 (과열)',
  buy_new: '신규 매수',
  buy_split: '분할 매수',
  buy_aggressive: '적극 매수',
  hold: '보유 유지',
}

const LABEL: Record<EntryTreeStage, string> = {
  avoid: '회피',
  take_full_profit: '전량 익절',
  take_partial_profit: '분할 익절',
  watch_overheat: '관망 (과열)',
  buy_new: '신규 매수',
  buy_split: '분할 매수',
  buy_aggressive: '적극 매수',
  hold: '보유 유지',
}

export function treeStageToKo(stage: EntryTreeStage): ExecutionEntryDecision {
  return KO[stage]
}

export function entryDecisionToTreeStage(d: ExecutionEntryDecision): EntryTreeStage | null {
  const rev = Object.entries(KO).find(([, v]) => v === d)
  return rev ? (rev[0] as EntryTreeStage) : null
}

export function judgeEntry(input: {
  structureScore: number
  executionScore: number
  rsi: number
  atrGap: number
  fundamental: FundamentalInput
}): EntryTreeJudgment {
  const { structureScore, executionScore, rsi, atrGap, fundamental } = input
  const fund = assessFundamental(fundamental)

  if (structureScore < 50) {
    return {
      stage: 'avoid',
      stageLabel: LABEL.avoid,
      rationale: `구조 점수 ${structureScore}점 (50 미만)`,
      fundamentalSignal: fund.signal,
    }
  }

  if (rsi >= 90 || atrGap >= 7.5) {
    return {
      stage: 'take_full_profit',
      stageLabel: LABEL.take_full_profit,
      rationale:
        rsi >= 90 ? `RSI ${rsi.toFixed(0)} 극단 과열` : `ATR 이격 ${atrGap.toFixed(1)} 임계 2배 초과`,
      fundamentalSignal: fund.signal,
    }
  }

  if (rsi >= 80 || atrGap >= 5.5) {
    if (fund.signal === 'strong') {
      const upPct = ((fundamental.consensusAvg - fundamental.currentPrice) / fundamental.currentPrice) * 100
      return {
        stage: 'hold',
        stageLabel: LABEL.hold,
        rationale: `과열 신호 있으나 펀더멘털 강세 (컨센 +${upPct.toFixed(0)}% 여력)`,
        fundamentalSignal: fund.signal,
      }
    }
    return {
      stage: 'take_partial_profit',
      stageLabel: LABEL.take_partial_profit,
      rationale: rsi >= 80 ? `RSI ${rsi.toFixed(0)} 과매수 영역` : `ATR 이격 ${atrGap.toFixed(1)} 임계 초과`,
      fundamentalSignal: fund.signal,
    }
  }

  if (rsi >= 70 || atrGap >= 3.5) {
    if (fund.signal === 'strong') {
      return {
        stage: 'buy_aggressive',
        stageLabel: LABEL.buy_aggressive,
        rationale: `펀더멘털 3박자 충족 (컨센 여력 + 영업이익률 ${fundamental.operatingMargin.toFixed(1)}% + PER 합리). 과열 구간 분할 진입 가능`,
        fundamentalSignal: fund.signal,
      }
    }
    if (fund.signal === 'moderate') {
      return {
        stage: 'hold',
        stageLabel: LABEL.hold,
        rationale: `과열 신호 있으나 펀더멘털 양호 (${fund.score}/3 충족)`,
        fundamentalSignal: fund.signal,
      }
    }
    return {
      stage: 'watch_overheat',
      stageLabel: LABEL.watch_overheat,
      rationale:
        rsi >= 70 ? `RSI ${rsi.toFixed(0)} 과매수 + 펀더멘털 약함` : `ATR 이격 ${atrGap.toFixed(1)} + 펀더멘털 약함`,
      fundamentalSignal: fund.signal,
    }
  }

  if (structureScore >= 75 && atrGap <= 2.5 && rsi <= 65 && executionScore >= 65) {
    if (fund.signal === 'strong') {
      return {
        stage: 'buy_aggressive',
        stageLabel: LABEL.buy_aggressive,
        rationale: `정상 구간 + 펀더멘털 3박자 충족. 비중 확대 가능`,
        fundamentalSignal: fund.signal,
      }
    }
    return {
      stage: 'buy_new',
      stageLabel: LABEL.buy_new,
      rationale: `구조 ${structureScore}/실행 ${executionScore} 양호 + 과열 신호 없음`,
      fundamentalSignal: fund.signal,
    }
  }

  if (structureScore >= 65 && atrGap <= 3.5) {
    return {
      stage: 'buy_split',
      stageLabel: LABEL.buy_split,
      rationale: `조건부 진입 가능. 비중 절반 + 손절 타이트`,
      fundamentalSignal: fund.signal,
    }
  }

  return {
    stage: 'hold',
    stageLabel: LABEL.hold,
    rationale: `명확한 진입/익절 신호 없음`,
    fundamentalSignal: fund.signal,
  }
}

export type FundamentalAssessment = ReturnType<typeof assessFundamental>

export function buildEntryReasonShort(input: {
  rsi: number
  atrGap: number
  fundamental: FundamentalAssessment
}): string {
  const parts: string[] = []
  if (input.rsi >= 70) parts.push(`RSI ${input.rsi.toFixed(0)}`)
  if (input.atrGap >= 3.5) parts.push(`ATR ${input.atrGap.toFixed(1)}`)
  const fundLabel =
    input.fundamental.signal === 'strong'
      ? `펀더 ${input.fundamental.score}/3`
      : input.fundamental.signal === 'moderate'
        ? `펀더 ${input.fundamental.score}/3`
        : `펀더 약함`
  parts.push(fundLabel)
  return parts.join(' · ')
}

const STAGE_MULT: Record<EntryTreeStage, number> = {
  buy_aggressive: 1.5,
  buy_new: 1.0,
  buy_split: 0.5,
  hold: 0,
  watch_overheat: 0,
  take_partial_profit: 0,
  take_full_profit: 0,
  avoid: 0,
}

/**
 * 펀더멘털 가속 반영 신규 비중(%) — 변동성·R/R 보정 후 20% 캡.
 * `보유 유지`·`분할 익절` 등은 호출부에서 별도 처리.
 */
export function calculateFundamentalAcceleratedWeight(input: {
  baseWeight: number
  stage: EntryTreeStage
  fundamental: FundamentalAssessment
  rrRatio: number
  volatility60d: number
}): number {
  let weight = input.baseWeight
  weight *= STAGE_MULT[input.stage]
  if (input.stage === 'buy_new' && input.fundamental.signal === 'strong') {
    weight *= 1.3
  }
  if (input.volatility60d > 50) weight *= 0.3
  else if (input.volatility60d > 35) weight *= 0.5
  if (input.rrRatio < 1.0) weight *= 0
  else if (input.rrRatio < 1.5) weight *= 0.5
  return Math.min(weight, 20)
}

export function roundRecommendedPct(n: number): number {
  return Math.round(n * 10) / 10
}
