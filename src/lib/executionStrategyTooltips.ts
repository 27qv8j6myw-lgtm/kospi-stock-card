import type { IndicatorTooltipBlock } from './indicatorTooltipCopy'
import { executionEducation, type ExecutionEducationKey } from './executionEducation'

export function executionEducationTooltip(key: ExecutionEducationKey): IndicatorTooltipBlock {
  const b = executionEducation[key]
  return {
    title: b.title,
    description: `${b.simple} ${b.why}`,
    thresholds: b.howToRead.map((r) => `${r.label}: ${r.meaning}`).join('\n'),
  }
}

export const entryDecisionTooltip: IndicatorTooltipBlock = {
  title: '진입 판단',
  description:
    '구조·실행·RSI·ATR 이격 등을 종합해 지금이 신규 진입·보유·익절·회피 중 어디에 가까운지 한 줄로 보여 줍니다.',
  thresholds: '과열·이격이 크면 익절·관망 쪽으로 기울 수 있습니다. 최종 판단은 본인 책임입니다.',
}
