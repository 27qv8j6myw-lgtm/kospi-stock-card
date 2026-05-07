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
    foreignNetShares: number
    foreignNetAmount: number
    institutionNetShares: number
    institutionNetAmount: number
    retailNetShares: number
    retailNetAmount: number
    supplyPeriod: string
  }
  score?: number
  descriptionKey:
    | 'structure'
    | 'execution'
    | 'supply'
    | 'rotation'
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

export type TargetPrice = {
  horizon: string
  sub?: string
  targetPrice: number
  expectedReturnPct: number
  probability: number
  sampleSize: number
}

export type StopInfo = {
  stopPrice: number
  stopLossPct: number
  method: string
  supportPrice: number
}

export type TargetStopInput = {
  currentPrice: number
  atr14: number
  rsi14: number
  finalScore: number
  structureScore: number
  executionScore: number
  supportPrice: number
  resistancePrice: number
  recentHigh20: number
  recentLow20: number
  marketStatus: 'RiskOn' | 'Neutral' | 'Caution'
}

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
  momentumScore: number
  riskScore: number
  rsi14: number
  atr14: number
  stopPrice: number
  stopLossPct: number
  riskRewardRatio: number
  marketStatus: 'RiskOn' | 'Neutral' | 'Caution'
  strategy: 'BUY' | 'HOLD' | 'WATCH_ONLY' | 'TAKE_PROFIT' | 'REJECT'
  entryStage: 'ACCEPT' | 'CAUTION' | 'REJECT' | 'WATCH'
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
}

export type ScoreInputs = {
  structure: number
  execution: number
  supply: number
  rotation: number
  consensus: number
  valuation: number
  momentum: number
  market: number
  news: number
}
