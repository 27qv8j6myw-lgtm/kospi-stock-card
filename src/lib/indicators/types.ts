/** 일봉 (KIS 일봉 차트 확장 필드) */
export type OhlcvBar = {
  ts: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type MetricSeverity = 'neutral' | 'info' | 'caution' | 'warning' | 'danger'

/** 리스크 스트립 (기존 MetricRiskStrip 과 동일 매핑) */
export type RiskStrip = 'neutral' | 'info' | 'warning' | 'orange' | 'danger'

export type IndicatorCardOutput = {
  primary: string
  sub: string
  severity: MetricSeverity
  riskStrip: RiskStrip
  riskBadge?: string
  showRiskInfoIcon?: boolean
}

export type LogicBundleQuote = {
  price: number
  changePercent: number
  volume: number
  tradeValue?: number
  /** Trailing PER (TTM) 등 — 없으면 null */
  per?: number | null
}

export type LogicBundleIndexInvestor = {
  cumulative5d?: { foreignNetAmount?: number | null }
  cumulative20d?: { foreignNetAmount?: number | null }
}

export type LogicBundleIndexQuote = {
  changePercent?: number | null
}

export type IndexDerivedMetrics = {
  last: number | null
  sma20: number | null
  sma60: number | null
  ret20Pct: number | null
  vkospiProxy: number | null
  intradayAbsPct: number | null
  foreign5dWon: number | null
  foreign20dWon: number | null
}

export type MarketRegimeResult = {
  headlineKr: string
  subCompact: string
  detailLines: string[]
  score: number
  regimeKey: string
}

export type LogicBundleInput = {
  quote: LogicBundleQuote
  stockBars: OhlcvBar[]
  indexBars: OhlcvBar[]
  /** 지수 연환산 변동성 (VKOSPI 대체, %) */
  indexVkospiProxy?: number | null
  indexInvestor?: LogicBundleIndexInvestor | null
  indexQuote?: LogicBundleIndexQuote | null
}

export type LogicBundleOutput = {
  structureScore: number
  structureSub: string
  structureLine: string
  executionScore: number
  executionSub: string
  executionLine: string
  atrGapValue: number
  atrGapLine: string
  atrGapSub: string
  atrRiskStrip: RiskStrip
  atrRiskBadge?: string
  /** 일봉 기준 ATR(14) Wilder, 원(₩) 절대값. 없으면 null. */
  atr14Won: number | null
  /** 최근 20거래일(또는 봉 수 부족 시 전체) 저가 최저. STOP LOW20 후보용. */
  low20Min: number | null
  streakUpDays: number
  streakLine: string
  streakSub: string
  streakSeverity: MetricSeverity
  marketHeadline: string
  marketSubCompact: string
  marketDetail: string
  marketScore: number
  marketRegime: string
  structureStatePrimary: string
  structureStateLine: string
  structureStateSub: string
  candleQualityPrimary: string
  candleQualityLine: string
  candleQualitySub: string
  indicatorPrimary: string
  indicatorLine: string
  indicatorSub: string
  indicatorRiskStrip: RiskStrip
  indicatorRiskBadge?: string
  indicatorShowRiskInfoIcon?: boolean
  statsPrimary: string
  statsLine: string
  statsSub: string
  statsSeverity: MetricSeverity
  statsRiskStrip: RiskStrip
  statsRiskBadge?: string
  earningsPrimary: string
  earningsSub: string
  earningsSeverity: MetricSeverity
  earningsRiskStrip: RiskStrip
  valuationPrimary: string
  valuationSub: string
  rotationLine: string
  momentumLine: string
  liquidityLine: string
  adjustmentLine: string
  /** 기존 API 호환 */
  statsTrend20Pct: number
}
