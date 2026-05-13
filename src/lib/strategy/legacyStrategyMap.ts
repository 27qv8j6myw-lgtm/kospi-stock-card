import type { EntryStage, ExecutionSummaryUi, Strategy, UnifiedEntryStageTier } from '../../types/stock'
import type { ExecutionEntryDecision } from './types'

/** AI·레거시 `Strategy` 열거형과의 호환 */
export function legacyStrategyFromEntryDecision(d: ExecutionEntryDecision): Strategy {
  if (d === '회피') return 'REJECT'
  if (d === '전량 익절' || d === '분할 익절') return 'TAKE_PROFIT'
  if (d === '관망 (과열)') return 'WATCH_ONLY'
  if (d === '적극 매수') return 'BUY_AGGRESSIVE'
  if (d === '신규 매수' || d === '분할 매수') return 'BUY'
  return 'HOLD'
}

export function legacyEntryStageFromEntryDecision(d: ExecutionEntryDecision): EntryStage {
  if (d === '회피') return 'REJECT'
  if (d === '적극 매수' || d === '신규 매수') return 'ACCEPT'
  if (d === '분할 매수') return 'CAUTION'
  if (d === '관망 (과열)') return 'WATCH'
  return 'CAUTION'
}

const TIER: Record<ExecutionEntryDecision, UnifiedEntryStageTier> = {
  회피: 'EXIT_ALL_OR_AVOID',
  '전량 익절': 'EXIT_ALL_OR_AVOID',
  '분할 익절': 'SCALE_OUT',
  '관망 (과열)': 'HOLD_STEADY',
  '신규 매수': 'NEW_ENTRY',
  '적극 매수': 'NEW_ENTRY',
  '분할 매수': 'SCALE_IN',
  '보유 유지': 'HOLD_STEADY',
}

const ACTION: Record<ExecutionEntryDecision, string> = {
  회피: '구조 미달로 신규 진입을 피하고 유니버스에서 제외하세요.',
  '전량 익절': 'RSI·ATR 임계 초과 시 잔여 물량 전량 청산을 검토하세요.',
  '분할 익절': '과열 신호와 겹치므로 절반 규모로 분할 매도하세요.',
  '관망 (과열)': '신규 매수는 보류하고 조정·눌림을 기다리세요.',
  '신규 매수': '손절·비중 한도를 정한 뒤 분할로 신규 진입하세요.',
  '적극 매수': '펀더멘털이 견고할 때 과열 구간에서도 비중 상한 내 분할로 적극 진입을 검토하세요.',
  '분할 매수': '지지 확인 후 비중의 절반 규모로 나눠 매수하세요.',
  '보유 유지': '추가 매수·급매도 없이 규칙대로 포지션을 유지하세요.',
}

/** 요약 패널·히어로 카드용 UI (색상은 `tier`로 결정) */
export function executionUiFromEntryDecision(d: ExecutionEntryDecision): ExecutionSummaryUi {
  const tier = TIER[d]
  const strategyLabelKo =
    d === '적극 매수'
      ? '적극 매수'
      : d === '신규 매수'
        ? '신규 매수'
        : d === '분할 매수'
          ? '분할 매수'
          : d === '보유 유지'
            ? '보유'
            : d === '관망 (과열)'
              ? '관망'
              : d === '분할 익절'
                ? '분할 익절'
                : d === '전량 익절'
                  ? '전량 익절'
                  : '회피'

  return {
    tier,
    strategyLabelKo,
    entryStageLabel: d,
    entryStageAction: ACTION[d],
  }
}
