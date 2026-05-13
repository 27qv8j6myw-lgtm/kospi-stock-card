import type { UnifiedEntryStageTier } from '../types/stock'

/** 목표가 섹션 표시 모드 (진입 단계·실행전략과 정합) */
export type TargetPriceDisplayMode = 'normal' | 'takeProfitReference' | 'nonEntryReference'

type ResolveParams = {
  /** 통합 진입 단계 티어 (Final Grade 제거 후) */
  entryStageTier?: UnifiedEntryStageTier
  /** 레거시/AI 한글 라벨 (티어 없을 때만 보조) */
  entryStageLabel?: string
  /** `getStrategy` 결과 — SummaryInfo.strategy */
  strategy: string
  /** `calculateThreeMonthStrategy` 의 entryDecision */
  threeMonthEntryDecision?: string
  /** NaN 이면 “추천 비중 0%” 규칙을 적용하지 않음 */
  recommendedPositionPct: number
}

/**
 * - 익절 / 분할익절: 잔여 상승 시나리오 참고 (노란 안내)
 * - 관망·제외·추천비중 0% (보유/신규진입 제외): 비진입 참고
 * - 보유·신규진입 등: 기본
 */
export function resolveTargetPriceDisplayMode(p: ResolveParams): TargetPriceDisplayMode {
  const tier = p.entryStageTier
  const entry = (p.entryStageLabel || '').trim()
  const dec = (p.threeMonthEntryDecision || '').trim()
  const rec = p.recommendedPositionPct
  const zeroRec = Number.isFinite(rec) && rec === 0

  if (
    tier === 'SCALE_OUT' ||
    entry === '익절' ||
    entry === '분할 익절' ||
    dec === '분할익절' ||
    dec === '분할 익절' ||
    dec === '전량 익절'
  ) {
    return 'takeProfitReference'
  }

  const nonEntryTier = tier === 'EXIT_ALL_OR_AVOID'
  const nonEntryLegacy =
    entry === '관망' ||
    entry === '제외' ||
    dec === '제외' ||
    dec === '관망' ||
    dec === '관망 (과열)' ||
    dec === '회피' ||
    p.strategy === 'REJECT'

  let zeroRecNonEntry = false
  if (zeroRec) {
    if (tier != null) {
      zeroRecNonEntry =
        tier !== 'NEW_ENTRY' && tier !== 'SCALE_IN' && tier !== 'HOLD_STEADY'
    } else {
      zeroRecNonEntry =
        entry !== '보유' &&
        entry !== '신규진입' &&
        entry !== '신규 진입' &&
        entry !== '신규 매수' &&
        entry !== '적극 매수' &&
        entry !== '분할 매수' &&
        entry !== '보유 유지'
    }
  }

  if (nonEntryTier || nonEntryLegacy || zeroRecNonEntry) {
    return 'nonEntryReference'
  }

  return 'normal'
}
