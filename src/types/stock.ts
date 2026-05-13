export type Timeframe = '1D' | '5D' | '1M' | '3M' | '1Y'

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

export type UnifiedEntryStageTier =
  | 'NEW_ENTRY'
  | 'SCALE_IN'
  | 'HOLD_STEADY'
  | 'SCALE_OUT'
  | 'EXIT_ALL_OR_AVOID'

export type Strategy = 'BUY' | 'BUY_AGGRESSIVE' | 'HOLD' | 'WATCH_ONLY' | 'TAKE_PROFIT' | 'REJECT'
export type EntryStage = 'ACCEPT' | 'CAUTION' | 'WATCH' | 'REJECT'
export type MarketStatus = 'RiskOn' | 'Neutral' | 'Caution'

/** 전략·진입 단계 UI (Final Grade 대신 단일 행동 프레임) */
export type ExecutionSummaryUi = {
  tier: UnifiedEntryStageTier
  strategyLabelKo: string
  entryStageLabel: string
  entryStageAction: string
}

export type SummaryInfo = {
  title: string
  description: string
  strategy: Strategy
  entryStageCode: EntryStage
  executionUi: ExecutionSummaryUi
  reason: string
}

export type ChartPoint = {
  label: string
  value: number | null
}

export type MetricRiskStrip = 'neutral' | 'info' | 'warning' | 'orange' | 'danger'

/** 카드 좌측 4px 액센트 (배경은 항상 흰색) */
export type MetricCardAccent = 'neutral' | 'info' | 'caution' | 'warning' | 'danger'

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
  /** 시장 카드 등 미니 추세선 (정규화 전 원시 값) */
  sparkline?: number[]
  /** 섹터 자금흐름 등 상태 칩 (주도섹터·관심섹터 등) */
  statusBadge?: string
  /** 카드 좌측 4px 색 — 미지정 시 riskStrip에서 유추 */
  cardAccent?: MetricCardAccent
  /** 카드 클릭 시 drawer에 표시할 상세(멀티라인) */
  detailForDrawer?: string
  /** Primary 숫자/문구 색 (실적 D-day 등) */
  valueEmphasis?: 'danger' | 'warning' | 'muted' | 'default'
  /** Sub 한 줄 강조 (실적 미스 등) */
  subValueEmphasis?: 'danger' | 'default' | 'muted'
  /** 수급 카드: 외·기 순매수(원) — 있으면 그리드에서 2행 분리 표시 */
  supplyForeignWon?: number
  supplyInstitutionWon?: number
  /** 컨센서스 카드: 평균·최고 목표가(원) 및 현재가(원) */
  consensusAvgWon?: number
  consensusMaxWon?: number
  consensusSpotWon?: number
  /** 툴팁에 노출할 투자의견 평균(5점 만점) */
  consensusRecommendationScore?: number | null
  /** 그리드 우측 상단 커스텀 뱃지(예: 평균 도달) */
  cornerBadge?: string
  /** ⓘ 툴팁 — 있으면 descriptionKey 기본 COPY 대신 사용 */
  indicatorTooltipOverride?: {
    title: string
    description: string
    thresholds: string
  }
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
    | 'structureState'
    | 'earnings'
    | 'roe'
    | 'epsGrowth'
    | 'fundamental'
    | 'fundamentalPer'
    | 'fundamentalPbr'
    | 'fundamentalRoe'
    | 'fundamentalOpMargin'
    | 'fundamentalEpsGrowth'
    | 'fundamentalDebt'
  icon: string
  tone: 'blue' | 'violet' | 'amber' | 'sky' | 'emerald' | 'indigo' | 'orange' | 'cyan' | 'teal' | 'rose' | 'slate' | 'red'
  /** 좌측 4px 리스크 스트립 (ATR·지표·통계·밸류 등) */
  riskStrip?: MetricRiskStrip
  /** 임계 초과 시 제목 옆 경고 문구 */
  riskBadge?: string
  /** 주의(파란) 구간에서 정보 아이콘 표시 */
  showRiskInfoIcon?: boolean
}

export type ExecutionCard = {
  title: string
  value: string
  hint?: string
}

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
  /** 실행 전략과 동일 손절가(없으면 내부에서 현재가 대비 근사) */
  stopPrice?: number
}

export type TargetPriceRow = {
  label: '1D' | '7D' | '1M' | '3M'
  targetPrice: number
  expectedReturnPct: number
  probability: number
  /** 동일 변동성(ATR) 근사 하 말기 손절가 이하 도달 휴리스틱 확률(%) */
  stopHitProbability: number
  /** 직전 3년 백테스트 근사 표본 수 (UI 표기용) */
  backtestSampleSize: number
  method: string
  note?: string
}

export type CalculateTargetPricesResult = {
  targets: TargetPriceRow[]
  /** 카드 공통 손절가(원) */
  stopPrice: number
  stopLossPct: number
  warnings: string[]
  notes: string[]
}

export type StopBasisTag = 'FIXED' | 'ATR' | 'LOW20' | 'TIGHT'

export type StopInfo = {
  stopPrice: number
  stopLossPct: number
  method: 'FIXED' | 'ATR' | 'SUPPORT' | 'MA20' | 'RECENT_LOW' | 'FALLBACK' | 'TIGHT'
  /** 선택된 STOP 근거 (UI "기준" 표기) */
  basis: StopBasisTag
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
  /** @deprecated 가격(1M 목표) 기반 R/R — UI는 `StrategyRiskRewardMetrics` 사용 */
  verdict: '좋음' | '가능' | '애매' | '비추천'
}

export type StrategyRiskRewardVerdict = '비효율' | '보통' | '양호' | '우수'

/** 손익% 기준 순수·가중·확률가중 R/R (실행 전략 헤더 표시용) */
export type StrategyRiskRewardMetrics = {
  pureRatio: number
  weightedRatio: number
  expectedProbWeightedRatio: number
  pureVerdict: StrategyRiskRewardVerdict
  weightedVerdict: StrategyRiskRewardVerdict
  expectedProbWeightedVerdict: StrategyRiskRewardVerdict
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
  /** 구조 점수(0~100) — 진입 트리 전용 */
  structureScore: number
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
  /** 없으면 `supportPrice`·현재가로 보수 추정 */
  recentLow20?: number
  /** 진입가 — 없으면 현재가 */
  entryPrice?: number
  realizedVol60AnnPct?: number | null
  ma5?: number | null
  priorSwingHigh?: number | null
  volumeVs5dAvgRatio?: number | null
  pnlSinceEntryPct?: number | null
  firstTakeProfitReached?: boolean
  stopBreachedReentry?: boolean
  currentPositionPct?: number | null
  daysSinceEntry?: number | null
  /** 펀더멘털 가속 트랙 — 미입력 시 보수적 약세로 처리 */
  sectorName?: string | null
  operatingMarginTtmPct?: number | null
  operatingMarginYoYPp?: number | null
  forwardPer?: number | null
  fiveYearAvgPer?: number | null
  epsGrowthYoYPct?: number | null
  trailingPer?: number | null
}

/** 3개월 +15% 전략 산출물 */
export type ThreeMonthStrategy = {
  entryDecision: string
  /** 진입 트리 판단 근거 한 줄 */
  entryRationale?: string
  /** 펀더멘털 3박자 요약 시그널 */
  fundamentalSignal?: 'strong' | 'moderate' | 'weak'
  /** 한눈에 보기 Reason 한 줄 (RSI·ATR·펀더 요약) */
  entryReasonShort?: string
  recommendedPositionPct: number
  stopPrice: number
  stopLossPct: number
  stopReason: string
  /** Stop 패널 후보 표 — `strategy/` 손절 산출과 동기 */
  stopPanelMethod?: StopInfo['method']
  stopPanelCandidates?: StopInfo['candidates']
  firstTakeProfitPrice: number
  firstTakeProfitPct: number
  firstTakeProfitSellPct: number
  /** 1차 익절 + 강제 트리거 한 줄 */
  firstTakeProfitDetail?: string
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
