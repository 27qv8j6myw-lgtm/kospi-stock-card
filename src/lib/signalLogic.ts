import type {
  CalculateTargetPricesResult,
  EntryStage,
  ExecutionInput,
  ExecutionPlan,
  RiskReward,
  ScoreInputs,
  SectorFlowSnapshot,
  SectorFlowStatusLabel,
  Strategy,
  TargetPriceInput,
  TargetPriceRow,
  TargetStopInput,
  ThreeMonthStrategy,
  ThreeMonthStrategyInput,
} from '../types/stock'

export function calculateFinalScore(inputs: ScoreInputs): number {
  const sectorFlowN = Number.isFinite(inputs.sectorFlow)
    ? inputs.sectorFlow
    : typeof inputs.rotation === 'number' && Number.isFinite(inputs.rotation)
      ? inputs.rotation
      : 55
  const weighted =
    inputs.structure * 0.18 +
    inputs.execution * 0.18 +
    inputs.supply * 0.18 +
    sectorFlowN * 0.13 +
    inputs.consensus * 0.1 +
    inputs.valuation * 0.08 +
    inputs.momentum * 0.05 +
    inputs.market * 0.05 +
    inputs.news * 0.05
  return Math.round(weighted)
}

export function getFinalGrade(score: number): string {
  if (score >= 85) return 'A'
  if (score >= 75) return 'B+'
  if (score >= 65) return 'B'
  if (score >= 55) return 'C'
  return 'Reject'
}

export function getStrategy(score: number, rsi: number, execution: number): string {
  if (rsi >= 80) return 'TAKE_PROFIT'
  if (score < 55) return 'REJECT'
  if (execution < 30 && score >= 55) return 'WATCH_ONLY'
  if (score >= 80 && rsi < 70) return 'BUY'
  if (score >= 70 && rsi >= 70) return 'HOLD'
  return 'HOLD'
}

export function getEntryStage(score: number, strategy: string): string {
  if (strategy === 'REJECT') return '관망'
  if (strategy === 'TAKE_PROFIT') return '익절'
  if (strategy === 'WATCH_ONLY') return '관망'
  if (score >= 80) return '신규진입'
  if (score >= 65) return '보유'
  return '관망'
}

/** 실행전략 계산용 진입 단계 코드 */
export function getEntryStageCode(
  strategy: Strategy,
  score: number,
  executionScore: number,
): EntryStage {
  if (strategy === 'REJECT') return 'REJECT'
  if (strategy === 'WATCH_ONLY') return 'WATCH'
  if (strategy === 'TAKE_PROFIT') return 'CAUTION'
  if (strategy === 'HOLD') return 'CAUTION'
  if (strategy === 'BUY') {
    if (score >= 80 && executionScore >= 55) return 'ACCEPT'
    if (score >= 65) return 'CAUTION'
    return 'WATCH'
  }
  return 'WATCH'
}

export function calculatePositionSize(score: number): number {
  if (score >= 85) return 20
  if (score >= 75) return 15
  if (score >= 65) return 10
  if (score >= 55) return 7
  return 0
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

/** @deprecated 로테이션 문자열만 있을 때의 근사치. `calculateSectorFlowScore`·`inferSectorFlowSnapshot` 우선. */
export function parseRotationScoreFromLogic(rotation: string | undefined): number {
  if (!rotation) return 55
  if (rotation.includes('Risk-On')) return 72
  if (rotation.includes('Risk-Off')) return 38
  return 55
}

/** 로직 모멘텀 문자열에서 KOSPI·종목 5일 등락률(%) 추출 */
export function parseFiveDayReturnFromMomentum(momentumLine: string | undefined): number {
  const m = momentumLine?.match(/5일\s*([+-]?\d+(?:\.\d+)?)/)
  return m ? Number(m[1]) : NaN
}

export function calculateSectorFlowScore(params: {
  sectorReturn5D: number
  marketReturn5D: number
  sectorRankPercentile: number
  supplyScore: number
}): number {
  const rel = params.sectorReturn5D - params.marketReturn5D
  let pts = 50
  if (rel >= 5) pts += 25
  else if (rel >= 3) pts += 18
  else if (rel >= 1) pts += 10
  else if (rel >= -1 && rel <= 1) pts += 0
  else if (rel > -3) pts -= 10
  else if (rel > -5) pts -= 20
  else pts -= 30

  const rk = params.sectorRankPercentile
  if (rk <= 20) pts += 15
  else if (rk <= 40) pts += 8
  else if (rk < 60) pts += 0
  else if (rk < 80) pts -= 8
  else pts -= 15

  if (params.supplyScore >= 75) pts += 5
  else if (params.supplyScore < 45) pts -= 5

  return Math.round(clamp(pts, 0, 100))
}

export function sectorFlowStatusFromScore(score: number): SectorFlowStatusLabel {
  if (score >= 85) return '주도섹터'
  if (score >= 70) return '관심섹터'
  if (score >= 55) return '중립'
  if (score >= 40) return '약화'
  return '소외'
}

/** 시세·API rotation 문구·모멘텀만 있을 때 섹터 자금흐름 스냅샷 추정 */
export function inferSectorFlowSnapshot(params: {
  sectorName: string
  supplyScore: number
  rotationLine?: string
  momentumLine?: string
}): SectorFlowSnapshot {
  const m5 = parseFiveDayReturnFromMomentum(params.momentumLine)
  const marketReturn5D = Number.isFinite(m5) ? m5 : 1.4
  let relAdj = 0
  if (params.rotationLine?.includes('Risk-On')) relAdj = 4.0
  else if (params.rotationLine?.includes('Risk-Off')) relAdj = -3.8
  else relAdj = 0.3
  const sectorReturn5D = marketReturn5D + relAdj + (params.supplyScore - 55) * 0.06
  const sectorRelativeReturn5D = sectorReturn5D - marketReturn5D
  let rk = Math.round(48 - sectorRelativeReturn5D * 3.8 + (params.supplyScore - 55) * 0.25)
  rk = clamp(rk, 5, 95)
  const sectorFlowScore = calculateSectorFlowScore({
    sectorReturn5D,
    marketReturn5D,
    sectorRankPercentile: rk,
    supplyScore: params.supplyScore,
  })
  return {
    sectorName: params.sectorName?.trim() ? params.sectorName : '해당 섹터',
    sectorReturn5D: Number(sectorReturn5D.toFixed(2)),
    marketReturn5D: Number(marketReturn5D.toFixed(2)),
    sectorRelativeReturn5D: Number(sectorRelativeReturn5D.toFixed(2)),
    sectorRankPercentile: rk,
    sectorFlowScore,
    sectorFlowStatus: sectorFlowStatusFromScore(sectorFlowScore),
  }
}

export function formatSignedPct1(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

/** 섹터 자금흐름 카드 메인 한 줄 */
export function sectorFlowMainTitle(snapshot: SectorFlowSnapshot): string {
  const n = snapshot.sectorName
  if (snapshot.sectorFlowStatus === '주도섹터' || snapshot.sectorFlowStatus === '관심섹터') {
    return `${n} 섹터 강함`
  }
  if (snapshot.sectorFlowStatus === '중립') return `${n} 섹터 중립`
  return `${n} 섹터 약화`
}

/** 섹터 자금흐름 카드 서브(불릿 줄바꿈) */
export function sectorFlowSubLines(snapshot: SectorFlowSnapshot): string {
  const rel = snapshot.sectorRelativeReturn5D
  const relStr =
    rel > 0 ? `+${rel.toFixed(1)}%p` : rel < 0 ? `${rel.toFixed(1)}%p` : '0.0%p'
  return [
    `섹터 5D 수익률: ${formatSignedPct1(snapshot.sectorReturn5D)}`,
    `KOSPI 5D 수익률: ${formatSignedPct1(snapshot.marketReturn5D)}`,
    `시장 대비: ${relStr}`,
    `섹터 내 상대강도: 상위 ${snapshot.sectorRankPercentile}%`,
  ].join('\n')
}

export function parseMomentumScoreFromLogic(
  momentumLine: string | undefined,
  rsi14: number,
): number {
  const m = momentumLine?.match(/5일\s*([+-]?\d+(?:\.\d+)?)/)
  const m5 = m ? Number(m[1]) : NaN
  if (!Number.isFinite(m5)) {
    return clamp(Math.round(48 + (rsi14 - 50) * 0.35), 0, 100)
  }
  return clamp(Math.round(52 + m5 * 3.2), 0, 100)
}

export function parseAtrDistance(atrGap: string | undefined): number {
  const n = Number(String(atrGap ?? '').replace(/[^\d.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : 1.5
}

export function parseConsecutiveRiseDays(streak: string | undefined): number {
  const m = streak?.match(/연속상승\s*(\d+)/)
  return m ? Number(m[1]) : 0
}

export function calculateConsensusUpside(
  currentPrice: number,
  avgTargetPrice: number,
  maxTargetPrice: number,
) {
  const avgUpsidePct = ((avgTargetPrice / currentPrice) - 1) * 100
  const maxUpsidePct = ((maxTargetPrice / currentPrice) - 1) * 100
  return {
    avgUpsidePct: Number(avgUpsidePct.toFixed(1)),
    maxUpsidePct: Number(maxUpsidePct.toFixed(1)),
  }
}

export function calculateConsensusScore(params: {
  currentPrice: number
  avgTargetPrice: number
  maxTargetPrice: number
  analystCount: number
  lastConsensusUpdateDays: number
}) {
  const { currentPrice, avgTargetPrice, maxTargetPrice, analystCount, lastConsensusUpdateDays } =
    params
  const { avgUpsidePct } = calculateConsensusUpside(
    currentPrice,
    avgTargetPrice,
    maxTargetPrice,
  )
  let score =
    avgUpsidePct >= 25
      ? 90
      : avgUpsidePct >= 15
        ? 80
        : avgUpsidePct >= 8
          ? 70
          : avgUpsidePct >= 3
            ? 55
            : avgUpsidePct >= 0
              ? 40
              : 25

  if (analystCount >= 10) score += 5
  if (analystCount < 3) score -= 10
  if (lastConsensusUpdateDays > 30) score -= 10
  if (avgTargetPrice > 0 && (maxTargetPrice / avgTargetPrice - 1) * 100 >= 30) score -= 5

  return clamp(Math.round(score), 0, 100)
}

export function calculateValuationScore(params: {
  trailingPER: number
  forwardPER: number
  forwardEPSGrowthPct: number
  sectorAveragePER: number
  historicalPERPercentile: number
}) {
  const {
    trailingPER,
    forwardPER,
    forwardEPSGrowthPct,
    sectorAveragePER,
    historicalPERPercentile,
  } = params
  let score = 40
  const forwardDropPct =
    trailingPER > 0 ? ((trailingPER - forwardPER) / trailingPER) * 100 : 0

  if (forwardDropPct > 0) score += 20
  if (forwardDropPct >= 20) score += 10

  if (forwardEPSGrowthPct >= 40) score += 30
  else if (forwardEPSGrowthPct >= 20) score += 20
  else if (forwardEPSGrowthPct >= 10) score += 10

  const sectorPremiumPct =
    sectorAveragePER > 0 ? ((forwardPER - sectorAveragePER) / sectorAveragePER) * 100 : 0
  if (sectorPremiumPct >= 50) score -= 25
  else if (sectorPremiumPct >= 30) score -= 15

  if (historicalPERPercentile >= 90) score -= 20
  else if (historicalPERPercentile >= 75) score -= 10

  return clamp(Math.round(score), 0, 100)
}

export function formatSignedNumber(value: number) {
  const abs = Math.abs(Math.round(value)).toLocaleString('ko-KR')
  if (value > 0) return `+${abs}`
  if (value < 0) return `-${abs}`
  return '0'
}

export function formatShares(value: number) {
  return `${formatSignedNumber(value)}주`
}

/** 순매수 주수: +1,234,567주 (원 단위 아님) */
export function formatSignedSharesKr(value: number) {
  const abs = Math.abs(Math.trunc(value)).toLocaleString('ko-KR')
  if (value > 0) return `+${abs}주`
  if (value < 0) return `-${abs}주`
  return `${abs}주`
}

export function formatKrwAmountToEok(value: number) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000_000) {
    const jo = Math.round((abs / 1_000_000_000_000) * 10) / 10
    const joText =
      jo % 1 === 0
        ? jo.toLocaleString('ko-KR')
        : jo.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    if (value > 0) return `+${joText}조`
    if (value < 0) return `-${joText}조`
  }
  const eok = Math.round(abs / 100_000_000)
  if (value > 0) return `+${eok.toLocaleString('ko-KR')}억`
  if (value < 0) return `-${eok.toLocaleString('ko-KR')}억`
  return '0억'
}

export type SupplyScoreInput = {
  foreignNetAmount3D: number
  institutionNetAmount3D: number
  retailNetAmount3D: number
  foreignNetAmount5D?: number | null
  institutionNetAmount5D?: number | null
  retailNetAmount5D?: number | null
}

/** 직전 3거래일(및 선택적 5거래일) 누적 수급 기준 점수 */
export function calculateSupplyScore(params: SupplyScoreInput): number {
  const f3 = params.foreignNetAmount3D
  const i3 = params.institutionNetAmount3D
  const r3 = params.retailNetAmount3D
  const fi3 = f3 + i3

  let score = 50
  if (fi3 > 0) score += 25
  if (f3 > 0) score += 20
  if (i3 > 0) score += 15
  if (f3 > 0 && i3 > 0) score += 15
  if (f3 < 0 && i3 < 0) score -= 25
  if (r3 > 0 && fi3 < 0) score -= 15

  const f5 = params.foreignNetAmount5D
  const i5 = params.institutionNetAmount5D
  const has5 =
    f5 != null &&
    i5 != null &&
    Number.isFinite(f5) &&
    Number.isFinite(i5)
  if (has5) {
    const fi5 = f5 + i5
    if (fi3 !== 0 && fi5 !== 0) {
      if (Math.sign(fi3) === Math.sign(fi5)) score += 10
      else score -= 5
    }
  }

  return clamp(Math.round(score), 0, 100)
}

export function calculateStopPrice(input: TargetStopInput): {
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
} {
  const { currentPrice } = input
  const clampLossPct = (pct: number) => clamp(pct, -8, -4)
  const candidateRows: {
    method: 'FIXED' | 'ATR' | 'SUPPORT' | 'MA20' | 'RECENT_LOW'
    price: number
    lossPct: number
    valid: boolean
    reason: string
  }[] = []

  const pushCandidate = (
    method: 'FIXED' | 'ATR' | 'SUPPORT' | 'MA20' | 'RECENT_LOW',
    rawPrice: number | undefined,
    reason: string,
  ) => {
    if (!Number.isFinite(rawPrice ?? NaN) || !rawPrice || rawPrice <= 0 || currentPrice <= 0) return
    const rounded = Math.round(rawPrice)
    const lossPct = ((rounded / currentPrice) - 1) * 100
    const valid = lossPct <= -5 && lossPct >= -7 && rounded < currentPrice
    candidateRows.push({
      method,
      price: rounded,
      lossPct: Number(lossPct.toFixed(1)),
      valid,
      reason,
    })
  }

  pushCandidate('FIXED', currentPrice * 0.94, '기본 -6% 손절 기준을 적용했습니다.')
  if (typeof input.atr14 === 'number' && Number.isFinite(input.atr14) && input.atr14 > 0) {
    pushCandidate('ATR', currentPrice - input.atr14 * 1.5, '최근 평균 변동폭(ATR)을 반영한 손절선입니다.')
  } else if (typeof input.atrPct === 'number' && Number.isFinite(input.atrPct) && input.atrPct > 0) {
    pushCandidate(
      'ATR',
      currentPrice * (1 - (input.atrPct * 1.5) / 100),
      '최근 평균 변동폭(ATR)을 반영한 손절선입니다.',
    )
  }
  if (typeof input.supportPrice === 'number' && Number.isFinite(input.supportPrice) && input.supportPrice > 0) {
    pushCandidate('SUPPORT', input.supportPrice * 0.985, '주요 지지선 이탈을 기준으로 손절선을 잡았습니다.')
  }
  if (typeof input.ma20 === 'number' && Number.isFinite(input.ma20) && input.ma20 > 0) {
    pushCandidate('MA20', input.ma20 * 0.985, '20일선 이탈을 기준으로 손절선을 잡았습니다.')
  }
  if (typeof input.recentLow20 === 'number' && Number.isFinite(input.recentLow20) && input.recentLow20 > 0) {
    pushCandidate(
      'RECENT_LOW',
      input.recentLow20 * 0.99,
      '최근 20일 저점 이탈을 기준으로 손절선을 잡았습니다.',
    )
  }

  const validRows = candidateRows.filter((c) => c.valid)
  const preferShallow =
    input.executionScore < 40 ||
    input.marketStatus === 'Caution' ||
    input.marketScore < 45 ||
    input.atrDistance >= 3.5 ||
    input.rsi14 >= 80
  const preferDeep = input.finalScore >= 85 && input.marketStatus !== 'Caution'
  const targetPct = preferShallow ? -5.2 : preferDeep ? -6.6 : -6.0
  const methodPriority: Array<'SUPPORT' | 'MA20' | 'ATR' | 'RECENT_LOW' | 'FIXED'> = [
    'SUPPORT',
    'MA20',
    'ATR',
    'RECENT_LOW',
    'FIXED',
  ]

  let warning: string | undefined
  if (input.rsi14 >= 80) {
    warning = 'RSI 과열권이므로 손절을 짧게 잡고 추격매수는 피하는 것이 좋습니다.'
  } else if (input.atrDistance >= 3.5) {
    warning = 'ATR 이격이 커진 상태라 손절선이 가까워도 변동성 리스크가 큽니다.'
  } else if (input.marketScore < 45) {
    warning = '시장 환경이 약해 손절 기준을 더 엄격하게 적용합니다.'
  }

  if (validRows.length > 0) {
    const sorted = [...validRows].sort((a, b) => {
      const p = methodPriority.indexOf(a.method) - methodPriority.indexOf(b.method)
      if (p !== 0) return p
      return Math.abs(a.lossPct - targetPct) - Math.abs(b.lossPct - targetPct)
    })
    const picked = sorted[0]
    let stopLossPct = clampLossPct(picked.lossPct)
    let stopPrice = Math.round(currentPrice * (1 + stopLossPct / 100))
    stopPrice = Math.min(stopPrice, Math.round(currentPrice - 1))
    stopLossPct = Number((((stopPrice / currentPrice) - 1) * 100).toFixed(1))
    return {
      stopPrice,
      stopLossPct,
      method: picked.method,
      reason: picked.reason,
      candidates: candidateRows.map((c) => ({
        method: c.method,
        price: c.price,
        lossPct: c.lossPct,
        valid: c.valid,
        reason: c.reason,
      })),
      warning,
    }
  }

  let fallbackPct =
    input.marketStatus === 'Caution' || input.marketScore < 45
      ? -5.0
      : input.rsi14 >= 80 || input.atrDistance >= 3.5
        ? -5.0
        : input.executionScore < 40
          ? -5.0
          : input.finalScore >= 85
            ? -6.5
            : -6.0
  fallbackPct = clampLossPct(fallbackPct)
  let stopPrice = Math.round(currentPrice * (1 + fallbackPct / 100))
  stopPrice = Math.min(stopPrice, Math.round(currentPrice - 1))
  const stopLossPct = Number((((stopPrice / currentPrice) - 1) * 100).toFixed(1))
  warning =
    '지지선·ATR 기준이 -5%~-7% 범위에 맞지 않아 기본 손절선을 사용했습니다.'
  return {
    stopPrice,
    stopLossPct,
    method: 'FALLBACK',
    reason: '유효한 기술적 기준이 없어 기본 리스크 기준을 적용했습니다.',
    candidates: candidateRows.map((c) => ({
      method: c.method,
      price: c.price,
      lossPct: c.lossPct,
      valid: c.valid,
      reason: c.reason,
    })),
    warning,
  }
}

function resolveAtrPctForTargets(input: TargetPriceInput): number {
  const { currentPrice, atr14, atrPct } = input
  if (typeof atrPct === 'number' && Number.isFinite(atrPct) && atrPct > 0) {
    return atrPct
  }
  if (
    typeof atr14 === 'number' &&
    Number.isFinite(atr14) &&
    atr14 > 0 &&
    currentPrice > 0
  ) {
    return (atr14 / currentPrice) * 100
  }
  return 2.0
}

function targetProbability(input: TargetPriceInput, label: TargetPriceRow['label']): number {
  const {
    finalScore,
    executionScore,
    supplyScore,
    marketScore,
    rsi14,
    valuationScore,
    consensusScore,
  } = input
  let p =
    label === '1D' ? 42 : label === '7D' ? 48 : label === '1M' ? 55 : 58

  if (finalScore >= 85) p += 8
  else if (finalScore >= 75) p += 5
  else if (finalScore < 60) p -= 8

  if (executionScore >= 70) p += 5
  else if (executionScore < 40) p -= 8

  if (supplyScore >= 70) p += 5
  if (marketScore < 45) p -= 7
  if (rsi14 >= 80) p -= 8
  else if (rsi14 >= 75) p -= 4
  if (valuationScore < 45) p -= 4
  if (consensusScore < 45) p -= 4

  if (label === '1D') p -= 3
  if (label === '1M') p += 3
  if (label === '3M') p += 4

  return Math.round(clamp(p, 20, 85))
}

function finalizeTargetRow(
  currentPrice: number,
  expectedReturnPct: number,
): { targetPrice: number; expectedReturnPct: number } {
  let er = expectedReturnPct
  if (er < 0.2) er = 0.2
  let tp = Math.round(currentPrice * (1 + er / 100))
  const floor = Math.round(currentPrice * 1.002)
  if (tp < floor) {
    tp = floor
    er = ((tp - currentPrice) / currentPrice) * 100
  }
  return {
    targetPrice: tp,
    expectedReturnPct: Number(er.toFixed(2)),
  }
}

/**
 * 기간별 목표가·기대수익률·달성확률 (실제 입력값 기반). 컨센서스는 경고/참고만.
 */
export function calculateTargetPrices(input: TargetPriceInput): CalculateTargetPricesResult {
  const {
    currentPrice,
    rsi14,
    finalScore,
    structureScore,
    executionScore,
    supplyScore,
    sectorFlowScore,
    valuationScore,
    consensusScore,
    momentumScore,
    marketScore,
    marketStatus,
    resistancePrice,
    consensusAvgTargetPrice,
    consensusMaxTargetPrice,
  } = input

  const warnings: string[] = []
  const notes: string[] = []

  const atrPct = resolveAtrPctForTargets(input)

  // --- 1D ---
  const baseMove1D = atrPct * 0.35
  let adj1D = 0
  if (finalScore >= 85) adj1D += 0.25
  else if (finalScore >= 75) adj1D += 0.15
  else if (finalScore < 60) adj1D -= 0.15
  if (executionScore >= 70) adj1D += 0.15
  if (executionScore < 40) adj1D -= 0.2
  if (marketScore < 45) adj1D -= 0.2
  if (rsi14 >= 80) adj1D -= 0.3
  else if (rsi14 >= 75) adj1D -= 0.15
  let expectedReturn1D = clamp(baseMove1D + adj1D, 0.2, 2.5)
  let target1D = Math.round(currentPrice * (1 + expectedReturn1D / 100))

  // --- 7D ---
  const baseMove7D = atrPct * 1.2
  let adj7D = 0
  if (finalScore >= 85) adj7D += 1.2
  else if (finalScore >= 75) adj7D += 0.8
  else if (finalScore >= 65) adj7D += 0.4
  if (executionScore >= 70) adj7D += 0.5
  if (supplyScore >= 70) adj7D += 0.5
  if (sectorFlowScore >= 70) adj7D += 0.3
  if (marketScore < 45) adj7D -= 0.8
  if (rsi14 >= 80) adj7D -= 1.0
  else if (rsi14 >= 75) adj7D -= 0.5
  if (executionScore < 40) adj7D -= 0.8
  let expectedReturn7D = clamp(baseMove7D + adj7D, 0.8, 6.0)
  let target7D = Math.round(currentPrice * (1 + expectedReturn7D / 100))

  const res =
    typeof resistancePrice === 'number' &&
    Number.isFinite(resistancePrice) &&
    resistancePrice > currentPrice
      ? resistancePrice
      : null

  if (res) {
    const capLine = res * 1.01
    if (target1D > capLine) {
      target1D = Math.round(res)
      expectedReturn1D = ((target1D - currentPrice) / currentPrice) * 100
    }
    if (target7D > capLine) {
      target7D = Math.round(res)
      expectedReturn7D = ((target7D - currentPrice) / currentPrice) * 100
    }
  }

  const resistanceNote1M3M =
    res != null
      ? '단기 저항선 근처에서 일부 매물 소화가 필요할 수 있습니다.'
      : undefined

  // --- 1M ---
  const baseReturn1M =
    finalScore >= 85 ? 12 : finalScore >= 75 ? 9 : finalScore >= 65 ? 6 : finalScore >= 55 ? 4 : 2
  let adj1M = 0
  if (structureScore >= 85) adj1M += 1.0
  if (executionScore >= 70) adj1M += 1.0
  if (supplyScore >= 75) adj1M += 1.0
  if (sectorFlowScore >= 75) adj1M += 0.8
  if (valuationScore >= 75) adj1M += 0.7
  if (consensusScore >= 75) adj1M += 0.7
  if (momentumScore >= 75) adj1M += 0.8
  if (marketScore < 45) adj1M -= 1.5
  if (marketStatus === 'Caution') adj1M -= 1.0
  if (rsi14 >= 80) adj1M -= 2.0
  else if (rsi14 >= 75) adj1M -= 1.0
  if (executionScore < 40) adj1M -= 2.0
  const expectedReturn1M = clamp(baseReturn1M + adj1M, 2, 15)

  // --- 3M ---
  const baseReturn3M =
    finalScore >= 85 ? 18 : finalScore >= 75 ? 15 : finalScore >= 65 ? 11 : finalScore >= 55 ? 8 : 5
  let adj3M = 0
  if (supplyScore >= 75) adj3M += 1.5
  if (sectorFlowScore >= 75) adj3M += 1.0
  if (valuationScore >= 75) adj3M += 1.0
  if (consensusScore >= 75) adj3M += 1.0
  if (momentumScore >= 75) adj3M += 1.0
  if (marketStatus === 'RiskOn') adj3M += 1.0
  if (marketStatus === 'Caution') adj3M -= 2.0
  if (rsi14 >= 80) adj3M -= 2.5
  if (executionScore < 40) adj3M -= 2.0
  if (valuationScore < 45) adj3M -= 1.5
  if (consensusScore < 45) adj3M -= 1.5
  const expectedReturn3M = clamp(baseReturn3M + adj3M, 5, 25)

  // 컨센서스: 제한 없이 경고·참고만
  const hasAvg =
    typeof consensusAvgTargetPrice === 'number' &&
    Number.isFinite(consensusAvgTargetPrice) &&
    consensusAvgTargetPrice > 0
  const hasMax =
    typeof consensusMaxTargetPrice === 'number' &&
    Number.isFinite(consensusMaxTargetPrice) &&
    consensusMaxTargetPrice > 0

  if (hasAvg && currentPrice > (consensusAvgTargetPrice as number)) {
    warnings.push('현재가가 컨센서스 평균 목표가를 초과했습니다.')
  }

  if (hasAvg) {
    const upside = (consensusAvgTargetPrice as number) / currentPrice - 1
    if (upside < 0.08) {
      notes.push('컨센서스 기준 상승여력은 제한적입니다.')
    }
    if (upside >= 0.15) {
      notes.push('컨센서스 기준으로도 15% 내외 상승여력이 남아 있습니다.')
    }
  }

  const f1 = finalizeTargetRow(currentPrice, expectedReturn1D)
  const f7 = finalizeTargetRow(currentPrice, expectedReturn7D)
  const f1m = finalizeTargetRow(currentPrice, expectedReturn1M)
  const f3m = finalizeTargetRow(currentPrice, expectedReturn3M)

  if (hasMax && f3m.targetPrice > (consensusMaxTargetPrice as number)) {
    warnings.push(
      '3M 목표가가 컨센서스 최고 목표가를 초과합니다. 강한 실적·수급 모멘텀이 필요합니다.',
    )
  }

  const targets: TargetPriceRow[] = [
    {
      label: '1D',
      ...f1,
      probability: targetProbability(input, '1D'),
      method: 'ATR 단기 변동',
    },
    {
      label: '7D',
      ...f7,
      probability: targetProbability(input, '7D'),
      method: 'ATR + 모멘텀',
    },
    {
      label: '1M',
      ...f1m,
      probability: targetProbability(input, '1M'),
      method: '점수 기반 1개월 목표',
      ...(resistanceNote1M3M ? { note: resistanceNote1M3M } : {}),
    },
    {
      label: '3M',
      ...f3m,
      probability: targetProbability(input, '3M'),
      method: '3개월 모멘텀 목표',
      ...(resistanceNote1M3M ? { note: resistanceNote1M3M } : {}),
    },
  ]

  return { targets, warnings, notes }
}

export function calculateRiskReward(
  currentPrice: number,
  stopPrice: number,
  oneMonthTargetPrice: number,
): RiskReward {
  const risk = Math.max(0, currentPrice - stopPrice)
  const reward = oneMonthTargetPrice - currentPrice
  const ratio = risk > 0 ? reward / risk : 0
  const verdict =
    ratio >= 2 ? '좋음' : ratio >= 1.5 ? '가능' : ratio >= 1 ? '애매' : '비추천'
  return {
    risk: Math.round(risk),
    reward: Math.round(reward),
    ratio: Number(ratio.toFixed(2)),
    verdict,
  }
}

function maxPositionBase(strategy: Strategy): number {
  switch (strategy) {
    case 'REJECT':
      return 0
    case 'WATCH_ONLY':
      return 5
    case 'TAKE_PROFIT':
      return 0
    case 'HOLD':
      return 12
    case 'BUY':
      return 18
    default:
      return 12
  }
}

export function calculateMaxPosition(input: ExecutionInput): number {
  let max = maxPositionBase(input.strategy)

  if (input.finalScore >= 85) max += 2
  if (input.structureScore >= 85 && input.executionScore >= 70) max += 2
  if (input.supplyScore >= 75) max += 1
  if (input.consensusScore >= 75) max += 1

  if (input.marketStatus === 'Caution' || input.marketScore < 45) max -= 5
  if (input.rsi14 >= 80) max -= 8
  else if (input.rsi14 >= 75) max -= 4
  if (input.atrDistance >= 3.5) max -= 6
  else if (input.atrDistance >= 2.5) max -= 3
  if (input.executionScore < 40) max -= 6
  if (input.riskRewardRatio < 1) max -= 8
  else if (input.riskRewardRatio < 1.5) max -= 4

  max = Math.round(max)

  if (input.entryStage === 'REJECT') max = Math.min(max, 3)
  if (input.entryStage === 'WATCH') max = Math.min(max, 5)
  if (input.entryStage === 'CAUTION') max = Math.min(max, 8)

  max = clamp(max, 0, 20)

  if (input.strategy === 'BUY' && input.rsi14 >= 80) max = Math.min(max, 5)
  if (input.riskRewardRatio < 1) max = Math.min(max, 3)

  return max
}

function recommendedBase(strategy: Strategy): number {
  switch (strategy) {
    case 'REJECT':
      return 0
    case 'WATCH_ONLY':
      return 2
    case 'TAKE_PROFIT':
      return 0
    case 'HOLD':
      return 8
    case 'BUY':
      return 12
    default:
      return 8
  }
}

export function calculateRecommendedPosition(input: ExecutionInput, maxPositionPct: number): number {
  let rec = recommendedBase(input.strategy)

  if (input.finalScore >= 85) rec += 3
  else if (input.finalScore >= 75) rec += 1
  if (input.executionScore >= 70) rec += 2
  if (input.supplyScore >= 70) rec += 2
  if (input.sectorFlowScore >= 70) rec += 1
  if (input.valuationScore >= 70) rec += 1
  if (input.consensusScore >= 70) rec += 1
  if (input.riskRewardRatio >= 2) rec += 2

  if (input.finalScore < 65) rec -= 3
  if (input.executionScore < 40) rec -= 5
  if (input.supplyScore < 40) rec -= 3
  if (input.marketScore < 45) rec -= 4
  if (input.rsi14 >= 80) rec -= 7
  else if (input.rsi14 >= 75) rec -= 4
  if (input.atrDistance >= 3.5) rec -= 6
  else if (input.atrDistance >= 2.5) rec -= 3
  if (input.consecutiveRiseDays >= 5) rec -= 3
  if (input.riskRewardRatio < 1) rec -= 8
  else if (input.riskRewardRatio < 1.5) rec -= 4

  rec = Math.round(rec)
  rec = Math.max(0, rec)
  rec = Math.min(rec, maxPositionPct)

  if (input.entryStage === 'REJECT') rec = Math.min(rec, 3)
  if (input.entryStage === 'WATCH') rec = Math.min(rec, 5)
  if (input.entryStage === 'CAUTION') rec = Math.min(rec, 8)
  if (input.strategy === 'TAKE_PROFIT' || input.strategy === 'REJECT') rec = 0

  return clamp(rec, 0, maxPositionPct)
}

export function calculateRiskAmount(
  input: ExecutionInput,
  recommendedPositionPct: number,
): { riskAmountPct: number; riskAmountWon?: number } {
  const riskAmountPct = Number(
    ((recommendedPositionPct * Math.abs(input.stopLossPct)) / 100).toFixed(2),
  )
  const riskAmountWon =
    input.accountSize != null
      ? Math.round((input.accountSize * riskAmountPct) / 100)
      : undefined
  return { riskAmountPct, riskAmountWon }
}

export function getActionLabel(input: ExecutionInput): string {
  if (input.rsi14 >= 80) return '과열권 익절 우선'
  if (input.atrDistance >= 3.5) return '추격매수 금지'
  if (input.riskRewardRatio < 1) return '손익비 부족'

  const { strategy, entryStage } = input
  if (strategy === 'BUY' && entryStage === 'ACCEPT') return '신규진입 가능'
  if (strategy === 'BUY' && entryStage === 'CAUTION') return '눌림 대기'
  if (strategy === 'HOLD') return '보유 유지'
  if (strategy === 'WATCH_ONLY') return '관망'
  if (strategy === 'TAKE_PROFIT') return '분할익절'
  return '제외'
}

function buildWarnings(input: ExecutionInput): string[] {
  const w: string[] = []
  if (input.rsi14 >= 80) w.push('RSI 과열권입니다.')
  if (input.atrDistance >= 3.5) w.push('ATR 이격이 커 추격매수 위험이 있습니다.')
  if (input.marketScore < 45) w.push('시장 환경이 약합니다.')
  if (input.supplyScore < 40) w.push('외국인·기관 수급이 약합니다.')
  if (input.riskRewardRatio < 1.5) w.push('손익비가 부족합니다.')
  return w
}

function buildSummary(recommendedPositionPct: number): string {
  if (recommendedPositionPct === 0) {
    return '현재 조건에서는 신규 비중을 싣기보다 관망이 유리합니다.'
  }
  if (recommendedPositionPct >= 15) {
    return '구조·수급·손익비가 양호해 집중 후보로 볼 수 있습니다.'
  }
  if (recommendedPositionPct >= 8) {
    return '조건은 나쁘지 않지만 분할 진입이 더 안전합니다.'
  }
  if (recommendedPositionPct < 5) {
    return '진입 매력은 제한적이므로 소액 관찰 또는 대기가 유리합니다.'
  }
  return '조건은 보통 수준입니다. 비중은 최대 한도 안에서 조절하세요.'
}

const THREE_M_ALLOWED_PCT = [0, 5, 8, 10, 15, 20] as const

function snapThreeMonthPositionPct(raw: number, cap: number): number {
  const v = Math.max(0, Math.min(raw, cap))
  let best = 0
  for (const a of THREE_M_ALLOWED_PCT) {
    if (a <= v && a >= best) best = a
  }
  return best
}

function resolveThreeMonthEntryDecision(input: ThreeMonthStrategyInput): string {
  const { finalScore, executionScore, rsi14, atrDistance, strategy } = input

  if (strategy === 'REJECT' || finalScore < 55) return '제외'
  if (strategy === 'TAKE_PROFIT' || rsi14 >= 80) return '분할익절'
  if (strategy === 'WATCH_ONLY') return '관망'
  if (strategy === 'HOLD') return '보유 유지'
  if (
    finalScore >= 75 &&
    executionScore >= 65 &&
    rsi14 < 75 &&
    atrDistance < 2.5
  ) {
    return '신규진입 가능'
  }
  if (finalScore >= 75 && executionScore < 65) return '눌림 대기'
  if (finalScore >= 75) return '눌림 대기'
  return '눌림 대기'
}

/** 3개월 +15% 실행 규칙 (현재가·지표 기반) */
export function calculateThreeMonthStrategy(input: ThreeMonthStrategyInput): ThreeMonthStrategy {
  const {
    currentPrice: price,
    finalScore,
    executionScore,
    supplyScore,
    rsi14,
    atrDistance,
    atr14,
    marketStatus,
    marketScore,
    riskRewardRatio,
    supportPrice,
    consensusAvgTargetPrice,
    consensusMaxTargetPrice,
  } = input

  const warnings: string[] = []
  const entryDecision = resolveThreeMonthEntryDecision(input)

  const stopCalc = calculateStopPrice({
    currentPrice: price,
    atr14,
    supportPrice,
    recentLow20: Math.round(price * 0.94),
    finalScore,
    executionScore,
    marketScore,
    rsi14,
    atrDistance,
    riskRewardRatio,
    marketStatus,
  })
  const stopPrice = stopCalc.stopPrice
  const stopLossPct = stopCalc.stopLossPct
  const stopReason = stopCalc.reason

  let rec = 0
  if (entryDecision === '제외' || entryDecision === '분할익절') {
    rec = 0
  } else if (entryDecision === '보유 유지') {
    rec = 0
  } else if (entryDecision === '관망') {
    rec = 5
  } else if (entryDecision === '눌림 대기') {
    rec = 5
  } else if (entryDecision === '신규진입 가능') {
    rec = 10
    if (finalScore >= 85 && supplyScore >= 75 && riskRewardRatio >= 2) rec = 15
    if (finalScore >= 85 && marketStatus === 'RiskOn' && executionScore >= 80) rec = 20
  }

  let cap = 20
  if (rsi14 >= 80) cap = 0
  else if (rsi14 >= 75) cap = 8
  if (marketStatus === 'Caution') cap = Math.min(cap, 10)
  if (riskRewardRatio < 1.5) cap = Math.min(cap, 5)

  if (stopLossPct < -6.5) {
    cap = Math.min(cap, 10)
    rec = Math.min(rec, 10)
  }
  if (stopLossPct < -6.85) {
    cap = Math.min(cap, 5)
    rec = Math.min(rec, 5)
  }

  const recommendedPositionPct = snapThreeMonthPositionPct(rec, cap)

  const firstTakeProfitPrice = Math.round(price * 1.09)
  const firstTakeProfitPct = 9
  let firstTakeProfitSellPct = 30
  if (rsi14 >= 75) firstTakeProfitSellPct = 50
  else if (finalScore >= 85 && supplyScore >= 75) firstTakeProfitSellPct = 25

  let finalTargetPrice = Math.round(price * 1.15)
  if (finalTargetPrice <= price) {
    finalTargetPrice = Math.ceil(price * 1.15)
  }
  const finalTargetPct = 15

  const consensusMsgs: string[] = []
  const hasAvg =
    consensusAvgTargetPrice != null &&
    consensusAvgTargetPrice > 0 &&
    Number.isFinite(consensusAvgTargetPrice)
  const hasMax =
    consensusMaxTargetPrice != null &&
    consensusMaxTargetPrice > 0 &&
    Number.isFinite(consensusMaxTargetPrice)

  if (hasAvg) {
    const avg = consensusAvgTargetPrice as number
    if (price > avg) {
      consensusMsgs.push(
        '현재가가 컨센서스 평균 목표가를 이미 초과했습니다. 목표가는 모멘텀 기준으로 보되, 밸류에이션 부담을 확인해야 합니다.',
      )
    } else if (avg > price) {
      const consensusUpsidePct = ((avg / price) - 1) * 100
      if (consensusUpsidePct < 8) {
        consensusMsgs.push(
          '컨센서스 기준 상승여력은 제한적입니다. 단기 모멘텀 중심으로 접근해야 합니다.',
        )
      }
      if (consensusUpsidePct >= 15) {
        consensusMsgs.push('컨센서스 기준으로도 15% 내외 상승여력이 남아 있습니다.')
      }
    }
  }

  if (hasMax && finalTargetPrice > (consensusMaxTargetPrice as number)) {
    consensusMsgs.push(
      '3개월 +15% 목표가가 컨센서스 최고 목표가를 초과합니다. 목표 달성에는 강한 실적·수급 모멘텀이 필요합니다.',
    )
  }

  const consensusNote = consensusMsgs.join(' ')
  for (const m of consensusMsgs) {
    warnings.push(m)
  }

  if (rsi14 >= 80) {
    warnings.push('RSI 80 이상 — 추격매수 금지.')
  }
  if (atrDistance >= 3.5) {
    warnings.push('ATR 이격 3.5 이상 — 추격매수 금지.')
  }
  if (marketScore < 45) {
    warnings.push('시장 점수가 낮습니다.')
  }

  let reviewDays = 20
  if (marketStatus === 'Caution') reviewDays = 10
  else if (finalScore >= 85 && executionScore >= 70) reviewDays = 30

  const timeStopRule = [
    `${reviewDays}거래일 내 +5% 미달 시 재평가`,
    '60거래일 내 +15% 미달 시 정리 또는 재선정',
  ].join('\n')

  const addParts: string[] = []
  if (rsi14 >= 75 || atrDistance >= 2.5) {
    addParts.push('추가매수 금지(RSI·ATR 조건).')
  } else if (entryDecision === '제외' || entryDecision === '분할익절') {
    addParts.push('추가매수 금지.')
  } else if (entryDecision === '눌림 대기') {
    addParts.push('20일선·주요 지지선 근처에서만 추가매수.')
  } else if (entryDecision === '신규진입 가능') {
    addParts.push('수익 +3% 확인 후 거래량 증가·수급 유지 시 5% 추가 가능.')
  } else {
    addParts.push('추가매수는 조건 충족 시에만 검토.')
  }
  addParts.push('손실 중 물타기 금지.')
  const addBuyRule = addParts.join(' ')

  let summary: string
  if (entryDecision === '제외') {
    summary = '신규 진입 제외. 조건 개선 시 다시 확인하세요.'
  } else if (entryDecision === '분할익절') {
    summary = `과열·익절 구간 — ${firstTakeProfitSellPct}% 분할 매도를 우선 검토하세요.`
  } else if (entryDecision === '관망') {
    summary = `관망 위주 — 비중 ${recommendedPositionPct}% 이하로 제한하세요.`
  } else if (entryDecision === '보유 유지') {
    summary = `보유 유지 — 신규 비중 ${recommendedPositionPct}%, 손절 ${stopLossPct.toFixed(1)}%, +9%에서 ${firstTakeProfitSellPct}% 익절, 목표 +${finalTargetPct.toFixed(0)}%는 최대 3개월.`
  } else {
    summary = `${recommendedPositionPct}% 비중으로 진입, ${stopLossPct.toFixed(1)}% 손절, +9%에서 ${firstTakeProfitSellPct}% 익절, +${finalTargetPct.toFixed(0)}%는 3개월 내 목표.`
  }

  return {
    entryDecision,
    recommendedPositionPct,
    stopPrice,
    stopLossPct,
    stopReason,
    firstTakeProfitPrice,
    firstTakeProfitPct,
    firstTakeProfitSellPct,
    finalTargetPrice,
    finalTargetPct,
    maxHoldingPeriod: '최대 3개월(약 60거래일)',
    timeStopRule,
    addBuyRule,
    summary,
    consensusNote,
    warnings,
  }
}

export function calculateExecutionPlan(input: ExecutionInput): ExecutionPlan {
  const maxPositionPct = calculateMaxPosition(input)
  const recommendedPositionPct = calculateRecommendedPosition(input, maxPositionPct)
  const { riskAmountPct, riskAmountWon } = calculateRiskAmount(input, recommendedPositionPct)

  const action = getActionLabel(input)
  const timeStop =
    input.marketStatus === 'Caution' || input.marketScore < 45
      ? '5D 타임스탑'
      : input.finalScore >= 85 && input.momentumScore >= 75
        ? '10D 타임스탑'
        : '7D 타임스탑'

  const stopRule = `손절 ${input.stopLossPct >= 0 ? '+' : ''}${input.stopLossPct.toFixed(1)}% / Stop ${Math.round(input.stopPrice).toLocaleString('ko-KR')}원 이탈 시 정리`

  let takeProfitRule = '+10%부터 30~50% 분할익절'
  if (input.rsi14 >= 80) {
    takeProfitRule = '과열권이므로 +5~8% 구간에서도 일부 익절'
  } else if (
    input.finalScore >= 85 &&
    input.momentumScore >= 75 &&
    input.supplyScore >= 70
  ) {
    takeProfitRule = '+10%에서 30% 익절, 나머지는 +15%까지 홀드'
  }

  let addBuyRule = '추가매수 금지'
  if (input.entryStage === 'ACCEPT') {
    addBuyRule = '첫 진입 후 +2~3% 수익 확인 시 추가매수 가능'
  } else if (input.entryStage === 'CAUTION') {
    addBuyRule = '20일선 또는 직전 지지선 근처 눌림에서만 추가매수'
  }

  let reduceRule = '손절선 이탈 전까지 보유'
  if (input.marketStatus === 'Caution' || input.marketScore < 45) {
    reduceRule = '시장 약세 시 비중 30~50% 축소'
  } else if (input.rsi14 >= 80) {
    reduceRule = '과열권 진입 시 절반 이상 익절'
  } else if (input.riskRewardRatio < 1.5) {
    reduceRule = '손익비 부족으로 비중 축소'
  }

  const warnings = buildWarnings(input)
  const summary = buildSummary(recommendedPositionPct)

  return {
    recommendedPositionPct,
    maxPositionPct,
    riskAmountPct,
    riskAmountWon,
    action,
    timeStop,
    stopRule,
    takeProfitRule,
    addBuyRule,
    reduceRule,
    summary,
    warnings,
  }
}
