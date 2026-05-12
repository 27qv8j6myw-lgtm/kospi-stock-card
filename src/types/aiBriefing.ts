export type NewsSentiment = 'positive' | 'neutral' | 'negative'

export type NewsCategory =
  | 'earnings'
  | 'target'
  | 'target_price'
  | 'order'
  | 'capacity'
  | 'macro'
  | 'supply'
  | 'sector'
  | 'valuation'
  | 'risk'
  | 'other'

export type NewsItem = {
  title: string
  summary?: string
  sentiment: NewsSentiment
  category: NewsCategory
  publishedAt: string
  source: string
  link?: string
}

export type AIBriefingTone = 'bullish' | 'neutral' | 'caution'

/** @deprecated 로컬·Claude 브리핑은 DetailedInvestmentMemoResult로 전환 중 */
export type AIBriefingResult = {
  headline: string
  summary: string
  /** 최근 뉴스에서 뽑은 짧은 요약 불릿(제목 그대로 나열 지양) */
  newsHighlights: string[]
  bullishPoints: string[]
  bearishPoints: string[]
  marketExpectation: string
  strategyComment: string
  tone: AIBriefingTone
}

/** 규칙 기반·Claude 공통 투자 메모 입력 (숫자 중심 브리핑 생성용) */
export type DetailedBriefingInput = {
  stockName: string
  stockCode: string
  currentPrice: number
  previousClose?: number
  changePct: number
  intradayHigh?: number
  intradayLow?: number
  high52w?: number
  isNear52wHigh?: boolean
  consensusAvgTargetPrice?: number
  consensusMaxTargetPrice?: number
  consensusUpsideAvgPct?: number
  consensusUpsideMaxPct?: number
  foreignNetAmount3D?: number
  institutionNetAmount3D?: number
  retailNetAmount3D?: number
  rsi14: number
  atrDistance: number
  trailingPER?: number
  forwardPER?: number
  forwardEPSGrowthPct?: number
  finalScore: number
  executionScore: number
  supplyScore: number
  valuationScore: number
  strategy: string
  entryDecision: string
  news: NewsItem[]
}

/** 문단형 투자 메모 (로컬 규칙 생성 또는 Claude JSON) */
export type DetailedInvestmentMemoResult = {
  title: string
  /** 한눈에 보기 첫 줄: 종목명 없이 매우 짧은 상황 요약 */
  atAGlanceTitle?: string
  /** 한눈에 보기 둘째 줄: 매우 짧은 전략 문구 */
  atAGlanceStrategy?: string
  paragraphs: string[]
  keyPoints: string[]
  risks: string[]
  keyNews?: Array<{
    title: string
    whyItMatters: string
    sentiment: 'positive' | 'neutral' | 'negative'
    source?: string
    publishedAt?: string
  }>
  brokerView?: {
    summary: string
    targetPriceComment?: string
    ratingComment?: string
  }
  bullishPoints?: string[]
  riskPoints?: string[]
  strategyPlan?: {
    title: string
    marketView: string
    timingView: string
    positioningView: string
    riskView: string
    strategyMemo: string
    evidence: string[]
    confidence: number
  }
  strategyComment: string
  confidence?: number
  tone: AIBriefingTone
}
