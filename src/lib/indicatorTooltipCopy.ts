import type { LogicMetric } from '../types/stock'

export type IndicatorTooltipBlock = {
  title: string
  description: string
  thresholds: string
}

const DEFAULT_BLOCK: IndicatorTooltipBlock = {
  title: '지표',
  description: '종목 분석에 쓰이는 참고 지표입니다.',
  thresholds: '다른 지표와 함께 해석하세요.',
}

const COPY: Partial<Record<LogicMetric['descriptionKey'], IndicatorTooltipBlock>> = {
  structure: {
    title: '구조',
    description:
      '종목의 추세와 강도를 0~100점으로 평가합니다. MA 정배열, 추세 강도, 거래량 등 5가지를 종합합니다.',
    thresholds: '80점 이상이면 상승 추세 강함, 60점 미만이면 약세 또는 박스권입니다.',
  },
  execution: {
    title: '실행',
    description: '지금이 매수 타이밍인지를 0~100점으로 평가합니다. RSI, 변동성, 캔들 강도를 봅니다.',
    thresholds: '70점 이상이면 진입 양호, 40점 미만이면 진입 부적합입니다.',
  },
  atrDistance: {
    title: 'ATR 이격',
    description:
      '현재가가 20일 이동평균에서 얼마나 떨어져 있는지를 ATR(변동성) 단위로 나타냅니다.',
    thresholds: '3.5 이상이면 추격매수 금지, 5.0 이상이면 익절 검토, 7.0 이상이면 임계값 2배 초과입니다.',
  },
  consecutiveRise: {
    title: '연속상승',
    description: '종가 기준 연속 양봉 일수입니다. 단기 과열 여부를 판단합니다.',
    thresholds: '5일 이상이면 단기 조정 가능성이 높아집니다.',
  },
  market: {
    title: '시장',
    description: 'KOSPI 추세, 외국인 수급, 변동성을 종합한 시장 환경 단일 판정입니다.',
    thresholds: '강세장 / 박스권 / 약세장 / 변동성 확대 5단계로 분류합니다.',
  },
  sectorFlow: {
    title: '섹터 자금흐름',
    description: '종목이 속한 섹터가 시장 대비 얼마나 강한지, 섹터 내에서 종목의 순위는 어떤지 봅니다.',
    thresholds: '섹터 수익률이 시장 +3%p 초과면 강함, -3%p 미만이면 약함입니다.',
  },
  structureState: {
    title: '구조 상태',
    description: '구조 점수와 ATR 이격을 조합한 종합 판정입니다. 진입 가능 여부를 한 줄로 보여줍니다.',
    thresholds: '상승장 + 과열일 때는 익절 검토가 권장됩니다.',
  },
  supply: {
    title: '수급 (3D)',
    description:
      '직전 3거래일 외국인·기관 누적 순매수입니다. 외국인 매도 + 기관 매수가 동시에 클수록 매물 출회 위험이 있습니다.',
    thresholds: '개인·5거래일 누적은 카드를 눌러 상세 drawer에서 확인할 수 있습니다.',
  },
  consensus: {
    title: '컨센서스',
    description:
      '증권사 애널리스트 평균 목표가와 최고 목표가입니다. 투자의견·4주 목표가 변화·분산은 카드 상세 drawer에서 확인하세요.',
    thresholds: '컨센서스는 후행 지표이므로 변화 추세를 함께 보는 것이 좋습니다.',
  },
  candleQuality: {
    title: '캔들질 (CLV)',
    description: '종가가 일중 고가/저가 중 어디에 가까운지를 나타냅니다. 매수세와 매도세의 우위를 봅니다.',
    thresholds: 'CLV5가 +0.5 이상이면 매수세 우위, -0.5 미만이면 매도세 우위입니다.',
  },
  valuation: {
    title: '밸류에이션 (PER)',
    description: '현재 PER을 5년 평균 PER 및 섹터 평균과 비교합니다.',
    thresholds: '5Y 평균 대비 +50% 초과면 고밸류, +100% 초과면 역사적 고점 구간입니다.',
  },
  indicators: {
    title: '지표 (RSI / MFI)',
    description: 'RSI는 가격 모멘텀, MFI는 자금 모멘텀의 과매수/과매도를 봅니다.',
    thresholds: 'RSI 70 이상 과매수, 80 이상 추격금지, 90 이상 익절 강제 검토입니다.',
  },
  earnings: {
    title: '실적발표일',
    description: '다음 분기 실적 발표일까지 남은 일수와 직전 분기 어닝 서프라이즈입니다.',
    thresholds: 'D-3 이내는 변동성 주의, D-14 이내는 발표 임박 신호입니다.',
  },
  statistics: {
    title: '통계',
    description: '현재가가 최근 평균 대비 얼마나 괴리됐는지를 백분율로 봅니다.',
    thresholds: '20일 평균 대비 +25% 초과면 단기 과열, +40% 초과면 이격 극단입니다.',
  },
  roe: {
    title: 'ROE',
    description: '자기자본 대비 순이익 비율로 자본 효율을 봅니다. EPS÷BPS 기반 근사이며 공시 ROE와 다를 수 있습니다.',
    thresholds: '5% 미만 주의, 음수 경고. 섹터 벤치는 업종 추정치입니다.',
  },
  epsGrowth: {
    title: 'EPS 성장률',
    description: '주당순이익 성장(YoY)과 QoQ 근사, 컨센 목표가 상승여력을 한 줄로 봅니다.',
    thresholds: 'YoY·QoQ 동시 음수 경고, YoY만 음수면 주의. QoQ는 분기 미연동 시 근사입니다.',
  },
  fundamental: {
    title: '펀더멘털 요약',
    description: 'ROE·부채비율 등 핵심 재무 지표를 한 카드로 요약해 보여줍니다.',
    thresholds: '개별 항목은 아래 펀더멘털 섹션 카드에서 자세히 확인할 수 있습니다.',
  },
  fundamentalRoe: {
    title: 'ROE',
    description: '자기자본 대비 순이익 비율로 기업의 자본 효율성을 봅니다.',
    thresholds: '15% 이상이면 고수익성, 5% 미만이면 수익성 저하입니다.',
  },
  fundamentalEpsGrowth: {
    title: 'EPS 성장률',
    description: '주당순이익의 전년 동기 대비 변화율입니다. 이익 성장 추세를 봅니다.',
    thresholds: 'YoY +20% 이상이면 성장 가속, 음수면 감익입니다.',
  },
  fundamentalPer: {
    title: 'PER',
    description: '주가수익비율로 밸류에이션 수준을 봅니다.',
    thresholds: '섹터·역사 대비 괴리가 크면 변동성에 유의하세요.',
  },
  fundamentalPbr: {
    title: 'PBR',
    description: '주가순자산비율로 자산 대비 시가총액 수준을 봅니다.',
    thresholds: '업종 특성에 따라 해석이 달라질 수 있습니다.',
  },
  fundamentalDebt: {
    title: '부채비율',
    description: '차입금 중심의 레버리지 수준을 봅니다.',
    thresholds: '업종 평균과 비교해 과도한 부채 여부를 확인하세요.',
  },
  fundamentalOpMargin: {
    title: '영업이익률',
    description: '매출 대비 영업이익 비율로 본업 수익성을 봅니다.',
    thresholds: '추세가 하락하면 경쟁력·가격 압력을 점검하세요.',
  },
  special: {
    title: '특이사항',
    description: '종목별 이벤트·공시 요약이 있을 때 표시됩니다.',
    thresholds: '이벤트 전후로 변동성이 커질 수 있습니다.',
  },
}

export function getIndicatorTooltipCopy(key: LogicMetric['descriptionKey']): IndicatorTooltipBlock {
  return COPY[key] ?? DEFAULT_BLOCK
}
