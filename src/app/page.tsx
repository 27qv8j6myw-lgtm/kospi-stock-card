import { useEffect, useMemo, useState } from 'react'
import type { DetailedBriefingInput, DetailedInvestmentMemoResult } from '../types/aiBriefing'
import { Info, TrendingUp } from 'lucide-react'
import { AIBriefingPanel } from '../components/AIBriefingPanel'
import { ExecutionStrategy } from '../components/ExecutionStrategy'
import { MainStockCard } from '../components/MainStockCard'
import { MetricGrid } from '../components/MetricGrid'
import { PriceChart } from '../components/PriceChart'
import { StockNameSearch } from '../components/StockNameSearch'
import { StockHeader } from '../components/StockHeader'
import { StopPanel } from '../components/StopPanel'
import { SummaryPanel } from '../components/SummaryPanel'
import { TargetPricePanel } from '../components/TargetPricePanel'
import { SectorScreenerTab } from '../components/SectorScreenerTab'
import { useKisChart } from '../hooks/useKisChart'
import { useKisLogicIndicators } from '../hooks/useKisLogicIndicators'
import { useKisQuote } from '../hooks/useKisQuote'
import {
  logicMetrics,
  mockSectorFlowSnapshot,
  saveStatus,
  stockInfo,
  stopInfo as mockStopInfo,
} from '../lib/mockData'
import {
  calculateConsensusScore,
  calculateConsensusUpside,
  calculateRiskReward,
  calculateSupplyScore,
  calculateThreeMonthStrategy,
  calculateValuationScore,
  formatKrwAmountToEok,
  calculateFinalScore,
  calculateStopPrice,
  calculateTargetPrices,
  getEntryStage,
  getEntryStageCode,
  getFinalGrade,
  getStrategy,
  parseAtrDistance,
  parseConsecutiveRiseDays,
  inferSectorFlowSnapshot,
  parseMomentumScoreFromLogic,
  sectorFlowMainTitle,
  sectorFlowSubLines,
} from '../lib/signalLogic'
import { buildInvestmentMemoPrompt, generateDetailedInvestmentMemo } from '../lib/aiBriefing'
import { getMockNewsByStockCode } from '../lib/mockNews'
import { fetchAiBriefing } from '../lib/aiBriefingApi'
import { sortNewsByDateDesc } from '../lib/newsAnalyzer'
import { generateMetricSummary } from '../lib/summaryLogic'
import type {
  LogicMetric,
  Strategy,
  TargetPriceInput,
  ThreeMonthStrategyInput,
  Timeframe,
} from '../types/stock'
import type { TargetStopInput } from '../types/stock'

export default function Page() {
  const [activeMainTab, setActiveMainTab] = useState<'analysis' | 'screener'>('analysis')
  const [queryCode, setQueryCode] = useState(stockInfo.code)
  const [searchDisplay, setSearchDisplay] = useState(`${stockInfo.name} (${stockInfo.code})`)
  const [pickedName, setPickedName] = useState<string | null>(null)
  const [tf, setTf] = useState<Timeframe>('3D')

  useEffect(() => {
    const m = searchDisplay.match(/(?<!\d)(\d{6})(?!\d)/)
    if (!m) return
    const next = m[1]
    if (next === queryCode) return
    const t = setTimeout(() => {
      setQueryCode(next)
      setPickedName(null)
    }, 250)
    return () => clearTimeout(t)
  }, [searchDisplay, queryCode])

  const { state: quoteState } = useKisQuote(queryCode)
  const chartState = useKisChart(queryCode, tf)
  const { state: logicState } = useKisLogicIndicators(queryCode)

  const liveStock = useMemo(() => {
    if (quoteState.status !== 'ok') return stockInfo
    return {
      ...stockInfo,
      name: quoteState.data.nameKr || pickedName || stockInfo.name,
      code: quoteState.data.code,
      market: quoteState.data.market?.includes('코스피') ? 'KOSPI' : quoteState.data.market || stockInfo.market,
      sector: quoteState.data.sector || stockInfo.sector,
      price: quoteState.data.price,
      change: quoteState.data.change,
      changePercent: quoteState.data.changePercent,
      investmentBadge: getStrategy(72, 47, 10).replace('_ONLY', ''),
      asOfDate: `${new Date(quoteState.data.fetchedAt).getFullYear()}.${String(
        new Date(quoteState.data.fetchedAt).getMonth() + 1,
      ).padStart(2, '0')}.${String(new Date(quoteState.data.fetchedAt).getDate()).padStart(2, '0')} 기준`,
    }
  }, [quoteState, pickedName])

  const summaryInfo = useMemo(() => {
    const structure = Number(logicState.data?.structure?.split('/')[0]?.trim() || 60)
    const execution = Number(logicState.data?.execution?.split('/')[0]?.trim() || 50)
    const rsi = Number(logicState.data?.rsi?.replace(/[^\d.]/g, '') || 47)
    const market =
      logicState.data?.market?.includes('Caution')
        ? 42
        : logicState.data?.market?.includes('Risk-On')
          ? 78
          : 60
    const consensus = logicState.data?.consensusDetails
    const consensusScore =
      consensus?.avgTargetPrice && consensus?.maxTargetPrice
        ? calculateConsensusScore({
            currentPrice: liveStock.price,
            avgTargetPrice: consensus.avgTargetPrice,
            maxTargetPrice: consensus.maxTargetPrice,
            analystCount: consensus.analystCount ?? 1,
            lastConsensusUpdateDays: consensus.lastUpdateDays ?? 7,
          })
        : 50
    const trailingPER = quoteState.status === 'ok' ? quoteState.data.per : null
    const hasPer = typeof trailingPER === 'number' && Number.isFinite(trailingPER)
    const sdNav = logicState.data?.supplyDetails
    const foreignNetAmount3D = sdNav?.foreignNetAmount3D ?? 0
    const institutionNetAmount3D = sdNav?.institutionNetAmount3D ?? 0
    const retailNetAmount3D = sdNav?.retailNetAmount3D ?? 0
    const supplyScore = calculateSupplyScore({
      foreignNetAmount3D,
      institutionNetAmount3D,
      retailNetAmount3D,
      foreignNetAmount5D: sdNav?.foreignNetAmount5D ?? null,
      institutionNetAmount5D: sdNav?.institutionNetAmount5D ?? null,
      retailNetAmount5D: sdNav?.retailNetAmount5D ?? null,
    })
    const valuationScore =
      hasPer
        ? calculateValuationScore({
            trailingPER,
            forwardPER: trailingPER,
            forwardEPSGrowthPct: 0,
            sectorAveragePER: trailingPER,
            historicalPERPercentile: 50,
          })
        : 50
    const code6nav = String(queryCode).replace(/\D/g, '').padStart(6, '0')
    const sectorSnapNav =
      code6nav === stockInfo.code
        ? mockSectorFlowSnapshot
        : inferSectorFlowSnapshot({
            sectorName: liveStock.sector || '해당 섹터',
            supplyScore,
            rotationLine: logicState.data?.rotation,
            momentumLine: logicState.data?.momentum,
          })
    const momentumScoreNav = parseMomentumScoreFromLogic(logicState.data?.momentum, rsi)
    const score = calculateFinalScore({
      structure,
      execution,
      supply: supplyScore,
      sectorFlow: sectorSnapNav.sectorFlowScore,
      consensus: consensusScore,
      valuation: valuationScore,
      momentum: momentumScoreNav,
      market,
      news: 58,
    })
    const strategy = getStrategy(score, rsi, execution)
    const detailParts: string[] = []
    if (structure >= 70) detailParts.push('구조 점수가 높아 추세 훼손 가능성은 제한적입니다')
    else if (structure <= 45) detailParts.push('구조 점수가 낮아 추세 신뢰도가 떨어집니다')
    else detailParts.push('구조 점수는 중립 구간입니다')

    if (execution >= 60) detailParts.push('실행 점수가 높아 진입/관리 타이밍 대응이 유리합니다')
    else if (execution <= 45) detailParts.push('실행 점수가 낮아 추격 진입은 불리합니다')
    else detailParts.push('실행 점수는 보통 수준입니다')

    if (supplyScore >= 60) {
      detailParts.push(
        `직전 3거래일 누적 수급은 외국인 ${formatKrwAmountToEok(foreignNetAmount3D)}, 기관 ${formatKrwAmountToEok(institutionNetAmount3D)}로 우호적입니다`,
      )
    } else if (supplyScore <= 45) {
      detailParts.push(
        `직전 3거래일 누적 수급은 외국인 ${formatKrwAmountToEok(foreignNetAmount3D)}, 기관 ${formatKrwAmountToEok(institutionNetAmount3D)}로 부담 구간입니다`,
      )
    } else {
      detailParts.push('직전 3거래일 누적 수급은 중립에 가깝습니다')
    }

    if (consensusScore >= 60) detailParts.push('컨센서스 기준 기대수익 여지가 남아 있습니다')
    else if (consensusScore <= 45) detailParts.push('컨센서스 업사이드가 제한적입니다')

    if (hasPer) detailParts.push(`현재 PER ${trailingPER.toFixed(1)}x를 밸류에이션 점수에 반영했습니다`)
    else detailParts.push('PER 실데이터 미수신으로 밸류에이션은 중립 처리했습니다')

    const reason = detailParts.slice(0, 4).join(' · ')
    return {
      title: strategy === 'HOLD' ? '지금은 보유가 더 좋은 구간' : '신호 강도가 약해 관망이 유리',
      description: '일부 점수는 유지되나 신규 진입 근거는 아직 부족',
      finalGrade: getFinalGrade(score),
      strategy,
      entryStage: getEntryStage(score, strategy),
      reason,
    }
  }, [logicState.data, quoteState, liveStock.price, liveStock.sector, queryCode])

  const metricSummary = useMemo(() => {
    const d = logicState.data
    const structureScore = Number(d?.structure?.split('/')[0]?.trim() || 60)
    const executionScore = Number(d?.execution?.split('/')[0]?.trim() || 50)
    const supplyScore = Number(d?.flow?.match(/-?\d+(\.\d+)?/)?.[0] || 52)
    const sdSum = d?.supplyDetails
    const foreignNetAmount3D = sdSum?.foreignNetAmount3D ?? 0
    const institutionNetAmount3D = sdSum?.institutionNetAmount3D ?? 0
    const retailNetAmount3D = sdSum?.retailNetAmount3D ?? 0
    const computedSupplyScore = calculateSupplyScore({
      foreignNetAmount3D,
      institutionNetAmount3D,
      retailNetAmount3D,
      foreignNetAmount5D: sdSum?.foreignNetAmount5D ?? null,
      institutionNetAmount5D: sdSum?.institutionNetAmount5D ?? null,
      retailNetAmount5D: sdSum?.retailNetAmount5D ?? null,
    })
    const code6sum = String(queryCode).replace(/\D/g, '').padStart(6, '0')
    const sectorSnapSum =
      code6sum === stockInfo.code
        ? mockSectorFlowSnapshot
        : inferSectorFlowSnapshot({
            sectorName: liveStock.sector || '해당 섹터',
            supplyScore: computedSupplyScore || supplyScore,
            rotationLine: d?.rotation,
            momentumLine: d?.momentum,
          })
    const trailingPER = quoteState.status === 'ok' ? quoteState.data.per : null
    const hasPer = typeof trailingPER === 'number' && Number.isFinite(trailingPER)
    const valuationScore =
      hasPer
        ? calculateValuationScore({
            trailingPER,
            forwardPER: trailingPER,
            forwardEPSGrowthPct: 0,
            sectorAveragePER: trailingPER,
            historicalPERPercentile: 50,
          })
        : 50
    const indicatorScore = Number(d?.rsi?.replace(/[^\d.]/g, '') || 55)
    const candleQualityScore = Number(d?.candleQuality?.match(/-?\d+(\.\d+)?/)?.[0] || 56)
    const marketScore = d?.market?.includes('Caution')
      ? 42
      : d?.market?.includes('Risk-On')
        ? 78
        : 60
    const consensus = d?.consensusDetails
    const consensusScore =
      consensus?.avgTargetPrice && consensus?.maxTargetPrice
        ? calculateConsensusScore({
            currentPrice: liveStock.price,
            avgTargetPrice: consensus.avgTargetPrice,
            maxTargetPrice: consensus.maxTargetPrice,
            analystCount: consensus.analystCount ?? 1,
            lastConsensusUpdateDays: consensus.lastUpdateDays ?? 7,
          })
        : 50
    const rsi14 = Number(d?.rsi?.replace(/[^\d.]/g, '') || 50)
    const momentumForFinal = parseMomentumScoreFromLogic(d?.momentum, rsi14)
    const finalScore = calculateFinalScore({
      structure: structureScore,
      execution: executionScore,
      supply: computedSupplyScore || supplyScore,
      sectorFlow: sectorSnapSum.sectorFlowScore,
      consensus: consensusScore,
      valuation: valuationScore,
      momentum: momentumForFinal,
      market: marketScore,
      news: 58,
    })
    const atrDistance = parseAtrDistance(d?.atrGap)
    const consecutiveRiseDays = parseConsecutiveRiseDays(d?.streak)
    const strategy = getStrategy(finalScore, rsi14, executionScore) as
      | 'BUY'
      | 'HOLD'
      | 'WATCH_ONLY'
      | 'TAKE_PROFIT'
      | 'REJECT'
    const entryStage = getEntryStageCode(strategy, finalScore, executionScore)

    return generateMetricSummary({
      finalScore,
      structureScore,
      executionScore,
      supplyScore: computedSupplyScore || supplyScore,
      sectorFlowScore: sectorSnapSum.sectorFlowScore,
      consensusScore,
      valuationScore,
      foreignNetAmount3D,
      institutionNetAmount3D,
      retailNetAmount3D,
      indicatorScore,
      candleQualityScore,
      marketScore,
      rsi14,
      atrDistance,
      consecutiveRiseDays,
      strategy,
      entryStage,
    })
  }, [logicState.data, liveStock.price, liveStock.sector, queryCode, quoteState])

  const liveMetrics: LogicMetric[] = useMemo(() => {
    const d = logicState.data
    if (!d) return logicMetrics
    const sd = d.supplyDetails
    const foreignNetShares3D = sd?.foreignNetShares3D ?? 0
    const institutionNetShares3D = sd?.institutionNetShares3D ?? 0
    const retailNetShares3D = sd?.retailNetShares3D ?? 0
    const foreignNetAmount3D = sd?.foreignNetAmount3D ?? 0
    const institutionNetAmount3D = sd?.institutionNetAmount3D ?? 0
    const retailNetAmount3D = sd?.retailNetAmount3D ?? 0
    const fi3Amt = foreignNetAmount3D + institutionNetAmount3D
    const structureScore = Number(d.structure?.split('/')[0]?.trim() || 60)
    const executionScore = Number(d.execution?.split('/')[0]?.trim() || 50)
    const indicatorScore = Number(d.rsi?.replace(/[^\d.]/g, '') || 55)
    const marketScore = d.market?.includes('Caution')
      ? 45
      : d.market?.includes('Risk-On')
        ? 78
        : 60
    const trailingPER = quoteState.status === 'ok' ? quoteState.data.per : null
    const consensus = d.consensusDetails
    const consensusScore =
      consensus?.avgTargetPrice && consensus?.maxTargetPrice
        ? calculateConsensusScore({
            currentPrice: liveStock.price,
            avgTargetPrice: consensus.avgTargetPrice,
            maxTargetPrice: consensus.maxTargetPrice,
            analystCount: consensus.analystCount ?? 1,
            lastConsensusUpdateDays: consensus.lastUpdateDays ?? 7,
          })
        : 50
    const consensusUpside =
      consensus?.avgTargetPrice && consensus?.maxTargetPrice
        ? calculateConsensusUpside(
            liveStock.price,
            consensus.avgTargetPrice,
            consensus.maxTargetPrice,
          )
        : null
    const hasPer = typeof trailingPER === 'number' && Number.isFinite(trailingPER)
    const valuationScore =
      hasPer
        ? calculateValuationScore({
            trailingPER,
            forwardPER: trailingPER,
            forwardEPSGrowthPct: 0,
            sectorAveragePER: trailingPER,
            historicalPERPercentile: 50,
          })
        : 50
    const supplyScoreLive = calculateSupplyScore({
      foreignNetAmount3D,
      institutionNetAmount3D,
      retailNetAmount3D,
      foreignNetAmount5D: sd?.foreignNetAmount5D ?? null,
      institutionNetAmount5D: sd?.institutionNetAmount5D ?? null,
      retailNetAmount5D: sd?.retailNetAmount5D ?? null,
    })
    const code6m = String(queryCode).replace(/\D/g, '').padStart(6, '0')
    const sectorSnapM =
      code6m === stockInfo.code
        ? mockSectorFlowSnapshot
        : inferSectorFlowSnapshot({
            sectorName: liveStock.sector || '해당 섹터',
            supplyScore: supplyScoreLive,
            rotationLine: d.rotation,
            momentumLine: d.momentum,
          })
    return [
      { title: '구조', value: d.structure || '데이터 없음', score: structureScore, descriptionKey: 'structure', icon: 'Layers', tone: 'blue' },
      { title: '실행', value: d.execution || '데이터 없음', score: executionScore, descriptionKey: 'execution', icon: 'Zap', tone: 'violet' },
      { title: 'ATR 이격', value: d.atrGap || '데이터 없음', score: 60, descriptionKey: 'atrDistance', icon: 'Ruler', tone: 'amber' },
      { title: '연속상승', value: d.streak || '데이터 없음', score: 62, descriptionKey: 'consecutiveRise', icon: 'TrendingUp', tone: 'sky' },
      { title: '시장', value: d.market || '데이터 없음', score: marketScore, descriptionKey: 'market', icon: 'Globe2', tone: 'emerald' },
      {
        title: '섹터 자금흐름',
        value: sectorFlowMainTitle(sectorSnapM),
        subValue: sectorFlowSubLines(sectorSnapM),
        score: sectorSnapM.sectorFlowScore,
        statusBadge: sectorSnapM.sectorFlowStatus,
        descriptionKey: 'sectorFlow',
        icon: 'Landmark',
        tone: 'indigo',
      },
      { title: '구조 상태', value: d.structureState || '데이터 없음', score: structureScore, descriptionKey: 'structure', icon: 'Map', tone: 'orange' },
      {
        title: '수급',
        value: `${formatKrwAmountToEok(fi3Amt)}`,
        supplyDetails: {
          foreignNetShares3D,
          foreignNetAmount3D,
          institutionNetShares3D,
          institutionNetAmount3D,
          retailNetShares3D,
          retailNetAmount3D,
          foreignNetAmount5D: sd?.foreignNetAmount5D ?? null,
          institutionNetAmount5D: sd?.institutionNetAmount5D ?? null,
          retailNetAmount5D: sd?.retailNetAmount5D ?? null,
          supplyPeriod: sd?.supplyPeriod ?? '직전 3거래일 누적',
        },
        tooltipSummary: '수급은 당일 실시간이 아니라 직전 3거래일 누적으로 판단합니다.',
        score: supplyScoreLive,
        descriptionKey: 'supply',
        icon: 'Users',
        tone: 'cyan',
      },
      {
        title: '컨센서스',
        value:
          consensus?.avgTargetPrice && consensus?.maxTargetPrice
            ? (() => {
                const avg = consensus.avgTargetPrice.toLocaleString('ko-KR')
                const hi = consensus.maxTargetPrice.toLocaleString('ko-KR')
                const lo =
                  typeof consensus.minTargetPrice === 'number' &&
                  consensus.minTargetPrice > 0 &&
                  consensus.minTargetPrice < consensus.maxTargetPrice
                    ? consensus.minTargetPrice.toLocaleString('ko-KR')
                    : null
                return lo
                  ? `평균 ${avg}원 / 최고 ${hi}원 / 최저 ${lo}원`
                  : `평균 ${avg}원 / 최고 ${hi}원`
              })()
            : '데이터 없음',
        subValue:
          consensusUpside != null
            ? `평균 ${consensusUpside.avgUpsidePct >= 0 ? '+' : ''}${consensusUpside.avgUpsidePct.toFixed(1)}% / 최고 ${consensusUpside.maxUpsidePct >= 0 ? '+' : ''}${consensusUpside.maxUpsidePct.toFixed(1)}%`
            : '외부 컨센서스 데이터 미수신',
        meta: (() => {
          if (consensus?.recommendationScore != null || consensus?.recommendationText) {
            return `투자의견 ${consensus.recommendationScore?.toFixed(2) ?? '-'} (${consensus.recommendationText ?? '-'})`
          }
          return undefined
        })(),
        score: consensusScore,
        descriptionKey: 'consensus',
        icon: 'SlidersHorizontal',
        tone: 'teal',
      },
      { title: '캔들질', value: d.candleQuality || '데이터 없음', score: 56, descriptionKey: 'candleQuality', icon: 'CandlestickChart', tone: 'rose' },
      {
        title: '밸류에이션',
        value:
          hasPer
            ? `PER ${trailingPER.toFixed(1)}x`
            : 'PER 데이터 없음',
        score: valuationScore,
        descriptionKey: 'valuation',
        icon: 'Droplets',
        tone: 'slate',
      },
      { title: '지표', value: d.indicator || d.rsi || '데이터 없음', score: indicatorScore, descriptionKey: 'indicators', icon: 'Activity', tone: 'blue' },
      { title: '특이', value: d.unusual || '데이터 없음', score: 60, descriptionKey: 'special', icon: 'CircleAlert', tone: 'red' },
      { title: '통계', value: d.stats || '데이터 없음', score: 55, descriptionKey: 'statistics', icon: 'Percent', tone: 'slate' },
    ]
  }, [logicState.data, liveStock.price, liveStock.sector, queryCode])

  const logicSubtitle = useMemo(() => {
    const statusLabel =
      logicState.status === 'loading'
        ? '갱신 중'
        : logicState.status === 'ok'
          ? '갱신 완료'
          : logicState.status === 'error'
            ? '오류'
            : '대기'
    return `기준 종목코드 ${queryCode} · 상태 ${statusLabel}`
  }, [logicState.status, queryCode])

  const logicDerived = useMemo(() => {
    const d = logicState.data
    const price = liveStock.price
    if (!Number.isFinite(price) || price <= 0) return null

    const structureScore = Number(d?.structure?.split('/')[0]?.trim() ?? 60)
    const executionScore = Number(d?.execution?.split('/')[0]?.trim() ?? 50)
    const rsi14 = Number(d?.rsi?.replace(/[^\d.]/g, '') ?? 50)

    const sd3 = d?.supplyDetails
    const foreignNetAmount3D = sd3?.foreignNetAmount3D ?? 0
    const institutionNetAmount3D = sd3?.institutionNetAmount3D ?? 0
    const retailNetAmount3D = sd3?.retailNetAmount3D ?? 0

    const supplyScore = calculateSupplyScore({
      foreignNetAmount3D,
      institutionNetAmount3D,
      retailNetAmount3D,
      foreignNetAmount5D: sd3?.foreignNetAmount5D ?? null,
      institutionNetAmount5D: sd3?.institutionNetAmount5D ?? null,
      retailNetAmount5D: sd3?.retailNetAmount5D ?? null,
    })

    const code6 = String(queryCode).replace(/\D/g, '').padStart(6, '0')
    const sectorSnap =
      code6 === stockInfo.code
        ? mockSectorFlowSnapshot
        : inferSectorFlowSnapshot({
            sectorName: liveStock.sector || '해당 섹터',
            supplyScore,
            rotationLine: d?.rotation,
            momentumLine: d?.momentum,
          })
    const sectorFlowScore = sectorSnap.sectorFlowScore
    const momentumScore = parseMomentumScoreFromLogic(d?.momentum, rsi14)
    const marketScore = d?.market?.includes('Caution')
      ? 42
      : d?.market?.includes('Risk-On')
        ? 78
        : 60

    const consensus = d?.consensusDetails
    const consensusScore =
      consensus?.avgTargetPrice && consensus?.maxTargetPrice
        ? calculateConsensusScore({
            currentPrice: price,
            avgTargetPrice: consensus.avgTargetPrice,
            maxTargetPrice: consensus.maxTargetPrice,
            analystCount: consensus.analystCount ?? 1,
            lastConsensusUpdateDays: consensus.lastUpdateDays ?? 7,
          })
        : 50

    const trailingPER = quoteState.status === 'ok' ? quoteState.data.per : null
    const hasPer = typeof trailingPER === 'number' && Number.isFinite(trailingPER)
    const valuationScore = hasPer
      ? calculateValuationScore({
          trailingPER,
          forwardPER: trailingPER,
          forwardEPSGrowthPct: 0,
          sectorAveragePER: trailingPER,
          historicalPERPercentile: 50,
        })
      : 50

    const finalScore = calculateFinalScore({
      structure: structureScore,
      execution: executionScore,
      supply: supplyScore,
      sectorFlow: sectorFlowScore,
      consensus: consensusScore,
      valuation: valuationScore,
      momentum: momentumScore,
      market: marketScore,
      news: 58,
    })

    const marketStatus =
      d?.market?.includes('Caution')
        ? 'Caution'
        : d?.market?.includes('Risk-On')
          ? 'RiskOn'
          : 'Neutral'

    const supportPrice =
      quoteState.status === 'ok' ? (quoteState.data.low ?? price * 0.95) : price * 0.95
    const resistancePrice =
      quoteState.status === 'ok' ? (quoteState.data.high ?? price * 1.02) : price * 1.02
    const recentHigh20 =
      quoteState.status === 'ok' ? (quoteState.data.high ?? price * 1.03) : price * 1.03
    const recentLow20 =
      quoteState.status === 'ok' ? (quoteState.data.low ?? price * 0.94) : price * 0.94

    const atr14 = Math.max(1, price * 0.018)
    const atrDistance = parseAtrDistance(d?.atrGap)
    const ma20 = price * 0.975

    const targetStopInput: TargetStopInput = {
      currentPrice: price,
      atr14,
      atrPct: (atr14 / price) * 100,
      supportPrice,
      ma20,
      recentLow20,
      marketScore,
      rsi14,
      finalScore,
      executionScore,
      atrDistance,
      marketStatus,
    }

    const stop = calculateStopPrice(targetStopInput)

    const targetPriceInput: TargetPriceInput = {
      currentPrice: price,
      atr14,
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
      resistancePrice,
      supportPrice,
      recentHigh20,
      consensusAvgTargetPrice: consensus?.avgTargetPrice,
      consensusMaxTargetPrice: consensus?.maxTargetPrice,
      marketStatus,
    }

    const targetPriceResult = calculateTargetPrices(targetPriceInput)
    const oneMonthTarget =
      targetPriceResult.targets.find((t) => t.label === '1M')?.targetPrice ?? price
    const rr = calculateRiskReward(price, stop.stopPrice, oneMonthTarget)

    const strategy = getStrategy(finalScore, rsi14, executionScore) as Strategy

    const threeMonthInput: ThreeMonthStrategyInput = {
      currentPrice: price,
      finalScore,
      executionScore,
      supplyScore,
      rsi14,
      atrDistance,
      atr14,
      strategy,
      marketStatus,
      marketScore,
      riskRewardRatio: Number.isFinite(rr.ratio) ? rr.ratio : 0,
      supportPrice,
      consensusAvgTargetPrice: consensus?.avgTargetPrice ?? null,
      consensusMaxTargetPrice: consensus?.maxTargetPrice ?? null,
    }
    const threeMonth = calculateThreeMonthStrategy(threeMonthInput)

    const entryStage = getEntryStageCode(strategy, finalScore, executionScore)

    const briefingInput = {
      structureScore,
      executionScore,
      supplyScore,
      consensusScore,
      valuationScore,
      rsi14,
      atrDistance,
      marketStatus,
      marketLabel: d?.market ?? '',
      strategy,
      entryStage,
      threeMonthEntry: threeMonth.entryDecision,
      finalScore,
    }

    return {
      targetPriceResult,
      stop,
      rr,
      threeMonth,
      briefingInput,
    }
  }, [logicState.data, liveStock.price, liveStock.sector, queryCode, quoteState])

  const mockNewsSorted = useMemo(
    () => sortNewsByDateDesc(getMockNewsByStockCode(queryCode)),
    [queryCode],
  )

  const briefingBundle = useMemo(() => {
    const d = logicState.data
    const price = liveStock.price
    const code6 = String(queryCode).replace(/\D/g, '').padStart(6, '0')
    const consensus = d?.consensusDetails
    let consensusUpsideAvgPct: number | undefined
    let consensusUpsideMaxPct: number | undefined
    if (consensus?.avgTargetPrice && consensus?.maxTargetPrice && price > 0) {
      const u = calculateConsensusUpside(price, consensus.avgTargetPrice, consensus.maxTargetPrice)
      consensusUpsideAvgPct = u.avgUpsidePct
      consensusUpsideMaxPct = u.maxUpsidePct
    }

    const bi = logicDerived?.briefingInput
    const entryDecision = logicDerived?.threeMonth.entryDecision ?? '관망'
    const sd = d?.supplyDetails

    const trailingPER = quoteState.status === 'ok' ? quoteState.data.per ?? undefined : undefined

    const detailedBriefingInput: DetailedBriefingInput = {
      stockName: liveStock.name,
      stockCode: code6,
      currentPrice: price,
      previousClose:
        quoteState.status === 'ok' &&
        Number.isFinite(quoteState.data.price) &&
        Number.isFinite(quoteState.data.change)
          ? quoteState.data.price - quoteState.data.change
          : undefined,
      changePct: liveStock.changePercent,
      intradayHigh: quoteState.status === 'ok' ? (quoteState.data.high ?? undefined) : undefined,
      intradayLow: quoteState.status === 'ok' ? (quoteState.data.low ?? undefined) : undefined,
      high52w: undefined,
      isNear52wHigh: false,
      consensusAvgTargetPrice: consensus?.avgTargetPrice,
      consensusMaxTargetPrice: consensus?.maxTargetPrice,
      consensusUpsideAvgPct,
      consensusUpsideMaxPct,
      foreignNetAmount3D: sd?.foreignNetAmount3D,
      institutionNetAmount3D: sd?.institutionNetAmount3D,
      retailNetAmount3D: sd?.retailNetAmount3D,
      rsi14: bi?.rsi14 ?? 50,
      atrDistance: bi?.atrDistance ?? 2,
      trailingPER: trailingPER ?? undefined,
      forwardPER: undefined,
      forwardEPSGrowthPct: undefined,
      finalScore: bi?.finalScore ?? 60,
      executionScore: bi?.executionScore ?? 50,
      supplyScore: bi?.supplyScore ?? 55,
      valuationScore: bi?.valuationScore ?? 55,
      strategy: bi?.strategy ?? 'HOLD',
      entryDecision,
      news: mockNewsSorted,
    }

    const localMemo = generateDetailedInvestmentMemo(detailedBriefingInput)
    const prompt = buildInvestmentMemoPrompt(detailedBriefingInput)
    return { localMemo, prompt }
  }, [liveStock, queryCode, logicDerived, logicState.data, mockNewsSorted, quoteState])

  const [aiBriefing, setAiBriefing] = useState<DetailedInvestmentMemoResult | null>(null)
  const [aiBriefingLoading, setAiBriefingLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const { prompt } = briefingBundle
    setAiBriefingLoading(true)
    setAiBriefing(null)
    fetchAiBriefing(prompt)
      .then((b) => {
        if (!cancelled) setAiBriefing(b)
      })
      .catch(() => {
        if (!cancelled) setAiBriefing(null)
      })
      .finally(() => {
        if (!cancelled) setAiBriefingLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [briefingBundle.prompt])

  const displayMemo = aiBriefingLoading
    ? null
    : (aiBriefing ?? briefingBundle.localMemo)
  const briefingSource: 'claude' | 'local' = aiBriefing ? 'claude' : 'local'

  const targetPricePanelResult = logicDerived?.targetPriceResult ?? null

  const stopInfo = useMemo(() => {
    if (!logicDerived) return mockStopInfo
    return {
      stopPrice: logicDerived.stop.stopPrice,
      stopLossPct: logicDerived.stop.stopLossPct,
      method: logicDerived.stop.method,
      reason: logicDerived.stop.reason,
      candidates: logicDerived.stop.candidates,
      warning: logicDerived.stop.warning,
    }
  }, [logicDerived])

  const chartData = useMemo(() => {
    return chartState.points.length
      ? chartState.points.map((p) => ({ label: p.label, value: p.price }))
      : [{ label: '—', value: liveStock.price }]
  }, [chartState.points, liveStock.price])

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-4 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveMainTab('analysis')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeMainTab === 'analysis' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          종목 분석
        </button>
        <button
          type="button"
          onClick={() => setActiveMainTab('screener')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeMainTab === 'screener' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          시장 스크리너
        </button>
      </div>

      {activeMainTab === 'analysis' ? (
        <article className="overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm">
          <StockHeader
            title="Signal15 🇰🇷"
            subtitle=""
            asOfDate={liveStock.asOfDate}
            leading={
              <span className="flex size-11 items-center justify-center rounded-xl border border-red-200 bg-red-50 sm:size-12">
                <TrendingUp className="size-6 text-red-600 sm:size-7" strokeWidth={2.25} aria-hidden />
              </span>
            }
          />
          <div className="border-b border-slate-200 px-6 py-3 sm:px-8">
            <StockNameSearch
              compact
              value={searchDisplay}
              onChange={setSearchDisplay}
              onPick={(code, nameKr) => {
                setQueryCode(code)
                setPickedName(nameKr)
                setSearchDisplay(`${nameKr} (${code})`)
              }}
            />
          </div>
          <MainStockCard stock={liveStock} />

          <div className="grid grid-cols-1 md:grid-cols-2 md:items-stretch">
            <SummaryPanel
              summary={summaryInfo}
              metricSummary={metricSummary}
              investmentMemo={displayMemo}
              aiLoading={aiBriefingLoading}
            />
            <PriceChart
              timeframe={tf}
              onTimeframeChange={setTf}
              data={chartData}
              currentPrice={liveStock.price}
              dayChange={liveStock.change}
              status={chartState.status}
              errorMessage={chartState.status === 'error' ? chartState.message : undefined}
            />
          </div>

          <AIBriefingPanel
            memo={displayMemo}
            news={mockNewsSorted}
            loading={aiBriefingLoading}
            briefingSource={briefingSource}
          />

          {logicState.status === 'loading' ? (
            <p className="px-6 pt-4 text-xs text-slate-500 sm:px-8">로직 지표 계산 중...</p>
          ) : null}
          {logicState.status === 'error' ? (
            <p className="px-6 pt-4 text-xs text-amber-700 sm:px-8">로직 지표 오류: {logicState.message}</p>
          ) : null}
          <MetricGrid metrics={liveMetrics} subtitle={logicSubtitle} />
          <ExecutionStrategy
            strategy={logicDerived?.threeMonth ?? null}
            riskReward={logicDerived?.rr ?? { ratio: 0, verdict: '애매' }}
            loading={logicState.status === 'loading'}
          />
          <TargetPricePanel
            result={targetPricePanelResult}
            loading={logicState.status === 'loading' && !targetPricePanelResult}
          />
          <StopPanel stop={stopInfo} />

          <footer className="border-t border-slate-200 px-6 py-4 sm:px-8">
            <p className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
              <Info className="size-3.5" />
              {saveStatus}
            </p>
          </footer>
        </article>
      ) : (
        <SectorScreenerTab />
      )}
    </main>
  )
}
