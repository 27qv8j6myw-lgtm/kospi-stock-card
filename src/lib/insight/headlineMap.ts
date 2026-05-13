export function getHeadlineByStage(entryStage: string, fundamentalSignal?: string): string {
  const v = String(entryStage ?? '')
  if (v.includes('적극 매수')) return '펀더멘털 강세, 적극 진입 권장'
  if (v.includes('회피')) return '진입은 피하는 편이 유리'
  if (v.includes('전량 익절')) return '잔여 전량 청산 검토 구간'
  if (v.includes('분할 익절')) return '익절 우선 검토 구간'
  if (v.includes('관망 (과열)')) return '단기 과열, 눌림 대기 구간'
  if (v.includes('관망')) return '조정 시 진입 검토'
  if (v.includes('보유')) {
    if (fundamentalSignal === 'strong') {
      return '과열에도 펀더멘털 견고, 보유 유지'
    }
    return '포지션 유지 구간'
  }
  if (v.includes('분할 매수')) return '조건부 분할 진입 가능'
  if (v.includes('신규 매수') || v.includes('신규')) return '신규 분할 진입 가능 구간'
  return '진입 판단 필요'
}
