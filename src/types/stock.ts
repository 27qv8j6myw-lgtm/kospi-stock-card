export type Timeframe = '3D' | '1W' | '1M' | '3M' | '1Y'

export type StockInfo = {
  name: string
  code: string
  market: string
  sector: string
  price: number
  change: number
  changePercent: number
  investmentBadge: string
  asOfDate: string
}

export type SummaryInfo = {
  title: string
  description: string
  finalGrade: string
  strategy: string
  entryStage: string
  reason: string
}

export type ChartPoint = {
  label: string
  value: number | null
}

export type LogicMetric = {
  title: string
  value: string
  subValue?: string
  meta?: string
  tooltipSummary?: string
  supplyDetails?: {
    foreignNetShares3D: number
    foreignNetAmount3D: number
    institutionNetShares3D: number
    institutionNetAmount3D: number
    retailNetShares3D: number
    retailNetAmount3D: number
    foreignNetAmount5D?: number | null
    institutionNetAmount5D?: number | null
    retailNetAmount5D?: number | null
    supplyPeriod: string
  }
  score?: number
  /** 섹터 자금흐름 등 상태 칩 (주도섹터·관심섹터 등) */
  statusBadge?: string
  descriptionKey:
    | 'structure'
    | 'execution'
    | 'supply'
    | 'sectorFlow'
    | 'valuation'
    | 'indicators'
    | 'atrDistance'
    | 'candleQuality'
    | 'market'
    | 'consecutiveRise'
    | 'consensus'
    | 'special'
    | 'statistics'
  icon: string
  tone: 'blue' | 'violet' | 'amber' | 'sky' | 'emerald' | 'indigo' | 'orange' | 'cyan' | 'teal' | 'rose' | 'slate' | 'red'
}

export type ExecutionCard = {
  title: string
  value: string
  hint?: string
}

export type Strategy = 'BUY' | 'HOLD' | 'WATCH_ONLY' | 'TAKE_PROFIT' | 'REJECT'
export type EntryStage = 'ACCEPT' | 'CAUTION' | 'WATCH' | 'REJECT'
export type MarketStatus = 'RiskOn' | 'Neutral' | 'Caution'

/** @deprecated 목표가 패널은 TargetPriceRow / CalculateTargetPricesResult 사용 */
export type TargetPrice = {
  horizon: string
  sub?: string
  targetPrice: number
  expectedReturnPct: number
  probability: number
  sampleSize: number
}

/** 목표가 계산 입력 (선택 종목 실제 지표) */
export type TargetPriceInput = {
  currentPrice: number
  atr14: number
  atrPct?: number
  rsi14: number
  finalScore: number
  structureScore: number
  executionScore: number
  supplyScore: number
  sectorFlowScore: number
  valuationScore: number
  consensusScore: number
  momentumScore: number
  marketScore: number
  resistancePrice?: number
  supportPrice?: number
  recentHigh20?: number
  recentHigh60?: number
  consensusAvgTargetPrice?: number
  consensusMaxTargetPrice?: number
  marketStatus: MarketStatus
}

export type TargetPriceRow = {
  label: '1D' | '7D' | '1M' | '3M'
  targetPrice: number
  expectedReturnPct: number
  probability: number
  method: string
  note?: string
}

export type CalculateTargetPricesResult = {
  targets: TargetPriceRow[]
  warnings: string[]
  notes: string[]
}

export type StopInfo = {
  stopPrice: number
  stopLossPct: number
  method: 'FIXED' | 'ATR' | 'SUPPORT' | 'MA20' | 'RECENT_LOW' | 'FALLBACK'
  reason: string
  candidates: {
    method: string
    price: number
    lossPct: number
    valid: boolean
    reason: string
  }[]
  warning?: string
}

export type StopInput = {
  currentPrice: number
  atr14?: number
  atrPct?: number
  supportPrice?: number
  ma20?: number
  recentLow20?: number
  finalScore: number
  executionScore: number
  marketScore: number
  rsi14: number
  atrDistance: number
  riskRewardRatio?: number
  marketStatus: MarketStatus
}

/** @deprecated 기존 이름. 신규 코드는 StopInput 사용 */
export type TargetStopInput = StopInput

export type RiskReward = {
  risk: number
  reward: number
  ratio: number
  verdict: '좋음' | '가능' | '애매' | '비추천'
}

export type ExecutionInput = {
  currentPrice: number
  finalScore: number
  structureScore: number
  executionScore: number
  supplyScore: number
  sectorFlowScore: number
  valuationScore: number
  consensusScore: number
  momentumScore: number
  marketScore: number
  riskScore: number
  rsi14: number
  atr14: number
  atrDistance: number
  consecutiveRiseDays: number
  stopPrice: number
  stopLossPct: number
  riskRewardRatio: number
  strategy: Strategy
  entryStage: EntryStage
  marketStatus: MarketStatus
  accountSize?: number
}

export type ExecutionPlan = {
  recommendedPositionPct: number
  maxPositionPct: number
  riskAmountPct: number
  riskAmountWon?: number
  action: string
  timeStop: string
  stopRule: string
  takeProfitRule: string
  addBuyRule: string
  reduceRule: string
  summary: string
  warnings: string[]
}

/** 3개월 +15% 실행 전략 계산 입력 */
export type ThreeMonthStrategyInput = {
  currentPrice: number
  finalScore: number
  executionScore: number
  supplyScore: number
  rsi14: number
  atrDistance: number
  atr14: number
  strategy: Strategy
  marketStatus: MarketStatus
  marketScore: number
  riskRewardRatio: number
  supportPrice: number
  consensusAvgTargetPrice: number | null
  consensusMaxTargetPrice: number | null
}

/** 3개월 +15% 전략 산출물 */
export type ThreeMonthStrategy = {
  entryDecision: string
  recommendedPositionPct: number
  stopPrice: number
  stopLossPct: number
  stopReason: string
  firstTakeProfitPrice: number
  firstTakeProfitPct: number
  firstTakeProfitSellPct: number
  finalTargetPrice: number
  finalTargetPct: number
  maxHoldingPeriod: string
  timeStopRule: string
  addBuyRule: string
  summary: string
  /** 컨센서스 참고 문구(최종 목표 카드 하단). 목표가 산정에는 사용하지 않음 */
  consensusNote: string
  warnings: string[]
}

export type ScoreInputs = {
  structure: number
  execution: number
  supply: number
  /** 섹터 자금흐름 점수 */
  sectorFlow: number
  /**
   * @deprecated 구 누적 가중치 입력명. `sectorFlow`가 없거나 NaN일 때만 폴백(하위 호환).
   * 새 코드는 `sectorFlow`만 넘기세요.
   */
  rotation?: number
  consensus: number
  valuation: number
  momentum: number
  market: number
  news: number
}

export type SectorFlowStatusLabel = '주도섹터' | '관심섹터' | '중립' | '약화' | '소외'

/** 섹터 5D·시장 대비·상대강도·점수 (표시·최종점수 입력) */
export type SectorFlowSnapshot = {
  sectorName: string
  sectorReturn5D: number
  marketReturn5D: number
  sectorRelativeReturn5D: number
  /** 섹터 내 상대강도 — 값이 작을수록 상위(예: 18 = 상위 18%) */
  sectorRankPercentile: number
  sectorFlowScore: number
  sectorFlowStatus: SectorFlowStatusLabel
}
