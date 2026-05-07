import {
  calculateConsensusScore,
  calculateConsensusUpside,
  calculateFinalScore,
  calculateExecutionPlan,
  calculateRiskReward,
  calculateSupplyScore,
  calculateStopPrice,
  calculateTargetPrices,
  calculateValuationScore,
  formatKrwAmountToEok,
  getEntryStage,
  getFinalGrade,
  getStrategy,
} from './signalLogic'
import type {
  ChartPoint,
  ExecutionCard,
  LogicMetric,
  ScoreInputs,
  StockInfo,
  StopInfo,
  SummaryInfo,
  ExecutionInput,
  TargetStopInput,
  TargetPrice,
  Timeframe,
} from '../types/stock'

export const intradayTrend: 'up' | 'down' | 'sideways' = 'up'

function buildIntradayLabels() {
  const labels: string[] = []
  let minutes = 9 * 60
  const end = 15 * 60 + 30
  while (minutes <= end) {
    const hh = String(Math.floor(minutes / 60)).padStart(2, '0')
    const mm = String(minutes % 60).padStart(2, '0')
    labels.push(`${hh}:${mm}`)
    minutes += 15
  }
  return labels
}

export function generateIntradaySeries(params: {
  currentPrice: number
  trend?: 'up' | 'down' | 'sideways'
  points?: number
  seed?: number
}) {
  const { currentPrice, trend = 'sideways', seed = 7 } = params
  const labels = buildIntradayLabels()
  const total = Math.max(24, Math.min(48, params.points ?? labels.length))
  const step = (labels.length - 1) / (total - 1)
  const sampledLabels = Array.from({ length: total }, (_, i) => labels[Math.round(i * step)])

  const seed01 = ((seed * 9301 + 49297) % 233280) / 233280
  const ampPct = 0.003 + seed01 * 0.009 // +/-0.3% ~ +/-1.2%
  const anchorDelta =
    trend === 'up'
      ? -ampPct * 0.45
      : trend === 'down'
        ? ampPct * 0.45
        : (seed01 - 0.5) * ampPct * 0.25
  const open = currentPrice * (1 + anchorDelta)

  const raw: number[] = sampledLabels.map((_, i) => {
    const t = i / (total - 1)
    const drift = open + (currentPrice - open) * t
    const wave =
      trend === 'up'
        ? (-0.32 + 0.78 * t + 0.12 * Math.sin(Math.PI * 2.2 * t))
        : trend === 'down'
          ? (0.32 - 0.78 * t + 0.12 * Math.sin(Math.PI * 2.1 * t + 0.8))
          : (0.16 * Math.sin(Math.PI * 3.4 * t) + 0.05 * Math.cos(Math.PI * 5.4 * t))
    const noise = Math.sin((i + 1 + seed) * 1.73) * currentPrice * 0.00018
    return drift + wave * currentPrice * ampPct + noise
  })

  // midpoint regression: soften spikes without flattening trend
  const smooth = raw.slice()
  for (let r = 0; r < 2; r += 1) {
    for (let i = 1; i < smooth.length - 1; i += 1) {
      const mid = (smooth[i - 1] + smooth[i] + smooth[i + 1]) / 3
      smooth[i] = smooth[i] * 0.65 + mid * 0.35
    }
  }

  smooth[0] = Math.round(open)
  smooth[smooth.length - 1] = Math.round(currentPrice)
  if (smooth[0] === smooth[smooth.length - 1]) {
    smooth[0] = Math.round(currentPrice * (trend === 'down' ? 1.002 : 0.998))
  }

  return sampledLabels.map((label, i) => ({
    label,
    value: Math.round(smooth[i]),
  })) as ChartPoint[]
}

export const foreignNetShares = -245_000
export const foreignNetAmount = -19_600_000_000
export const institutionNetShares = 132_000
export const institutionNetAmount = 10_500_000_000
export const retailNetShares = 113_000
export const retailNetAmount = 9_100_000_000
export const supplyPeriod = '금일 실시간'
const supplyScore = calculateSupplyScore({
  foreignNetAmount,
  institutionNetAmount,
  retailNetAmount,
  volumeTrendScore: 62,
})

const scoreInputs: ScoreInputs = {
  structure: 72,
  execution: 10,
  supply: supplyScore,
  rotation: 58,
  consensus: 70,
  valuation: 74,
  momentum: 45,
  market: 52,
  news: 58,
}

const score = calculateFinalScore(scoreInputs)
const grade = getFinalGrade(score)
const strategy = getStrategy(score, 47, scoreInputs.execution)
const entryStage = getEntryStage(score, strategy)
export const targetStopInput: TargetStopInput = {
  currentPrice: 79_800,
  atr14: 2_930,
  rsi14: 47,
  finalScore: score,
  structureScore: scoreInputs.structure,
  executionScore: scoreInputs.execution,
  supportPrice: 76_100,
  resistancePrice: 81_200,
  recentHigh20: 81_500,
  recentLow20: 74_800,
  marketStatus: 'Neutral',
}
export const consensusAvgTargetPrice = 91_000
export const consensusMaxTargetPrice = 105_000
export const analystCount = 12
export const lastConsensusUpdate = 12
export const trailingPER = 24.8
export const forwardPER = 17.2
export const forwardEPSGrowthPct = 38
export const sectorAveragePER = 19.5
export const historicalPERPercentile = 72
export const valuationUpdatedAt = '12일 전'
const consensusUpside = calculateConsensusUpside(
  targetStopInput.currentPrice,
  consensusAvgTargetPrice,
  consensusMaxTargetPrice,
)
export const consensusUpsideAvgPct = consensusUpside.avgUpsidePct
export const consensusUpsideMaxPct = consensusUpside.maxUpsidePct
const consensusScore = calculateConsensusScore({
  currentPrice: targetStopInput.currentPrice,
  avgTargetPrice: consensusAvgTargetPrice,
  maxTargetPrice: consensusMaxTargetPrice,
  analystCount,
  lastConsensusUpdateDays: lastConsensusUpdate,
})
const valuationScore = calculateValuationScore({
  trailingPER,
  forwardPER,
  forwardEPSGrowthPct,
  sectorAveragePER,
  historicalPERPercentile,
})
const stopCalc = calculateStopPrice(targetStopInput)
const targetsCalc = calculateTargetPrices(targetStopInput)
const rr = calculateRiskReward(
  targetStopInput.currentPrice,
  stopCalc.stopPrice,
  targetsCalc.find((t) => t.horizon === '1M')?.targetPrice ?? targetStopInput.currentPrice,
)
export const executionInput: ExecutionInput = {
  currentPrice: targetStopInput.currentPrice,
  finalScore: score,
  structureScore: scoreInputs.structure,
  executionScore: scoreInputs.execution,
  supplyScore: scoreInputs.supply,
  momentumScore: scoreInputs.momentum,
  riskScore: 64,
  rsi14: targetStopInput.rsi14,
  atr14: targetStopInput.atr14,
  stopPrice: stopCalc.stopPrice,
  stopLossPct: stopCalc.stopLossPct,
  riskRewardRatio: rr.ratio,
  marketStatus: targetStopInput.marketStatus,
  strategy: strategy as ExecutionInput['strategy'],
  entryStage: 'WATCH',
  accountSize: 50_000_000,
}
const executionPlan = calculateExecutionPlan(executionInput)

export const stockInfo: StockInfo = {
  name: '삼성전자',
  code: '005930',
  market: 'KOSPI',
  sector: '반도체',
  price: 79_800,
  change: 700,
  changePercent: 0.88,
  investmentBadge: 'HOLD',
  asOfDate: '2025.05.31 기준',
}

export const summaryInfo: SummaryInfo = {
  title: '지금은 보유가 더 좋은 구간',
  description: '일부 점수는 유지되나 신규 진입 근거는 아직 부족',
  finalGrade: grade,
  strategy: 'HOLD',
  entryStage,
  reason: '일부 점수는 유지되나 진입 근거 부족',
}

export const chartByTimeframe: Record<Timeframe, ChartPoint[]> = {
  '3D': [
    { label: '09:00', value: 79_150 },
    { label: '10:00', value: 79_280 },
    { label: '11:00', value: 79_100 },
    { label: '12:00', value: 79_260 },
    { label: '13:00', value: 79_380 },
    { label: '14:00', value: 79_600 },
    { label: '15:00', value: 79_800 },
  ],
  '1W': [
    { label: '월', value: 78_300 },
    { label: '화', value: 78_900 },
    { label: '수', value: 79_200 },
    { label: '목', value: 79_000 },
    { label: '금', value: 79_800 },
  ],
  '1M': [
    { label: '1주', value: 76_800 },
    { label: '2주', value: 77_900 },
    { label: '3주', value: 78_600 },
    { label: '4주', value: 79_800 },
  ],
  '3M': [
    { label: '3월', value: 73_500 },
    { label: '4월', value: 75_600 },
    { label: '5월', value: 79_800 },
  ],
  '1Y': [
    { label: '6월', value: 70_200 },
    { label: '8월', value: 71_400 },
    { label: '10월', value: 74_300 },
    { label: '12월', value: 72_800 },
    { label: '2월', value: 75_900 },
    { label: '4월', value: 77_600 },
    { label: '5월', value: 79_800 },
  ],
}

export const logicMetrics: LogicMetric[] = [
  { title: '구조', value: '72 / 100', score: 72, descriptionKey: 'structure', icon: 'Layers', tone: 'blue' },
  { title: '실행', value: '10 / 100', score: 10, descriptionKey: 'execution', icon: 'Zap', tone: 'violet' },
  { title: 'ATR 이격', value: '2.8 ATR', score: 56, descriptionKey: 'atrDistance', icon: 'Ruler', tone: 'amber' },
  { title: '연속상승', value: '2일', score: 64, descriptionKey: 'consecutiveRise', icon: 'TrendingUp', tone: 'sky' },
  { title: '시장', value: 'Caution, KOSPI 2,640', score: 52, descriptionKey: 'market', icon: 'Globe2', tone: 'emerald' },
  { title: '로테이션', value: 'Neutral', score: scoreInputs.rotation, descriptionKey: 'rotation', icon: 'RefreshCw', tone: 'indigo' },
  { title: '구조 상태', value: '상승장 유지 / 눌림 구간', score: 72, descriptionKey: 'structure', icon: 'Map', tone: 'orange' },
  {
    title: '수급',
    value: `${formatKrwAmountToEok(foreignNetAmount + institutionNetAmount)}`,
    supplyDetails: {
      foreignNetShares,
      foreignNetAmount,
      institutionNetShares,
      institutionNetAmount,
      retailNetShares,
      retailNetAmount,
      supplyPeriod,
    },
    score: supplyScore,
    descriptionKey: 'supply',
    icon: 'Users',
    tone: 'cyan',
  },
  {
    title: '컨센서스',
    value: `평균 ${consensusAvgTargetPrice.toLocaleString('ko-KR')}원`,
    subValue: `최고 ${consensusMaxTargetPrice.toLocaleString('ko-KR')}원 · 평균 ${consensusUpside.avgUpsidePct >= 0 ? '+' : ''}${consensusUpside.avgUpsidePct.toFixed(1)}% / 최고 ${consensusUpside.maxUpsidePct >= 0 ? '+' : ''}${consensusUpside.maxUpsidePct.toFixed(1)}%`,
    meta: `애널리스트 ${analystCount}명 · 업데이트 ${lastConsensusUpdate}일 전`,
    score: consensusScore,
    descriptionKey: 'consensus',
    icon: 'SlidersHorizontal',
    tone: 'teal',
  },
  { title: '캔들질', value: 'CLV5 -0.12 / CLV10 -0.25', score: 50, descriptionKey: 'candleQuality', icon: 'CandlestickChart', tone: 'rose' },
  {
    title: '밸류에이션',
    value: `Trailing PER ${trailingPER.toFixed(1)}x`,
    subValue: `Forward PER ${forwardPER.toFixed(1)}x · Forward EPS Growth +${forwardEPSGrowthPct}%`,
    meta: `섹터 평균 ${sectorAveragePER.toFixed(1)}x · 역사적 PER 상위 ${historicalPERPercentile}% · ${valuationUpdatedAt}`,
    score: valuationScore,
    descriptionKey: 'valuation',
    icon: 'Droplets',
    tone: 'slate',
  },
  { title: '지표', value: 'RSI 47 / MFI 46', score: 57, descriptionKey: 'indicators', icon: 'Activity', tone: 'blue' },
  { title: '특이', value: '특이사항 없음', score: 60, descriptionKey: 'special', icon: 'CircleAlert', tone: 'red' },
  { title: '통계', value: '유사패턴 승률 54.3% / 참조수익률 +1.8% / N=67', score: 54, descriptionKey: 'statistics', icon: 'Percent', tone: 'slate' },
]

export const executionCards: ExecutionCard[] = [
  { title: '추천 비중', value: `${executionPlan.recommendedPositionPct}%` },
  {
    title: '1R 손실금',
    value: `${stopCalc.stopLossPct.toFixed(2)}%, ${Math.round(stopCalc.stopPrice - targetStopInput.currentPrice).toLocaleString('ko-KR')}원`,
    hint: executionPlan.riskAmountWon
      ? `계좌 리스크 ${executionPlan.riskAmountPct}% · ${executionPlan.riskAmountWon.toLocaleString('ko-KR')}원`
      : `계좌 리스크 ${executionPlan.riskAmountPct}%`,
  },
  { title: '기본 실행', value: `${executionPlan.timeStop} / ${executionPlan.stopRule} / ${executionPlan.takeProfitRule}` },
  { title: '최대 비중', value: `${executionPlan.maxPositionPct}% · R/R ${rr.ratio} (${rr.verdict})` },
]

export const targets: TargetPrice[] = targetsCalc

export const stopInfo: StopInfo = {
  stopPrice: stopCalc.stopPrice,
  stopLossPct: stopCalc.stopLossPct,
  method: stopCalc.method,
  supportPrice: stopCalc.supportPrice,
}

export const saveStatus = "Analysis saved to 'trade_log_20250531.csv'"
