import type { LogicMetric } from '../types/stock'

export type MetricStatus = '좋음' | '중립' | '주의' | '위험'

type Interpretation = {
  current: string
  status: MetricStatus
  impact: string
}

function parseScore(metric: Pick<LogicMetric, 'score' | 'value'>): number | null {
  if (typeof metric.score === 'number' && Number.isFinite(metric.score)) {
    return metric.score
  }
  const m = String(metric.value).match(/-?\d+(\.\d+)?/)
  if (!m) return null
  const n = Number(m[0])
  return Number.isFinite(n) ? n : null
}

function getStatus(score: number): MetricStatus {
  if (score >= 70) return '좋음'
  if (score >= 55) return '중립'
  if (score >= 40) return '주의'
  return '위험'
}

function byRange(score: number, texts: [string, string, string, string, string]) {
  if (score >= 85) return texts[0]
  if (score >= 70) return texts[1]
  if (score >= 55) return texts[2]
  if (score >= 40) return texts[3]
  return texts[4]
}

export function getMetricInterpretation(
  metricKey: LogicMetric['descriptionKey'],
  metric: Pick<LogicMetric, 'title' | 'value' | 'score' | 'descriptionKey'>,
): Interpretation {
  const score = parseScore(metric)
  if (score == null) {
    return {
      current: `현재 값(${metric.value})에서 점수를 추출할 수 없어 정성 해석만 제공합니다.`,
      status: '중립',
      impact: '점수 기반 비중/타이밍 판단에는 제한적으로 반영됩니다.',
    }
  }

  const status = getStatus(score)

  const metricSpecific = (() => {
    switch (metricKey) {
      case 'structure':
        return byRange(score, [
          '현재 구조 점수는 매우 강합니다. 주요 이동평균선 위에서 추세가 유지되고 있으며 상승 구조가 살아있는 상태입니다.',
          '상승 구조는 유지되지만 일부 과열 또는 단기 부담 가능성이 있습니다.',
          '추세는 유지되지만 확실한 상승 구조로 보기에는 애매한 상태입니다.',
          '구조가 약화되고 있으며 주요 지지선 확인이 필요합니다.',
          '상승 구조가 훼손된 상태로 신규 진입 위험이 큽니다.',
        ])
      case 'execution':
        return byRange(score, [
          '지금 신규 진입하기 좋은 자리입니다. 눌림과 손익비 조건이 양호합니다.',
          '진입 가능 구간이지만 일부 단기 부담이 존재합니다.',
          '종목은 괜찮지만 현재 자리의 매력은 보통 수준입니다.',
          '신규 진입 매력이 낮아 관망이 유리합니다.',
          '단기 과열 또는 손익비 부족으로 신규 진입 비추천 구간입니다.',
        ])
      case 'supply':
        return byRange(score, [
          '외국인과 기관 수급이 매우 강하게 유입되는 상태입니다.',
          '수급 흐름은 긍정적이며 상승 모멘텀을 지지하고 있습니다.',
          '수급은 중립 수준이며 강한 방향성은 부족합니다.',
          '기관 또는 외국인 수급이 약화되는 흐름입니다.',
          '수급이 좋지 않으며 단기 매도 압력이 우세합니다.',
        ])
      case 'sectorFlow':
        return byRange(score, [
          '섹터 자금흐름이 주도권에 가깝습니다.',
          '섹터 자금흐름이 관심 구간으로 양호합니다.',
          '섹터 자금흐름은 중립에 가깝습니다.',
          '섹터 자금흐름이 약화되는 구간입니다.',
          '섹터가 소외되기 쉬운 자금 흐름입니다.',
        ])
      case 'valuation':
        return byRange(score, [
          '실적 성장 대비 밸류에이션이 매우 매력적인 상태입니다.',
          'Forward 개선 폭이 유의미해 중기 기대가 양호합니다.',
          '밸류에이션은 평균 수준으로 중립 구간입니다.',
          'PER 부담이 커지며 기대수익 대비 매력은 낮아집니다.',
          '고평가 위험 구간으로 보수적 접근이 필요합니다.',
        ])
      case 'indicators':
        return byRange(score, [
          '기술적 모멘텀이 매우 강하지만 과열 가능성도 함께 존재합니다.',
          '기술적 흐름은 긍정적입니다.',
          '중립적인 기술적 흐름입니다.',
          '기술적 흐름이 약화되고 있습니다.',
          '기술적 지표상 약세 흐름입니다.',
        ])
      case 'candleQuality':
        return byRange(score, [
          '최근 캔들 흐름이 매우 건강하며 종가 관리가 잘 되고 있습니다.',
          '캔들 흐름은 긍정적입니다.',
          '보통 수준의 캔들 흐름입니다.',
          '윗꼬리 증가 등 단기 부담이 보입니다.',
          '매도 압력이 강하게 나타나는 캔들 흐름입니다.',
        ])
      case 'market':
        return byRange(score, [
          '시장 환경이 매우 우호적입니다.',
          '시장 흐름은 긍정적인 상태입니다.',
          '시장 방향성은 중립입니다.',
          '시장 리스크가 증가하는 구간입니다.',
          '시장 환경이 매우 불안정한 상태입니다.',
        ])
      default:
        return `현재 점수는 ${score.toFixed(1)}점으로, 보조 지표 기준의 상태를 반영합니다.`
    }
  })()

  return {
    current: metricSpecific,
    status,
    impact: `${metric.title} 값(${metric.value})은 실행 전략의 비중·타이밍 판단에 직접 반영됩니다.`,
  }
}
