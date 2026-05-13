/** 3개월 실행 전략 — 진입 판단 한글 라벨 (트리 결과) */
export type ExecutionEntryDecision =
  | '회피'
  | '전량 익절'
  | '분할 익절'
  | '관망 (과열)'
  | '신규 매수'
  | '적극 매수'
  | '분할 매수'
  | '보유 유지'

/** 종목 시세 + 지표 번들만 받는 입력 (UI·페이지에서 재계산 금지) */
export type ExecutionStrategyInputs = {
  price: number
  /** 없으면 `price`를 진입가로 간주 */
  entryPrice?: number
  structureScore: number
  executionScore: number
  rsi14: number
  /** ATR 이격 배수(절대값) — 로직 지표와 동일 */
  atrDistanceAbs: number
  atr14: number
  /** 가중 R/R (기존 `computeStrategyRiskRewardMetrics` 등에서 산출) */
  weightedRiskReward: number
  consensusAvgTargetPrice: number | null
  /** 컨센서스 최고 목표가 — 펀더멘털 입력용(없으면 평균 기준 추정) */
  consensusMaxTargetPrice?: number | null
  /** 섹터명 — 5Y PER 벤치 등 */
  sectorName?: string | null
  /** TTM 영업이익률(%) */
  operatingMarginTtmPct?: number | null
  /** 영업이익률 전년 대비 변화(%p) */
  operatingMarginYoYPp?: number | null
  /** Forward PER */
  forwardPer?: number | null
  /** 5년 평균 PER — 없으면 섹터 벤치 */
  fiveYearAvgPer?: number | null
  /** EPS YoY 성장률(%) */
  epsGrowthYoYPct?: number | null
  /** TTM PER (Forward 미수신 시 0.8배 추정에 사용) */
  trailingPer?: number | null
  /** 최근 20거래일 종가 최저 */
  recentLow20: number
  /** 60일 연환산 실현변동성(%). 없으면 ATR/가격으로 추정 */
  realizedVol60AnnPct?: number | null
  /** 5일 이평선 종가 — 추가매수 허용 판정 */
  ma5?: number | null
  /** 직전 의미 있는 스윙 고점 — 눌림 판정 */
  priorSwingHigh?: number | null
  /** 당일(또는 최근) 거래량 ÷ 직전 5일 평균 */
  volumeVs5dAvgRatio?: number | null
  /** 진입가 대비 수익률 % (추가매수 금지) */
  pnlSinceEntryPct?: number | null
  firstTakeProfitReached?: boolean
  stopBreachedReentry?: boolean
  /** 계좌 대비 현재 보유 비중 % */
  currentPositionPct?: number | null
  daysSinceEntry?: number | null
}

export type StopMethodTag = 'FIXED' | 'ATR' | 'LOW20' | 'TIGHT_VOL' | 'TIGHT_RSI'

export type StopCandidateRow = {
  method: StopMethodTag
  price: number
  lossPct: number
  valid: boolean
  note: string
}

export type StopLossResult = {
  stopPrice: number
  stopLossPct: number
  method: StopMethodTag
  reasonLine: string
  candidates: StopCandidateRow[]
}
