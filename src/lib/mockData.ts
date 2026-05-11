import {
  calculateConsensusScore,
  calculateConsensusUpside,
  calculateFinalScore,
  calculateRiskReward,
  calculateSectorFlowScore,
  calculateSupplyScore,
  calculateStopPrice,
  calculateTargetPrices,
  calculateThreeMonthStrategy,
  calculateValuationScore,
  formatKrwAmountToEok,
  getEntryStage,
  getFinalGrade,
  getStrategy,
  sectorFlowMainTitle,
  sectorFlowStatusFromScore,
  sectorFlowSubLines,
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
  TargetPriceInput,
  TargetStopInput,
  Timeframe,
  ThreeMonthStrategy,
  SectorFlowSnapshot,
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

export const foreignNetShares3D = -380_000
export const foreignNetAmount3D = -12_000_000_000
export const institutionNetShares3D = 280_000
export const institutionNetAmount3D = 8_000_000_000
export const retailNetShares3D = 95_000
export const retailNetAmount3D = 4_000_000_000
export const foreignNetAmount5D = -11_000_000_000
export const institutionNetAmount5D = 7_500_000_000
export const retailNetAmount5D = 3_500_000_000
export const supplyPeriod = '직전 3거래일 누적'
const supplyScore = calculateSupplyScore({
  foreignNetAmount3D,
  institutionNetAmount3D,
  retailNetAmount3D,
  foreignNetAmount5D,
  institutionNetAmount5D,
  retailNetAmount5D,
})

export const mockSectorName = '반도체'
export const sectorReturn5D = 6.2
export const marketReturn5D = 1.4
export const sectorRelativeReturn5D = Number((sectorReturn5D - marketReturn5D).toFixed(2))
export const sectorRankPercentile = 18
export const sectorFlowScoreCalc = calculateSectorFlowScore({
  sectorReturn5D,
  marketReturn5D,
  sectorRankPercentile,
  supplyScore,
})
export const sectorFlowStatus = sectorFlowStatusFromScore(sectorFlowScoreCalc)

export const mockSectorFlowSnapshot: SectorFlowSnapshot = {
  sectorName: mockSectorName,
  sectorReturn5D,
  marketReturn5D,
  sectorRelativeReturn5D,
  sectorRankPercentile,
  sectorFlowScore: sectorFlowScoreCalc,
  sectorFlowStatus,
}

const scoreInputs: ScoreInputs = {
  structure: 72,
  execution: 10,
  supply: supplyScore,
  sectorFlow: sectorFlowScoreCalc,
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
  atrPct: (2_930 / 79_800) * 100,
  supportPrice: 76_100,
  ma20: 77_600,
  recentLow20: 74_800,
  marketScore: 60,
  rsi14: 47,
  finalScore: score,
  executionScore: scoreInputs.execution,
  atrDistance: 2.8,
  riskRewardRatio: 1.7,
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
const targetPriceDemoInput: TargetPriceInput = {
  currentPrice: targetStopInput.currentPrice,
  atr14: targetStopInput.atr14 ?? Math.round(targetStopInput.currentPrice * 0.018),
  rsi14: targetStopInput.rsi14,
  finalScore: score,
  structureScore: scoreInputs.structure,
  executionScore: scoreInputs.execution,
  supplyScore: scoreInputs.supply,
  sectorFlowScore: scoreInputs.sectorFlow,
  valuationScore,
  consensusScore,
  momentumScore: scoreInputs.momentum,
  marketScore: 60,
  supportPrice: targetStopInput.supportPrice ?? Math.round(targetStopInput.currentPrice * 0.95),
  consensusAvgTargetPrice,
  consensusMaxTargetPrice,
  marketStatus: targetStopInput.marketStatus,
}
const targetPriceDemoResult = calculateTargetPrices(targetPriceDemoInput)
const rr = calculateRiskReward(
  targetStopInput.currentPrice,
  stopCalc.stopPrice,
  targetPriceDemoResult.targets.find((t) => t.label === '1M')?.targetPrice ??
    targetStopInput.currentPrice,
)
export const executionInput: ExecutionInput = {
  currentPrice: targetStopInput.currentPrice,
  finalScore: score,
  structureScore: scoreInputs.structure,
  executionScore: scoreInputs.execution,
  supplyScore: scoreInputs.supply,
  sectorFlowScore: scoreInputs.sectorFlow,
  valuationScore,
  consensusScore,
  momentumScore: scoreInputs.momentum,
  marketScore: 60,
  riskScore: 64,
  rsi14: targetStopInput.rsi14,
  atr14: targetStopInput.atr14 ?? Math.round(targetStopInput.currentPrice * 0.018),
  atrDistance: 2.8,
  consecutiveRiseDays: 2,
  stopPrice: stopCalc.stopPrice,
  stopLossPct: stopCalc.stopLossPct,
  riskRewardRatio: rr.ratio,
  marketStatus: targetStopInput.marketStatus,
  strategy: strategy as ExecutionInput['strategy'],
  entryStage: 'WATCH',
  accountSize: 50_000_000,
}

export const mockThreeMonthStrategy: ThreeMonthStrategy = calculateThreeMonthStrategy({
  currentPrice: targetStopInput.currentPrice,
  finalScore: score,
  executionScore: scoreInputs.execution,
  supplyScore: scoreInputs.supply,
  rsi14: targetStopInput.rsi14,
  atrDistance: 2.8,
  atr14: targetStopInput.atr14 ?? Math.round(targetStopInput.currentPrice * 0.018),
  strategy: strategy as ExecutionInput['strategy'],
  marketStatus: targetStopInput.marketStatus,
  marketScore: 60,
  riskRewardRatio: rr.ratio,
  supportPrice: targetStopInput.supportPrice ?? Math.round(targetStopInput.currentPrice * 0.95),
  consensusAvgTargetPrice: consensusAvgTargetPrice,
  consensusMaxTargetPrice: consensusMaxTargetPrice,
})

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
  {
    title: '섹터 자금흐름',
    value: sectorFlowMainTitle(mockSectorFlowSnapshot),
    subValue: sectorFlowSubLines(mockSectorFlowSnapshot),
    score: mockSectorFlowSnapshot.sectorFlowScore,
    statusBadge: mockSectorFlowSnapshot.sectorFlowStatus,
    descriptionKey: 'sectorFlow',
    icon: 'Landmark',
    tone: 'indigo',
  },
  { title: '구조 상태', value: '상승장 유지 / 눌림 구간', score: 72, descriptionKey: 'structure', icon: 'Map', tone: 'orange' },
  {
    title: '수급',
    value: `${formatKrwAmountToEok(foreignNetAmount3D + institutionNetAmount3D)}`,
    supplyDetails: {
      foreignNetShares3D,
      foreignNetAmount3D,
      institutionNetShares3D,
      institutionNetAmount3D,
      retailNetShares3D,
      retailNetAmount3D,
      foreignNetAmount5D,
      institutionNetAmount5D,
      retailNetAmount5D,
      supplyPeriod,
    },
    tooltipSummary: '수급은 당일 실시간이 아니라 직전 3거래일 누적으로 판단합니다.',
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
  { title: '진입 판단', value: mockThreeMonthStrategy.entryDecision },
  { title: '추천 비중', value: `${mockThreeMonthStrategy.recommendedPositionPct}%` },
  {
    title: '손절',
    value: `${mockThreeMonthStrategy.stopPrice.toLocaleString('ko-KR')}원 (${mockThreeMonthStrategy.stopLossPct}%)`,
    hint: mockThreeMonthStrategy.stopReason,
  },
  {
    title: '1차 익절',
    value: `${mockThreeMonthStrategy.firstTakeProfitPrice.toLocaleString('ko-KR')}원 (+${mockThreeMonthStrategy.firstTakeProfitPct}%)`,
    hint: `${mockThreeMonthStrategy.firstTakeProfitSellPct}% 매도`,
  },
  {
    title: '최종 목표',
    value: `${mockThreeMonthStrategy.finalTargetPrice.toLocaleString('ko-KR')}원 (+${mockThreeMonthStrategy.finalTargetPct}%)`,
    hint: mockThreeMonthStrategy.consensusNote
      ? `${mockThreeMonthStrategy.maxHoldingPeriod} · ${mockThreeMonthStrategy.consensusNote}`
      : mockThreeMonthStrategy.maxHoldingPeriod,
  },
  { title: '타임스탑', value: mockThreeMonthStrategy.timeStopRule.replace(/\n/g, ' · ') },
  { title: '추가매수', value: mockThreeMonthStrategy.addBuyRule },
  { title: '요약', value: mockThreeMonthStrategy.summary },
]

export const stopInfo: StopInfo = {
  stopPrice: stopCalc.stopPrice,
  stopLossPct: stopCalc.stopLossPct,
  method: stopCalc.method,
  reason: stopCalc.reason,
  candidates: stopCalc.candidates,
  warning: stopCalc.warning,
}

export const saveStatus = '투자주의: 본 분석은 참고용이며 최종 투자 판단과 책임은 투자자 본인에게 있습니다.'
