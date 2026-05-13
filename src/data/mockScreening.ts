import type { NewsItem } from '../types/aiBriefing'

export type SectorIconKey =
  | 'cpu'
  | 'circuit'
  | 'shield'
  | 'ship'
  | 'zap'
  | 'car'
  | 'building'
  | 'battery'

export type SectorTone = 'blue' | 'cyan' | 'rose' | 'teal' | 'yellow' | 'orange' | 'pink' | 'green'

export type SectorRow = {
  id: string
  label: string
  icon: SectorIconKey
  tone: SectorTone
  avgScore: number
  sectorReturn5D: number
  kospiReturn5D: number
  isLeading: boolean
  topStocks: Array<{ code: string; name: string; score: number }>
}

export type SectorRowDraft = Omit<SectorRow, 'isLeading'>

export type TopFiveSubScores = {
  structure: number
  execution: number
  momentum: number
  supplyDemand: number
}

export type TopFiveRow = {
  rank: number
  code: string
  name: string
  sectorLabel: string
  sectorId?: string
  sectorIsLeading: boolean
  score: number
  expected1MPct: number
  subScores?: TopFiveSubScores
  per?: number
  consensusUpside?: number
  fiveYearAvgPer?: number
}

export type ScreeningAiAnalysis = {
  code: string
  summary: string
  keyDriver: string
  risk: string
}

export type CatalystTimeline = 'imminent' | 'short' | 'mid'

export type StockAnalysis = {
  code: string
  name: string
  currentPrice: number
  changePct: number
  expected1MPct: number
  catalysts: Array<{
    timeline: CatalystTimeline
    title: string
    confirmation: string
  }>
  perScenarios: {
    bear: { per: number; price: number; pct: number; probability: number }
    base: { per: number; price: number; pct: number; probability: number }
    bull: { per: number; price: number; pct: number; probability: number }
  }
  risks: Array<{ name: string; probability: 'low' | 'medium' | 'high' }>
  action: {
    entryZones: number[]
    exitZones: number[]
    stopLoss: number
    /** 표시용 손절 기준 % (예: 현재가 대비 -5%) */
    /** 미입력 시 UI에서 생략 가능 */
    stopLossPct?: number
  }
  newsItems: NewsItem[]
}

export type ScreeningBundle = {
  headlineSub: string
  sectors: SectorRow[]
  topFive: TopFiveRow[]
  analysesByCode: Record<string, StockAnalysis>
  /** API 응답 시각 (v2 스크리닝 등) */
  generatedAt?: string
  aiAnalyses?: ScreeningAiAnalysis[]
}

function applyLeadingFlags(sectors: SectorRowDraft[]): SectorRow[] {
  type Scored = SectorRowDraft & { leadSpread: number; eligible: boolean }
  const scored: Scored[] = sectors.map((s) => ({
    ...s,
    leadSpread: s.sectorReturn5D - s.kospiReturn5D,
    eligible: s.sectorReturn5D >= s.kospiReturn5D + 3 && s.avgScore >= 75,
  }))
  const topIds = scored
    .filter((s) => s.eligible)
    .sort((a, b) => b.leadSpread - a.leadSpread || b.avgScore - a.avgScore)
    .slice(0, 2)
    .map((s) => s.id)
  const set = new Set(topIds)
  return scored.map(({ leadSpread, eligible, ...rest }) => ({
    ...rest,
    isLeading: set.has(rest.id),
  }))
}

const kospi5d = 1.4

const baseSectors: Array<Omit<SectorRowDraft, 'kospiReturn5D'> & { kospiReturn5D?: number }> = [
  {
    id: 'ai_semi',
    label: 'AI/반도체',
    icon: 'cpu',
    tone: 'blue',
    avgScore: 78,
    sectorReturn5D: 4.1,
    topStocks: [
      { code: '000660', name: 'SK하이닉스', score: 87 },
      { code: '005930', name: '삼성전자', score: 81 },
      { code: '042700', name: '한미반도체', score: 79 },
    ],
  },
  {
    id: 'it_parts',
    label: 'IT부품',
    icon: 'circuit',
    tone: 'cyan',
    avgScore: 71,
    sectorReturn5D: 2.2,
    topStocks: [
      { code: '161390', name: '한국콜마', score: 74 },
      { code: '009150', name: '삼성전기', score: 72 },
      { code: '011070', name: 'LG이노텍', score: 70 },
    ],
  },
  {
    id: 'defense',
    label: '방산',
    icon: 'shield',
    tone: 'rose',
    avgScore: 84,
    sectorReturn5D: 5.8,
    topStocks: [
      { code: '012450', name: '한화에어로스페이스', score: 89 },
      { code: '047810', name: '한국항공우주', score: 83 },
      { code: '064350', name: '현대로템', score: 80 },
    ],
  },
  {
    id: 'shipbuilding',
    label: '조선',
    icon: 'ship',
    tone: 'teal',
    avgScore: 80,
    sectorReturn5D: 3.6,
    topStocks: [
      { code: '009540', name: '한화엔진', score: 86 },
      { code: '010620', name: 'HD현대미포', score: 82 },
      { code: '042660', name: '한화오션', score: 79 },
    ],
  },
  {
    id: 'power_equip',
    label: '전력기기',
    icon: 'zap',
    tone: 'yellow',
    avgScore: 82,
    sectorReturn5D: 6.2,
    topStocks: [
      { code: '267260', name: 'HD현대일렉트릭', score: 91 },
      { code: '298040', name: '효성중공업', score: 87 },
      { code: '010120', name: 'LS일렉트릭', score: 82 },
    ],
  },
  {
    id: 'auto',
    label: '자동차',
    icon: 'car',
    tone: 'orange',
    avgScore: 73,
    sectorReturn5D: 2.0,
    topStocks: [
      { code: '005380', name: '현대차', score: 76 },
      { code: '000270', name: '기아', score: 74 },
      { code: '012330', name: '현대모비스', score: 70 },
    ],
  },
  {
    id: 'construction',
    label: '건설',
    icon: 'building',
    tone: 'pink',
    avgScore: 68,
    sectorReturn5D: 0.9,
    topStocks: [
      { code: '028050', name: '삼성물산', score: 72 },
      { code: '000720', name: '현대건설', score: 69 },
      { code: '375500', name: 'DL이앤씨', score: 65 },
    ],
  },
  {
    id: 'battery',
    label: '2차전지',
    icon: 'battery',
    tone: 'green',
    avgScore: 76,
    sectorReturn5D: 3.1,
    topStocks: [
      { code: '373220', name: 'LG에너지솔루션', score: 80 },
      { code: '006400', name: '삼성SDI', score: 77 },
      { code: '247540', name: '에코프로비엠', score: 72 },
    ],
  },
]

const sectors: SectorRow[] = applyLeadingFlags(
  baseSectors.map((s) => ({
    ...s,
    kospiReturn5D: s.kospiReturn5D ?? kospi5d,
  })),
)

const news267260: NewsItem[] = [
  {
    title: '美 그리드 투자 가속, 변압기 수요 전망 상향',
    summary: '데이터센터·재생에너버 연계 송전 설비 투자 확대 흐름이 국내 전력기기로 확산될 것이란 분석.',
    sentiment: 'positive',
    category: 'sector',
    publishedAt: '2026-05-10',
    source: '한국경제',
  },
  {
    title: '목표가 650K 상향, 밸류에이션 리레이팅',
    summary: '해외 수주 가시성과 마진 개선을 반영한 목표가 상향.',
    sentiment: 'positive',
    category: 'target_price',
    publishedAt: '2026-05-09',
    source: '한투증권',
  },
]

const news012450: NewsItem[] = [
  {
    title: '방산 수출 논의 임박, 중동 추가 계약 기대',
    summary: '정부·방산사 협의 일정이 몰리며 단기 이벤트로 작용할 수 있다는 전망.',
    sentiment: 'positive',
    category: 'order',
    publishedAt: '2026-05-08',
    source: '매일경제',
  },
]

const analysesByCode: Record<string, StockAnalysis> = {
  '267260': {
    code: '267260',
    name: 'HD현대일렉트릭',
    currentPrice: 528_000,
    changePct: 6.2,
    expected1MPct: 18,
    catalysts: [
      {
        timeline: 'short',
        title: '미국 데이터센터 변압기 발주 임박',
        confirmation: '다음 분기 가이던스',
      },
      {
        timeline: 'mid',
        title: '인도·중동 그리드 투자 확대',
        confirmation: '현지 파트너 실적 브리핑',
      },
    ],
    perScenarios: {
      bear: { per: 22, price: 420_000, pct: -20, probability: 25 },
      base: { per: 28, price: 540_000, pct: 2, probability: 50 },
      bull: { per: 35, price: 670_000, pct: 27, probability: 25 },
    },
    risks: [{ name: '미국 관세 정책 변동', probability: 'medium' }],
    action: {
      entryZones: [500_000, 510_000],
      exitZones: [600_000, 670_000],
      stopLoss: 480_000,
      stopLossPct: -5,
    },
    newsItems: news267260,
  },
  '012450': {
    code: '012450',
    name: '한화에어로스페이스',
    currentPrice: 412_000,
    changePct: 4.1,
    expected1MPct: 16,
    catalysts: [
      {
        timeline: 'imminent',
        title: '중동 방산 미팅 결과 발표',
        confirmation: '공식 보도자료',
      },
      {
        timeline: 'short',
        title: '유럽 방산 협력 MOU',
        confirmation: '4주 내 체결 여부',
      },
    ],
    perScenarios: {
      bear: { per: 18, price: 350_000, pct: -15, probability: 30 },
      base: { per: 24, price: 430_000, pct: 4, probability: 45 },
      bull: { per: 30, price: 510_000, pct: 24, probability: 25 },
    },
    risks: [
      { name: '수출 규제·인허가 지연', probability: 'medium' },
      { name: '환율 급변', probability: 'low' },
    ],
    action: {
      entryZones: [395_000, 405_000],
      exitZones: [470_000, 510_000],
      stopLoss: 375_000,
      stopLossPct: -6,
    },
    newsItems: news012450,
  },
  '000660': {
    code: '000660',
    name: 'SK하이닉스',
    currentPrice: 186_500,
    changePct: 2.4,
    expected1MPct: 15,
    catalysts: [
      {
        timeline: 'short',
        title: 'HBM 캐파 확대 가이던스',
        confirmation: '실적 콜',
      },
    ],
    perScenarios: {
      bear: { per: 12, price: 160_000, pct: -14, probability: 25 },
      base: { per: 15, price: 190_000, pct: 2, probability: 55 },
      bull: { per: 19, price: 220_000, pct: 18, probability: 20 },
    },
    risks: [{ name: '메모리 가격 사이클 급락', probability: 'medium' }],
    action: {
      entryZones: [180_000, 184_000],
      exitZones: [205_000, 220_000],
      stopLoss: 172_000,
      stopLossPct: -5,
    },
    newsItems: [],
  },
  '298040': {
    code: '298040',
    name: '효성중공업',
    currentPrice: 398_000,
    changePct: 3.2,
    expected1MPct: 14,
    catalysts: [
      {
        timeline: 'mid',
        title: '초고압 케이블 수주 런업',
        confirmation: '분기별 백로그 공시',
      },
    ],
    perScenarios: {
      bear: { per: 14, price: 340_000, pct: -15, probability: 25 },
      base: { per: 18, price: 400_000, pct: 0, probability: 50 },
      bull: { per: 22, price: 470_000, pct: 18, probability: 25 },
    },
    risks: [{ name: '원자재(구리) 가격', probability: 'high' }],
    action: {
      entryZones: [385_000, 392_000],
      exitZones: [450_000, 470_000],
      stopLoss: 365_000,
      stopLossPct: -5,
    },
    newsItems: [],
  },
  '009540': {
    code: '009540',
    name: '한화엔진',
    currentPrice: 28_900,
    changePct: 1.8,
    expected1MPct: 14,
    catalysts: [
      {
        timeline: 'short',
        title: '조선·방산 엔진 물량 회복',
        confirmation: '월간 수주 지표',
      },
    ],
    perScenarios: {
      bear: { per: 16, price: 25_000, pct: -13, probability: 30 },
      base: { per: 19, price: 29_500, pct: 2, probability: 45 },
      bull: { per: 22, price: 33_000, pct: 14, probability: 25 },
    },
    risks: [{ name: '조선 발주 연기', probability: 'medium' }],
    action: {
      entryZones: [28_000, 28_400],
      exitZones: [31_000, 33_000],
      stopLoss: 26_800,
      stopLossPct: -5,
    },
    newsItems: [],
  },
}

function sectorLeadingFromGrid(code: string): { label: string; leading: boolean; id: string } {
  for (const s of sectors) {
    const hit = s.topStocks.some((t) => t.code === code)
    if (hit) return { label: s.label, leading: s.isLeading, id: s.id }
  }
  return { label: '—', leading: false, id: '' }
}

const topFiveRaw: Array<Omit<TopFiveRow, 'rank' | 'sectorLabel' | 'sectorIsLeading' | 'sectorId'>> = [
  {
    code: '267260',
    name: 'HD현대일렉트릭',
    score: 91,
    expected1MPct: 18,
    subScores: { structure: 82, execution: 80, momentum: 76, supplyDemand: 68 },
    per: 24.2,
    consensusUpside: 8,
  },
  {
    code: '012450',
    name: '한화에어로스페이스',
    score: 89,
    expected1MPct: 16,
    subScores: { structure: 80, execution: 78, momentum: 74, supplyDemand: 66 },
    per: 28.1,
    consensusUpside: 5,
  },
  {
    code: '000660',
    name: 'SK하이닉스',
    score: 87,
    expected1MPct: 15,
    subScores: { structure: 78, execution: 80, momentum: 82, supplyDemand: 70 },
    per: 18.5,
    consensusUpside: 3,
  },
  {
    code: '298040',
    name: '효성중공업',
    score: 87,
    expected1MPct: 14,
    subScores: { structure: 76, execution: 76, momentum: 72, supplyDemand: 58 },
    per: 15.2,
    consensusUpside: -2,
  },
  {
    code: '082740',
    name: '한화엔진',
    score: 86,
    expected1MPct: 14,
    subScores: { structure: 74, execution: 78, momentum: 70, supplyDemand: 62 },
    per: 22.0,
    consensusUpside: 1,
  },
]

const topFive: TopFiveRow[] = topFiveRaw.map((row, i) => {
  const { label, leading, id } = sectorLeadingFromGrid(row.code)
  return { ...row, rank: i + 1, sectorLabel: label, sectorIsLeading: leading, sectorId: id }
})

const mockAiAnalyses: ScreeningAiAnalysis[] = [
  {
    code: '267260',
    summary: '전력·조선 연관 수주 모멘텀과 점수 균형이 양호합니다.',
    keyDriver: '구조·실행 점수가 함께 높아 단기 추세 지속 가능성.',
    risk: '밸류에이션 급등 후 단기 과열 시 변동성 확대.',
  },
  {
    code: '012450',
    summary: '방산 수주와 정책 테마가 겹치는 강세 구간입니다.',
    keyDriver: '수급·모멘텀 점수가 동반 상승.',
    risk: '지정학 리스크 이벤트 시 급반전 가능.',
  },
  {
    code: '000660',
    summary: '메모리 업황 기대와 밸런스가 맞물린 대형주.',
    keyDriver: '실행·모멘텀 점수가 상대적으로 견조.',
    risk: '업황 지표 둔화 시 실적 기대 하향.',
  },
]

export const MOCK_SCREENING_BUNDLE: ScreeningBundle = {
  headlineSub: '1개월 +15% 상승 유력 종목',
  sectors,
  topFive,
  analysesByCode,
  aiAnalyses: mockAiAnalyses,
}
