import {
  calculateConsensusScore,
  calculateConsensusUpside,
  calculateFinalScore,
  calculateSectorFlowScore,
  calculateSupplyScore,
  calculateThreeMonthStrategy,
  calculateValuationScore,
  computeStrategyRiskRewardMetrics,
  calculateStopPrice,
  calculateTargetPrices,
  getEntryStageCode,
  getStrategy,
  resolveFirstTakeProfitSellPct,
  sectorFlowMainTitle,
  sectorFlowStatusFromScore,
  sectorFlowSubLines,
  summarizeExecutionUi,
} from './signalLogic'
import type { Strategy } from '../types/stock'
import { buildValuationCardModel } from './valuationCard'
import {
  buildConsensusDrawerBody,
} from './consensusPresentation'
import { marketCardAccentFromHeadline, marketPrimaryKorean } from './marketCardPresentation'
import {
  buildSupplyDrawerBody,
  supplyCardAccentFromFiSum,
} from './supplyFlowTone'
import {
  parseAtrDistanceValue,
  resolveAtrDistanceRiskVisual,
  resolveIndicatorRiskVisual,
  resolveStatsRiskVisual,
} from './metricRiskVisual'
import {
  atrMaGapInterpretSub,
  candleQualityInterpretSub,
  consecutiveRiseInterpretSub,
  executionInterpretSub,
  indicatorRsiMfiInterpretSub,
  sectorFiveDayVsMarketSub,
  statisticsAvg20InterpretSub,
  structureInterpretSub,
  structureStateInterpretSub,
  valuationPremiumInterpretSub,
} from './indicatorInterpretSubs'
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
export const foreignNetAmount3D = -4_800_000_000_000
export const institutionNetShares3D = 280_000
export const institutionNetAmount3D = 743_200_000_000
export const retailNetShares3D = 95_000
export const retailNetAmount3D = 4_000_000_000
export const foreignNetAmount5D = -4_900_000_000_000
export const institutionNetAmount5D = 720_000_000_000
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
const strategy = getStrategy(score, 47, scoreInputs.execution) as Strategy
const entryStageCode = getEntryStageCode(strategy, score, scoreInputs.execution)
const executionUi = summarizeExecutionUi(strategy, entryStageCode)
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
  marketStatus: 'Neutral',
}
export const consensusAvgTargetPrice = 91_000
export const consensusMaxTargetPrice = 105_000
export const consensusMinTargetPrice = 84_000
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
const mockConsensusDispersionWidthPct =
  consensusAvgTargetPrice > 0
    ? ((consensusMaxTargetPrice - consensusMinTargetPrice) / consensusAvgTargetPrice) * 100
    : 0
const mockConsensusHighSkewPct =
  consensusAvgTargetPrice > 0
    ? ((consensusMaxTargetPrice - consensusAvgTargetPrice) / consensusAvgTargetPrice) * 100
    : 0
const mockConsensusLowSkewPct =
  consensusAvgTargetPrice > 0
    ? ((consensusAvgTargetPrice - consensusMinTargetPrice) / consensusAvgTargetPrice) * 100
    : 0
export const consensusUpsideAvgPct = consensusUpside.avgUpsidePct
export const consensusUpsideMaxPct = consensusUpside.maxUpsidePct

const mockValuationCardModel = buildValuationCardModel({
  trailingPER,
  price: targetStopInput.currentPrice,
  eps: targetStopInput.currentPrice / trailingPER,
  pbr: 1.35,
  sectorName: '반도체',
  consensusAvgUpsidePct: consensusUpside.avgUpsidePct,
  fetchedAt: new Date(Date.now() - 12 * 86_400_000).toISOString(),
})!
const consensusScore = calculateConsensusScore({
  currentPrice: targetStopInput.currentPrice,
  avgTargetPrice: consensusAvgTargetPrice,
  maxTargetPrice: consensusMaxTargetPrice,
  analystCount,
  lastConsensusUpdateDays: lastConsensusUpdate,
})
const valuationScore = calculateValuationScore(mockValuationCardModel.valuationInputs)
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
  stopPrice: stopCalc.stopPrice,
}
const targetPriceDemoResult = calculateTargetPrices(targetPriceDemoInput)
const demoT1m = targetPriceDemoResult.targets.find((t) => t.label === '1M')
const demoT3m = targetPriceDemoResult.targets.find((t) => t.label === '3M')
const rrDemo = computeStrategyRiskRewardMetrics({
  stopLossPct: stopCalc.stopLossPct,
  firstTakeProfitPct: 9,
  firstTakeProfitSellPct: resolveFirstTakeProfitSellPct(
    targetStopInput.rsi14,
    score,
    scoreInputs.supply,
  ),
  finalTargetPct: 15,
  prob1M: demoT1m?.probability ?? 0,
  prob3M: demoT3m?.probability ?? 0,
})
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
  riskRewardRatio: rrDemo.weightedRatio,
  marketStatus: targetStopInput.marketStatus,
  strategy: strategy as ExecutionInput['strategy'],
  entryStage: 'WATCH',
  accountSize: 50_000_000,
}

export const mockThreeMonthStrategy: ThreeMonthStrategy = calculateThreeMonthStrategy({
  currentPrice: targetStopInput.currentPrice,
  structureScore: scoreInputs.structure,
  finalScore: score,
  executionScore: scoreInputs.execution,
  supplyScore: scoreInputs.supply,
  rsi14: targetStopInput.rsi14,
  atrDistance: 2.8,
  atr14: targetStopInput.atr14 ?? Math.round(targetStopInput.currentPrice * 0.018),
  strategy: strategy as ExecutionInput['strategy'],
  marketStatus: targetStopInput.marketStatus,
  marketScore: 60,
  riskRewardRatio: rrDemo.weightedRatio,
  supportPrice: targetStopInput.supportPrice ?? Math.round(targetStopInput.currentPrice * 0.95),
  consensusAvgTargetPrice: consensusAvgTargetPrice,
  consensusMaxTargetPrice: consensusMaxTargetPrice,
  sectorName: '반도체',
  operatingMarginTtmPct: 20,
  forwardPer: forwardPER,
  fiveYearAvgPer: sectorAveragePER,
  epsGrowthYoYPct: forwardEPSGrowthPct,
  trailingPer: trailingPER,
})

export const stockInfo: StockInfo = {
  name: '삼성전자',
  code: '005930',
  market: 'KOSPI',
  sector: '반도체',
  price: 79_800,
  change: 700,
  changePercent: 0.88,
  investmentBadge: executionUi.strategyLabelKo,
  asOfDate: '2025.05.31 기준',
}

export const summaryInfo: SummaryInfo = {
  title: '지금은 보유가 더 좋은 구간',
  description: '일부 점수는 유지되나 신규 진입 근거는 아직 부족',
  strategy,
  entryStageCode,
  executionUi,
  reason: '일부 점수는 유지되나 진입 근거 부족',
}

export const chartByTimeframe: Record<Timeframe, ChartPoint[]> = {
  '1D': [
    { label: '09:05', value: 79_150 },
    { label: '10:00', value: 79_280 },
    { label: '11:00', value: 79_100 },
    { label: '12:00', value: 79_260 },
    { label: '13:00', value: 79_380 },
    { label: '14:00', value: 79_600 },
    { label: '15:30', value: 79_800 },
  ],
  '5D': [
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

const mockMarketHeadline = '박스권 (Sideways)'
const mockMarketDetail = `KOSPI 20일 추세 +0.4%, 횡보 (KOSPI200 ETF 일봉)
현재가 대비 20MA +0.2% · 60MA n/a
외국인 누적(ETF 069500 프록시) 5일 +120.0억 · 20일 +85.0억`

const mockConsensusDrawerSource = {
  maxTargetPrice: consensusMaxTargetPrice,
  minTargetPrice: consensusMinTargetPrice,
  consensusAvgTrend12wPct: 22,
  dispersionWidthPct: mockConsensusDispersionWidthPct,
  dispersionHighSkewPct: mockConsensusHighSkewPct,
  dispersionLowSkewPct: mockConsensusLowSkewPct,
  dispersionLabelKo: mockConsensusDispersionWidthPct <= 20 ? '컨센서스 수렴' : '컨센서스 분포 보통',
  revision7dUp: 4,
  revision7dDown: 0,
  consensusTrendNote: null as string | null,
}

const mockSupplyFiSum = foreignNetAmount3D + institutionNetAmount3D
const mockSupplyRiskStrip: LogicMetric['riskStrip'] =
  mockSupplyFiSum < -5000 * 100_000_000
    ? 'orange'
    : mockSupplyFiSum < -2000 * 100_000_000
      ? 'warning'
      : 'neutral'

const mockConsensusGapPct = Math.round(
  ((targetStopInput.currentPrice - consensusMaxTargetPrice) / consensusMaxTargetPrice) * 100,
)
const mockConsensusSubEm: LogicMetric['subValueEmphasis'] =
  targetStopInput.currentPrice >= consensusMaxTargetPrice ? 'danger' : 'muted'

const mockSupplyTooltipOverride: LogicMetric['indicatorTooltipOverride'] = {
  title: '수급 (3D)',
  description:
    '직전 3거래일 외국인·기관 누적 순매수입니다. 외국인 매도 + 기관 매수가 동시에 클수록 매물 출회 위험이 있습니다.',
  thresholds: '개인·5거래일 누적은 카드를 눌러 drawer에서 확인할 수 있습니다.',
}

const mockConsensusTooltipOverride: LogicMetric['indicatorTooltipOverride'] = {
  title: '컨센서스',
  description:
    '증권사 애널리스트 평균 목표가와 최고 목표가입니다. 현재 투자의견 평균 4.04 (5점 만점, 4 이상 매수). 컨센서스는 후행 지표이므로 변화 추세를 함께 보세요.',
  thresholds:
    '4주 평균 목표가 변화·증권사 분산·최고·최저 갭은 카드를 눌러 drawer에서 확인할 수 있습니다.',
}

export const logicMetrics: LogicMetric[] = [
  {
    title: '구조',
    value: '99점',
    subValue: structureInterpretSub(99),
    detailForDrawer: '99 / 100',
    score: 99,
    descriptionKey: 'structure',
    icon: 'Layers',
    tone: 'blue',
  },
  {
    title: '실행',
    value: '62점',
    subValue: executionInterpretSub(62),
    detailForDrawer: '62 / 100',
    score: 62,
    descriptionKey: 'execution',
    icon: 'Zap',
    tone: 'violet',
  },
  {
    title: 'ATR 이격',
    value: '7.3',
    subValue: atrMaGapInterpretSub(7.3),
    detailForDrawer: '7.3 ATR',
    ...resolveAtrDistanceRiskVisual(parseAtrDistanceValue('7.3 ATR')),
    score: 56,
    descriptionKey: 'atrDistance',
    icon: 'Ruler',
    tone: 'amber',
  },
  {
    title: '연속상승',
    value: '2일',
    subValue: consecutiveRiseInterpretSub('2일'),
    detailForDrawer: '연속상승 2일',
    score: 64,
    descriptionKey: 'consecutiveRise',
    icon: 'TrendingUp',
    tone: 'sky',
  },
  {
    title: '시장',
    value: marketPrimaryKorean(mockMarketHeadline),
    subValue: mockMarketDetail.split('\n')[0]?.trim() ?? 'KOSPI 20일 추세',
    detailForDrawer: mockMarketDetail,
    cardAccent: marketCardAccentFromHeadline(mockMarketHeadline),
    score: 60,
    descriptionKey: 'market',
    icon: 'Globe2',
    tone: 'emerald',
  },
  {
    title: '섹터 자금흐름',
    value: sectorFlowMainTitle(mockSectorFlowSnapshot),
    subValue: sectorFiveDayVsMarketSub(mockSectorFlowSnapshot),
    detailForDrawer: [`상태: ${mockSectorFlowSnapshot.sectorFlowStatus}`, sectorFlowSubLines(mockSectorFlowSnapshot)].join(
      '\n\n',
    ),
    cardAccent:
      mockSectorFlowSnapshot.sectorFlowStatus === '주도섹터' ||
      mockSectorFlowSnapshot.sectorFlowStatus === '관심섹터'
        ? 'info'
        : mockSectorFlowSnapshot.sectorFlowStatus === '중립'
          ? 'neutral'
          : 'warning',
    statusBadge: mockSectorFlowSnapshot.sectorFlowStatus === '관심섹터' ? '관심' : undefined,
    score: mockSectorFlowSnapshot.sectorFlowScore,
    descriptionKey: 'sectorFlow',
    icon: 'Landmark',
    tone: 'indigo',
  },
  {
    title: '구조 상태',
    value: '상승장 / 과열',
    subValue: structureStateInterpretSub('상승장 / 과열'),
    detailForDrawer: '상승장 유지 / 눌림 구간',
    score: 72,
    descriptionKey: 'structureState',
    icon: 'Map',
    tone: 'orange',
  },
  {
    title: '수급 (3D)',
    value: '\u00a0',
    supplyForeignWon: foreignNetAmount3D,
    supplyInstitutionWon: institutionNetAmount3D,
    detailForDrawer: buildSupplyDrawerBody({
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
    }),
    cardAccent: supplyCardAccentFromFiSum(mockSupplyFiSum),
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
    score: supplyScore,
    riskStrip: mockSupplyRiskStrip,
    indicatorTooltipOverride: mockSupplyTooltipOverride,
    descriptionKey: 'supply',
    icon: 'Users',
    tone: 'cyan',
  },
  {
    title: '컨센서스',
    value: '\u00a0',
    consensusAvgWon: consensusAvgTargetPrice,
    consensusMaxWon: consensusMaxTargetPrice,
    consensusSpotWon: targetStopInput.currentPrice,
    consensusRecommendationScore: 4.04,
    subValue: `최고 대비 ${mockConsensusGapPct >= 0 ? '+' : ''}${mockConsensusGapPct}%`,
    subValueEmphasis: mockConsensusSubEm,
    detailForDrawer: buildConsensusDrawerBody({
      consensus: mockConsensusDrawerSource,
      consensusUpside,
    }),
    indicatorTooltipOverride: mockConsensusTooltipOverride,
    score: consensusScore,
    riskStrip: 'neutral',
    descriptionKey: 'consensus',
    icon: 'SlidersHorizontal',
    tone: 'teal',
  },
  {
    title: '캔들질',
    value: 'CLV5 +1.27 · CLV10 -0.45',
    subValue: candleQualityInterpretSub('CLV5 +1.27 · CLV10 -0.45'),
    detailForDrawer: 'CLV5 +1.27 · CLV10 -0.45',
    score: 50,
    descriptionKey: 'candleQuality',
    icon: 'CandlestickChart',
    tone: 'rose',
  },
  {
    title: '밸류에이션',
    value: `PER ${mockValuationCardModel.valuationInputs.trailingPER.toFixed(1)}x`,
    subValue: valuationPremiumInterpretSub({
      trailingPER: mockValuationCardModel.valuationInputs.trailingPER,
      sectorName: '반도체',
    }),
    detailForDrawer: [mockValuationCardModel.value, mockValuationCardModel.subValue, mockValuationCardModel.meta]
      .filter(Boolean)
      .join('\n\n'),
    riskStrip: mockValuationCardModel.riskStrip,
    score: valuationScore,
    descriptionKey: 'valuation',
    icon: 'Droplets',
    tone: 'slate',
  },
  {
    title: '지표',
    value: 'RSI 84',
    subValue: indicatorRsiMfiInterpretSub({ indicatorLine: 'RSI 84 / MFI 86', rsiNumeric: 84 }),
    detailForDrawer: 'RSI 84 / MFI 86',
    ...resolveIndicatorRiskVisual('RSI 84 / MFI 86'),
    score: 57,
    descriptionKey: 'indicators',
    icon: 'Activity',
    tone: 'blue',
  },
  {
    title: '실적발표일',
    value: 'D-12 (5/24)',
    subValue: '직전 +12.4% 서프라이즈',
    detailForDrawer: [
      '로직 API 미연결 시 데모 표시입니다.',
      '',
      '【다음 분기 컨센서스 (참고)】',
      '매출·영업이익·EPS는 FnGuide 연동 시 자동 표기됩니다.',
      '',
      '【직전 4분기 서프라이즈】',
      '-2.1% → +5.4% → +3.0% → +8.2%',
    ].join('\n'),
    sparkline: [-2.1, 5.4, 3.0, 8.2],
    valueEmphasis: 'muted',
    subValueEmphasis: 'default',
    riskStrip: 'neutral',
    score: 60,
    descriptionKey: 'earnings',
    icon: 'CalendarDays',
    tone: 'red',
  },
  {
    title: '통계',
    value: '+25.23%',
    subValue: statisticsAvg20InterpretSub('20일 평균 76,800원 대비 +26.20%'),
    detailForDrawer: '20일 평균 76,800원 대비 +26.20%',
    ...resolveStatsRiskVisual('20일 평균 76,800원 대비 +26.20%'),
    score: 54,
    descriptionKey: 'statistics',
    icon: 'Percent',
    tone: 'slate',
  },
  {
    title: 'ROE',
    value: '18.4%',
    subValue: '▲ 4분기 상승 추세 · 섹터 12.0%',
    detailForDrawer: 'EPS/BPS 근사 ROE · 공시 대조 권장',
    descriptionKey: 'roe',
    icon: 'TrendingUp',
    tone: 'emerald',
    riskStrip: 'neutral',
  },
  {
    title: 'EPS 성장률',
    value: `YoY +${forwardEPSGrowthPct.toFixed(1)}%`,
    subValue: `QoQ +${(forwardEPSGrowthPct * 0.28).toFixed(1)}% · 컨센서스 +${consensusUpsideAvgPct.toFixed(1)}% · 성장 가속`,
    detailForDrawer: '밸류 카드 forward EPS 성장 근사',
    descriptionKey: 'epsGrowth',
    icon: 'BarChart3',
    tone: 'violet',
    riskStrip: 'neutral',
  },
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
  basis:
    stopCalc.method === 'RECENT_LOW'
      ? 'LOW20'
      : stopCalc.method === 'ATR'
        ? 'ATR'
        : 'FIXED',
  reason: stopCalc.reason,
  candidates: stopCalc.candidates,
  warning: stopCalc.warning,
}

export const saveStatus = '투자주의: 본 분석은 참고용이며 최종 투자 판단과 책임은 투자자 본인에게 있습니다.'
