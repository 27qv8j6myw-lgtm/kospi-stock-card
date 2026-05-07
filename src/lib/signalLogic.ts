import type {
  ExecutionInput,
  ExecutionPlan,
  RiskReward,
  ScoreInputs,
  TargetPrice,
  TargetStopInput,
} from '../types/stock'

export function calculateFinalScore(inputs: ScoreInputs): number {
  const weighted =
    inputs.structure * 0.18 +
    inputs.execution * 0.18 +
    inputs.supply * 0.18 +
    inputs.rotation * 0.13 +
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

export function calculateSupplyScore(params: {
  foreignNetAmount: number
  institutionNetAmount: number
  retailNetAmount: number
  volumeTrendScore?: number
}) {
  const { foreignNetAmount, institutionNetAmount, retailNetAmount, volumeTrendScore } = params
  let score = 50
  const fiSum = foreignNetAmount + institutionNetAmount
  if (fiSum > 0) score += 25
  if (foreignNetAmount > 0) score += 20
  if (institutionNetAmount > 0) score += 15
  if (foreignNetAmount > 0 && institutionNetAmount > 0) score += 15
  if (foreignNetAmount < 0 && institutionNetAmount < 0) score -= 25
  if (retailNetAmount > 0 && foreignNetAmount < 0 && institutionNetAmount < 0) score -= 15
  if (typeof volumeTrendScore === 'number' && Number.isFinite(volumeTrendScore)) {
    score = score * 0.8 + volumeTrendScore * 0.2
  }
  return clamp(Math.round(score), 0, 100)
}

export function calculateStopPrice(input: TargetStopInput): {
  stopPrice: number
  stopLossPct: number
  method: string
  supportPrice: number
} {
  const { currentPrice, atr14, supportPrice, finalScore, marketStatus } = input
  const candidates = [
    { method: '기본(-5.5%)', stopPrice: currentPrice * 0.945 },
    { method: 'ATR(1.5x)', stopPrice: currentPrice - atr14 * 1.5 },
    { method: '지지선(98.5%)', stopPrice: supportPrice * 0.985 },
  ].map((c) => {
    const stopLossPct = ((c.stopPrice - currentPrice) / currentPrice) * 100
    return { ...c, stopPrice: Math.round(c.stopPrice), stopLossPct }
  })

  const valid = candidates.filter((c) => c.stopLossPct <= -5 && c.stopLossPct >= -7)
  if (valid.length) {
    const picked = valid.sort(
      (a, b) => Math.abs(a.stopLossPct + 5.5) - Math.abs(b.stopLossPct + 5.5),
    )[0]
    return {
      stopPrice: picked.stopPrice,
      stopLossPct: Number(picked.stopLossPct.toFixed(2)),
      method: picked.method,
      supportPrice: Math.round(supportPrice),
    }
  }

  const fallbackPct =
    marketStatus === 'Caution' ? -5.0 : finalScore >= 75 ? -6.5 : -5.5
  return {
    stopPrice: Math.round(currentPrice * (1 + fallbackPct / 100)),
    stopLossPct: fallbackPct,
    method: 'Fallback',
    supportPrice: Math.round(supportPrice),
  }
}

export function estimateTargetProbability(
  input: TargetStopInput,
  horizon: '1D' | '7D' | '1M' | '3M',
): number {
  let p = 45
  p += (input.finalScore - 60) * 0.45
  p += (input.executionScore - 50) * 0.2
  if (input.marketStatus === 'RiskOn') p += 8
  if (input.marketStatus === 'Caution') p -= 8
  if (input.rsi14 >= 80) p -= 10
  else if (input.rsi14 >= 75) p -= 6
  else if (input.rsi14 <= 45 && input.structureScore >= 70) p += 4

  if (horizon === '1D') p += 6
  if (horizon === '7D') p += 2
  if (horizon === '3M') p -= 6

  return Math.round(clamp(p, 20, 85))
}

export function calculateTargetPrices(input: TargetStopInput): TargetPrice[] {
  const { currentPrice, finalScore, structureScore, executionScore, marketStatus, rsi14, resistancePrice } = input
  let base1M =
    finalScore >= 85 ? 13.5 : finalScore >= 75 ? 10 : finalScore >= 65 ? 6.5 : finalScore >= 55 ? 4 : 2

  base1M *= marketStatus === 'RiskOn' ? 1.1 : marketStatus === 'Caution' ? 0.8 : 1.0
  if (rsi14 >= 80) base1M *= 0.65
  else if (rsi14 >= 75) base1M *= 0.8
  else if (rsi14 <= 45 && structureScore >= 70) base1M *= 1.05
  if (executionScore < 30) base1M *= 0.75
  if (structureScore >= 75) base1M *= 1.1

  const ratios: Array<{ h: '1D' | '7D' | '1M' | '3M'; sub?: string; ratio: number; n: number }> = [
    { h: '1D', ratio: 0.12, n: 145 },
    { h: '7D', ratio: 0.35, n: 145 },
    { h: '1M', sub: '(21D)', ratio: 1.0, n: 151 },
    { h: '3M', sub: '(63D)', ratio: 1.65, n: 163 },
  ]

  return ratios.map((r) => {
    let expectedReturnPct = base1M * r.ratio
    if (r.h === '3M') expectedReturnPct = Math.min(expectedReturnPct, 25)
    let targetPrice = Math.round(currentPrice * (1 + expectedReturnPct / 100))
    if ((r.h === '1D' || r.h === '7D') && targetPrice > resistancePrice * 1.01) {
      targetPrice = Math.round(resistancePrice)
      expectedReturnPct = ((targetPrice - currentPrice) / currentPrice) * 100
    }
    return {
      horizon: r.h,
      sub: r.sub,
      targetPrice,
      expectedReturnPct: Number(expectedReturnPct.toFixed(2)),
      probability: estimateTargetProbability(input, r.h),
      sampleSize: r.n,
    }
  })
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

export function calculateMaxPosition(input: ExecutionInput): number {
  let max =
    input.finalScore >= 85 && input.executionScore >= 60 && input.riskRewardRatio >= 2
      ? 20
      : input.finalScore >= 75
        ? 15
        : input.finalScore >= 65
          ? 10
          : 8
  if (input.strategy === 'WATCH_ONLY') max = 5
  if (input.strategy === 'REJECT') max = 0
  if (input.marketStatus === 'Caution') max -= 5
  if (input.rsi14 >= 80) max = Math.min(max, 5)
  if (input.riskRewardRatio < 1) max = Math.min(max, 3)
  return clamp(Math.round(max), 0, 20)
}

export function calculateRecommendedPosition(input: ExecutionInput): number {
  let base =
    input.strategy === 'REJECT'
      ? 0
      : input.strategy === 'WATCH_ONLY'
        ? 3
        : input.strategy === 'TAKE_PROFIT'
          ? 0
          : input.strategy === 'HOLD'
            ? 10
            : 15

  if (input.finalScore >= 85) base += 3
  else if (input.finalScore >= 75) base += 1
  else if (input.finalScore < 65) base -= 3

  if (input.executionScore < 30) base -= 5
  else if (input.executionScore >= 70) base += 2

  if (input.supplyScore >= 70) base += 2
  else if (input.supplyScore < 40) base -= 3

  if (input.momentumScore >= 75) base += 2
  if (input.rsi14 >= 80) base -= 7
  else if (input.rsi14 >= 75) base -= 4

  if (input.marketStatus === 'Caution') base -= 3
  if (input.marketStatus === 'RiskOn') base += 2

  if (input.riskRewardRatio < 1) base -= 8
  else if (input.riskRewardRatio < 1.5) base -= 4
  else if (input.riskRewardRatio >= 2) base += 2

  let recommended = clamp(Math.round(base), 0, 100)
  const maxPos = calculateMaxPosition(input)
  recommended = Math.min(recommended, maxPos)

  if (
    input.strategy === 'WATCH_ONLY' ||
    input.strategy === 'REJECT' ||
    input.entryStage === 'REJECT'
  ) {
    recommended = Math.min(recommended, 3)
  }
  if (input.entryStage === 'CAUTION') recommended = Math.min(recommended, 8)
  if (input.strategy === 'BUY' && input.rsi14 >= 80) recommended = Math.min(recommended, 5)
  return clamp(recommended, 0, Math.max(0, maxPos))
}

export function calculateRiskAmount(recommendedPositionPct: number, stopLossPct: number) {
  return (recommendedPositionPct * Math.abs(stopLossPct)) / 100
}

export function getActionLabel(
  strategy: ExecutionInput['strategy'],
  entryStage: ExecutionInput['entryStage'],
) {
  if (strategy === 'BUY' && entryStage === 'ACCEPT') return '신규진입 가능'
  if (strategy === 'BUY' && entryStage === 'CAUTION') return '눌림 대기'
  if (strategy === 'HOLD') return '보유 유지'
  if (strategy === 'WATCH_ONLY') return '관망'
  if (strategy === 'TAKE_PROFIT') return '분할익절'
  return '제외'
}

export function calculateExecutionPlan(input: ExecutionInput): ExecutionPlan {
  const maxPositionPct = calculateMaxPosition(input)
  const recommendedPositionPct = Math.min(
    calculateRecommendedPosition(input),
    maxPositionPct,
  )
  const riskAmountPct = Number(
    calculateRiskAmount(recommendedPositionPct, input.stopLossPct).toFixed(2),
  )
  const riskAmountWon =
    input.accountSize != null
      ? Math.round((input.accountSize * riskAmountPct) / 100)
      : undefined

  const action = getActionLabel(input.strategy, input.entryStage)
  const timeStop =
    input.marketStatus === 'Caution'
      ? '5D 타임스탑'
      : input.finalScore >= 85 && input.momentumScore >= 75
        ? '10D 타임스탑'
        : '7D 타임스탑'
  const stopRule = `손절 ${input.stopLossPct.toFixed(2)}% / Stop ${Math.round(input.stopPrice).toLocaleString('ko-KR')}원 이탈 시 정리`
  const takeProfitRule =
    input.rsi14 >= 80
      ? '추가매수 금지, +5~8% 구간에서도 일부 익절'
      : input.finalScore >= 85 && input.momentumScore >= 75 && input.supplyScore >= 70
        ? '+10% 30% 익절, 나머지는 +15%까지 홀드'
        : '+10%부터 30~50% 분할익절'
  const addBuyRule =
    input.entryStage === 'ACCEPT'
      ? '첫 진입 후 +2~3% 수익 확인 시 추가매수 가능'
      : input.entryStage === 'CAUTION'
        ? '20일선 또는 직전 지지선 근처 눌림에서만 추가매수'
        : '추가매수 금지'
  const reduceRule =
    input.marketStatus === 'Caution'
      ? '시장 약세 시 비중 30~50% 축소'
      : input.rsi14 >= 80
        ? '과열권 진입 시 절반 이상 익절'
        : input.riskRewardRatio < 1.5
          ? '손익비 부족으로 비중 축소'
          : '손절선 이탈 전까지 보유'

  const summary = `${action} · 권장 ${recommendedPositionPct}% (최대 ${maxPositionPct}%) · ${timeStop} · R/R ${input.riskRewardRatio.toFixed(2)}`

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
  }
}
