import type { ExecutionEntryDecision } from './types'

/** [8. 3개월 전략 요약] — 진입 판단별 한 줄 */
export function computeStrategySummaryLine(entry: ExecutionEntryDecision): string {
  switch (entry) {
    case '신규 매수':
      return '구조·실행 양호 — 분할 진입 후 +9% 1차 익절 준비'
    case '분할 매수':
      return '조건부 진입 가능 — 비중 절반, 손절 타이트'
    case '보유 유지':
      return '포지션 유지, +9% 도달 시 50% 익절'
    case '관망 (과열)':
      return '과열권 — 신규 진입 보류, 조정 대기'
    case '분할 익절':
      return '과열·익절 구간 — 50% 분할 매도 우선'
    case '전량 익절':
      return '임계값 초과 — 잔여 전량 청산 검토'
    case '회피':
      return '구조 점수 부족 — 종목 제외'
    case '적극 매수':
      return '펀더멘털 강세 — 비중 상한 내 분할 적극 진입 검토'
    default:
      return '조건을 확인한 뒤 대응하세요.'
  }
}
