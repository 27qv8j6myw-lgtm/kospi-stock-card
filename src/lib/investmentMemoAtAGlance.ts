import type { DetailedInvestmentMemoResult } from '../types/aiBriefing'

function oneLine(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  if (!t) return ''
  if (t.length <= max) return t
  const cut = t.slice(0, max - 1)
  const i = cut.lastIndexOf(' ')
  return (i > max * 0.45 ? cut.slice(0, i) : cut) + '…'
}

function firstSentence(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  if (!t) return ''
  const m = t.match(/^.{1,220}?[.!?。](?:\s|$)/)
  if (m) return oneLine(m[0].trim(), max)
  return oneLine(t, max)
}

function firstSentenceFull(s: string): string {
  const t = s.replace(/\s+/g, ' ').trim()
  if (!t) return ''
  const m = t.match(/^.{1,220}?[.!?。](?:\s|$)/)
  return (m ? m[0] : t).trim()
}

function summaryLineWithoutTicker(memo: DetailedInvestmentMemoResult): string {
  if (memo.atAGlanceTitle && memo.atAGlanceTitle.trim()) {
    // 모델이 종목명을 넣었을 수 있어 간단히 제거
    const cleaned = memo.atAGlanceTitle
      .replace(/\([^)]+\)/g, '')
      .replace(/[A-Za-z0-9]{6,}/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (cleaned) return cleaned
  }
  const blob = [memo.paragraphs.join(' '), memo.keyPoints.join(' '), memo.strategyComment]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (blob.includes('52주') && (blob.includes('신고가') || blob.includes('최고가'))) {
    return '52주 최고가 갱신 구간'
  }
  if (blob.includes('목표가') && (blob.includes('상향') || blob.includes('리레이팅'))) {
    return '리레이팅 기대가 반영되는 흐름'
  }
  if (blob.includes('외국인') && blob.includes('기관') && blob.includes('순매수')) {
    return '수급 유입이 이어지는 구간'
  }
  if (memo.tone === 'bullish') return '상승 우위 흐름'
  if (memo.tone === 'caution') return '변동성 점검 구간'
  return '중립 흐름'
}

function conciseStrategyLine(memo: DetailedInvestmentMemoResult): string {
  // OpenAI가 생성한 5번 문단(지금 전략) 첫 문장을 최우선 사용
  const strategyPara = memo.paragraphs?.[4]
  if (strategyPara && strategyPara.trim()) {
    const s = firstSentenceFull(strategyPara)
    if (s) return s
  }
  if (memo.atAGlanceStrategy && memo.atAGlanceStrategy.trim()) {
    return firstSentence(memo.atAGlanceStrategy.replace(/^전략[:\s]*/u, '').trim(), 34)
  }
  const sc = memo.strategyComment.replace(/\s+/g, ' ').trim()
  if (!sc) return '핵심 지지 확인 후 대응'
  if (sc.includes('익절')) return '분할 익절 중심 대응'
  if (sc.includes('관망')) return '관망, 신호 확인 후 접근'
  if (sc.includes('보유')) return '보유 유지, 이탈 시 정리'
  if (sc.includes('신규')) return '눌림 확인 후 분할 진입'
  if (sc.includes('제외')) return '제외 관점 유지'
  return '손절·익절 규칙 준수'
}

/**
 * 한눈에 보기용: AI 투자 메모에서 짧고 명료한 두 줄.
 */
export function investmentMemoAtAGlance(memo: DetailedInvestmentMemoResult): {
  line1: string
  line2: string
} {
  return {
    line1: oneLine(summaryLineWithoutTicker(memo), 36),
    line2: conciseStrategyLine(memo),
  }
}
