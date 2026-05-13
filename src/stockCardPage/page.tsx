import { useEffect, useMemo, useState } from 'react'
import { Info, TrendingUp } from 'lucide-react'
import { ExecutionStrategy } from '../components/ExecutionStrategy'
import { IndicatorGrid } from '../components/IndicatorGrid'
import { StockNameSearch } from '../components/StockNameSearch'
import { SpecialEventBanner } from '../components/SpecialEventBanner'
import { StockHeader } from '../components/StockHeader'
import { StockHero, letterGradeToTone, scoreToLetterGrade, type StockHeroChartProps } from '../components/StockHero'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { StopPanel } from '../components/StopPanel'
import { PriceTargets } from '../components/PriceTargets'
import { useKisChart, type IntradayInterval } from '../hooks/useKisChart'
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
  buildThreeDayFiSupplyReasonSentence,
  buildSupplyDrawerBody,
  supplyCardAccentFromFiSum,
} from '../lib/supplyFlowTone'
import { resolveTargetPriceDisplayMode } from '../lib/targetPriceDisplayMode'
import {
  computeEntryDecisionBundle,
  executionUiFromEntryDecision,
  legacyEntryStageFromEntryDecision,
  legacyStrategyFromEntryDecision,
} from '../lib/strategy'
import type { ExecutionStrategyInputs } from '../lib/strategy/types'
import { resolveSectorFundBench } from '../lib/fundamentalCards'
import {
  calculateConsensusScore,
  calculateConsensusUpside,
  calculateSupplyScore,
  calculateThreeMonthStrategy,
  calculateValuationScore,
  computeStrategyRiskRewardMetrics,
  calculateExecutionPlan,
  calculateFinalScore,
  calculateTargetPrices,
  marketScoreFromLogicIndicators,
  marketStatusFromLogicIndicators,
  parseAtrDistance,
  parseConsecutiveRiseDays,
  inferSectorFlowSnapshot,
  parseMomentumScoreFromLogic,
  resolveFirstTakeProfitSellPct,
  sectorFlowMainTitle,
  sectorFlowSubLines,
  summarizeExecutionUi,
} from '../lib/signalLogic'
import { buildLogicIndicatorGridSlots } from '../lib/indicatorGridSlots'
import { getHeadlineByStage } from '../lib/insight/headlineMap'
import {
  asMetricRiskStrip,
  parseAtrDistanceValue,
  resolveAtrDistanceRiskVisual,
  resolveIndicatorRiskVisual,
  resolveStatsRiskVisual,
} from '../lib/metricRiskVisual'
import { buildRoeEpsGridMetrics } from '../lib/fundamentalCards'
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
} from '../lib/indicatorInterpretSubs'
import { calculateStopPriceV2 } from '../lib/stopPriceV2'
import { buildValuationCardModel } from '../lib/valuationCard'
import {
  buildConsensusDrawerBody,
} from '../lib/consensusPresentation'
import { marketCardAccentFromHeadline, marketPrimaryKorean } from '../lib/marketCardPresentation'
import type {
  EntryStage,
  ExecutionInput,
  LogicMetric,
  StopInfo,
  Strategy,
  TargetPriceInput,
  ThreeMonthStrategyInput,
  Timeframe,
} from '../types/stock'

type PageProps = {
  initialCode?: string
}

export default function Page(props: PageProps = {}) {
  const { initialCode } = props
  const defaultCode = initialCode ?? stockInfo.code
  const [queryCode, setQueryCode] = useState(defaultCode)
  const [searchDisplay, setSearchDisplay] = useState(() =>
    initialCode && initialCode !== stockInfo.code ? `${initialCode}` : `${stockInfo.name} (${stockInfo.code})`,
  )
  const [pickedName, setPickedName] = useState<string | null>(null)
  const [tf, setTf] = useState<Timeframe>('1D')
  const [intradayIv, setIntradayIv] = useState<IntradayInterval>('5m')

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
  const { state: logicState } = useKisLogicIndicators(queryCode)

  useEffect(() => {
    try {
      sessionStorage.setItem('lastStockCode', queryCode)
    } catch {
      /* ignore */
    }
  }, [queryCode])

  useEffect(() => {
    if (quoteState.status !== 'ok') return
    if (quoteState.data.code !== queryCode) return
    const nk = quoteState.data.nameKr || pickedName
    if (!nk) return
    setSearchDisplay((prev) => {
      if (prev === queryCode) return `${nk} (${queryCode})`
      return prev
    })
  }, [quoteState, queryCode, pickedName])

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
      investmentBadge: stockInfo.investmentBadge,
      asOfDate: `${new Date(quoteState.data.fetchedAt).getFullYear()}.${String(
        new Date(quoteState.data.fetchedAt).getMonth() + 1,
      ).padStart(2, '0')}.${String(new Date(quoteState.data.fetchedAt).getDate()).padStart(2, '0')} 기준`,
    }
  }, [quoteState, pickedName])

  const chartExchangeSuffix = useMemo(() => {
    const m = (liveStock.market || '').toUpperCase()
    return m.includes('KOSDAQ') || m.includes('코스닥') ? 'KQ' : 'KS'
  }, [liveStock.market])

  const chartState = useKisChart(queryCode, tf, {
    exchangeSuffix: chartExchangeSuffix,
    intradayInterval: intradayIv,
  })

  const valuationLiveModel = useMemo(() => {
    const d = logicState.data
    const consensus = d?.consensusDetails
    let consensusAvgUpside: number | null = null
    if (
      consensus?.avgTargetPrice &&
      consensus?.maxTargetPrice &&
      liveStock.price > 0
    ) {
      consensusAvgUpside = calculateConsensusUpside(
        liveStock.price,
        consensus.avgTargetPrice,
        consensus.maxTargetPrice,
      ).avgUpsidePct
    }
    if (quoteState.status !== 'ok') return null
    const q = quoteState.data
    return buildValuationCardModel({
      trailingPER: q.per,
      price: q.price,
      eps: q.eps,
      pbr: q.pbr,
      sectorName: (q.sector ?? liveStock.sector ?? '').trim(),
      consensusAvgUpsidePct: consensusAvgUpside,
      fetchedAt: q.fetchedAt,
    })
  }, [logicState.data, quoteState, liveStock.price, liveStock.sector])

  const executionUiBundle = useMemo(() => {
    const d = logicState.data
    if (!d) return null

    const structure = Number(d.structure?.split('/')[0]?.trim() || 60)
    const execution = Number(d.execution?.split('/')[0]?.trim() || 50)
    const rsi = Number(d.rsi?.replace(/[^\d.]/g, '') || 47)
    const market = marketScoreFromLogicIndicators(d)
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
    const trailingPER = quoteState.status === 'ok' ? quoteState.data.per : null
    const hasPer = typeof trailingPER === 'number' && Number.isFinite(trailingPER)
    const sdNav = d.supplyDetails
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
    const valuationScore = valuationLiveModel
      ? calculateValuationScore(valuationLiveModel.valuationInputs)
      : hasPer && trailingPER != null
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
            rotationLine: d.rotation,
            momentumLine: d.momentum,
          })
    const momentumScoreNav = parseMomentumScoreFromLogic(d.momentum, rsi)
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
    const atrAbsNav =
      typeof d.atrGapValue === 'number' && Number.isFinite(d.atrGapValue)
        ? d.atrGapValue
        : parseAtrDistance(d.atrGap)
    const qNav = quoteState.status === 'ok' ? quoteState.data : null
    const atr14Nav =
      typeof d?.atr14Won === 'number' && Number.isFinite(d.atr14Won) && d.atr14Won > 0
        ? d.atr14Won
        : Math.max(1, liveStock.price * 0.018)
    const recentLow20Nav =
      qNav?.low != null && Number.isFinite(qNav.low) && qNav.low > 0 && qNav.low < liveStock.price
        ? qNav.low
        : liveStock.price * 0.94
    const sectorNav = (qNav?.sector ?? liveStock.sector ?? '').trim()
    const entryIn: ExecutionStrategyInputs = {
      price: liveStock.price,
      structureScore: structure,
      executionScore: execution,
      rsi14: rsi,
      atrDistanceAbs: atrAbsNav,
      atr14: atr14Nav,
      weightedRiskReward: 1.5,
      consensusAvgTargetPrice: consensus?.avgTargetPrice ?? null,
      consensusMaxTargetPrice: consensus?.maxTargetPrice ?? null,
      recentLow20: recentLow20Nav,
      sectorName: sectorNav,
      operatingMarginTtmPct: qNav?.operatingMarginTtm ?? null,
      operatingMarginYoYPp: null,
      forwardPer: valuationLiveModel?.valuationInputs.forwardPER ?? null,
      fiveYearAvgPer: resolveSectorFundBench(sectorNav).per5y,
      epsGrowthYoYPct: valuationLiveModel?.valuationInputs.forwardEPSGrowthPct ?? null,
      trailingPer: typeof trailingPER === 'number' && Number.isFinite(trailingPER) ? trailingPER : null,
    }
    const entryBundle = computeEntryDecisionBundle(entryIn)
    const entryDecisionKr = entryBundle.decision
    const strategy = legacyStrategyFromEntryDecision(entryDecisionKr) as Strategy
    const entryStageCode = legacyEntryStageFromEntryDecision(entryDecisionKr)
    const executionUi = executionUiFromEntryDecision(entryDecisionKr)
    return {
      score,
      structure,
      execution,
      rsi,
      strategy,
      entryStageCode,
      executionUi,
      foreignNetAmount3D,
      institutionNetAmount3D,
      consensusScore,
      hasPer,
      trailingPER,
      fundamentalSignal: entryBundle.fundamentalSignal,
      entryReasonShort: entryBundle.reasonShort,
    }
  }, [logicState.data, quoteState, liveStock.price, liveStock.sector, queryCode, valuationLiveModel])

  const summaryInfo = useMemo(() => {
    if (!executionUiBundle) {
      const executionUi = summarizeExecutionUi('HOLD', 'CAUTION')
      return {
        title: '신호 강도가 약해 관망이 유리',
        description: '일부 점수는 유지되나 신규 진입 근거는 아직 부족',
        strategy: 'HOLD' as Strategy,
        entryStageCode: 'CAUTION' as EntryStage,
        executionUi,
        reason: '로직 지표를 불러오면 맞춤 요약이 표시됩니다.',
      }
    }
    const {
      score,
      structure,
      execution,
      strategy,
      entryStageCode,
      executionUi,
      foreignNetAmount3D,
      institutionNetAmount3D,
      consensusScore,
      hasPer,
      trailingPER,
    } = executionUiBundle

    const detailParts: string[] = []
    if (structure >= 70) detailParts.push('구조 점수가 높아 추세 훼손 가능성은 제한적입니다')
    else if (structure <= 45) detailParts.push('구조 점수가 낮아 추세 신뢰도가 떨어집니다')
    else detailParts.push('구조 점수는 중립 구간입니다')

    if (execution >= 60) detailParts.push('실행 점수가 높아 진입/관리 타이밍 대응이 유리합니다')
    else if (execution <= 45) detailParts.push('실행 점수가 낮아 추격 진입은 불리합니다')
    else detailParts.push('실행 점수는 보통 수준입니다')

    detailParts.push(buildThreeDayFiSupplyReasonSentence(foreignNetAmount3D, institutionNetAmount3D))

    if (consensusScore >= 60) detailParts.push('컨센서스 기준 기대수익 여지가 남아 있습니다')
    else if (consensusScore <= 45) detailParts.push('컨센서스 업사이드가 제한적입니다')

    if (hasPer && trailingPER != null) {
      detailParts.push(`현재 PER ${trailingPER.toFixed(1)}x를 밸류에이션 점수에 반영했습니다`)
    } else detailParts.push('PER 실데이터 미수신으로 밸류에이션은 중립 처리했습니다')

    const reason = detailParts.slice(0, 4).join(' · ')
    let title = '신호 강도가 약해 관망이 유리'
    if (strategy === 'HOLD') title = '지금은 보유가 더 좋은 구간'
    else if (strategy === 'REJECT') title = '진입은 피하는 편이 유리'
    else if (strategy === 'TAKE_PROFIT') title = '단기 과열·익절 관리 구간'
    else if (strategy === 'BUY_AGGRESSIVE') title = '펀더멘털 강세 적극 진입 검토 구간'
    else if (strategy === 'BUY' && score >= 80) title = '진입 타이밍이 비교적 유리한 구간'

    return {
      title,
      description: '일부 점수는 유지되나 신규 진입 근거는 아직 부족',
      strategy,
      entryStageCode,
      executionUi,
      reason,
    }
  }, [executionUiBundle])

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
    const structureScore = Number(d.structure?.split('/')[0]?.trim() || 60)
    const executionScore = Number(d.execution?.split('/')[0]?.trim() || 50)
    const indicatorScore = Number(d.rsi?.replace(/[^\d.]/g, '') || 55)
    const marketScore = marketScoreFromLogicIndicators(d)
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
    const valuationScore = valuationLiveModel
      ? calculateValuationScore(valuationLiveModel.valuationInputs)
      : hasPer && trailingPER != null
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
    const sectorSubMultiline = sectorFlowSubLines(sectorSnapM)
    const marketPrimary = marketPrimaryKorean(d.marketHeadline)
    const marketSubLine =
      (typeof d.marketSubCompact === 'string' && d.marketSubCompact.trim()) ||
      (d.marketDetail ? d.marketDetail.split('\n').slice(0, 2).join(' · ') : '') ||
      '—'
    const supplyDrawerBody =
      sd != null
        ? buildSupplyDrawerBody({
            foreignNetShares3D,
            foreignNetAmount3D,
            institutionNetShares3D,
            institutionNetAmount3D,
            retailNetShares3D,
            retailNetAmount3D,
            foreignNetAmount5D: sd.foreignNetAmount5D ?? null,
            institutionNetAmount5D: sd.institutionNetAmount5D ?? null,
            retailNetAmount5D: sd.retailNetAmount5D ?? null,
            supplyPeriod: sd.supplyPeriod ?? '직전 3거래일 누적',
          })
        : ''

    const WON_5000_EOK = 5000 * 100_000_000
    const WON_2000_EOK = 2000 * 100_000_000
    const fiSum = foreignNetAmount3D + institutionNetAmount3D
    let supplyRiskStrip: LogicMetric['riskStrip'] = 'neutral'
    if (fiSum < -WON_5000_EOK) supplyRiskStrip = 'orange'
    else if (fiSum < -WON_2000_EOK) supplyRiskStrip = 'warning'

    const supplyTooltipOverride: LogicMetric['indicatorTooltipOverride'] = {
      title: '수급 (3D)',
      description:
        '직전 3거래일 외국인·기관 누적 순매수입니다. 외국인 매도 + 기관 매수가 동시에 클수록 매물 출회 위험이 있습니다.',
      thresholds: '개인·5거래일 누적은 카드를 눌러 drawer에서 확인할 수 있습니다.',
    }

    const hasConsensusTargets =
      consensus != null &&
      typeof consensus.avgTargetPrice === 'number' &&
      consensus.avgTargetPrice > 0 &&
      typeof consensus.maxTargetPrice === 'number' &&
      consensus.maxTargetPrice > 0

    const spotPx = liveStock.price
    let consensusSubComputed = '외부 컨센서스 미수신'
    let consensusSubEm: LogicMetric['subValueEmphasis'] = 'default'
    let consensusCorner: string | undefined
    let consensusTooltipOverride: LogicMetric['indicatorTooltipOverride'] | undefined

    if (hasConsensusTargets && spotPx > 0) {
      const avgPx = consensus!.avgTargetPrice
      const maxPx = consensus!.maxTargetPrice
      const gapPct = maxPx > 0 ? ((spotPx - maxPx) / maxPx) * 100 : 0
      const r = Math.round(gapPct)
      consensusSubComputed = `최고 대비 ${r >= 0 ? '+' : ''}${r}%`
      consensusSubEm = spotPx >= maxPx ? 'danger' : 'muted'
      if (spotPx > maxPx) consensusCorner = '최고 도달'
      else if (spotPx > avgPx) consensusCorner = '평균 도달'

      const rec = consensus!.recommendationScore
      const recTxt = rec != null && Number.isFinite(rec) ? rec.toFixed(2) : '—'
      consensusTooltipOverride = {
        title: '컨센서스',
        description: `증권사 애널리스트 평균 목표가와 최고 목표가입니다. 현재 투자의견 평균 ${recTxt} (5점 만점, 4 이상 매수). 컨센서스는 후행 지표이므로 변화 추세를 함께 보세요.`,
        thresholds:
          '4주 평균 목표가 변화·증권사 분산·최고·최저 갭은 카드를 눌러 drawer에서 확인할 수 있습니다.',
      }
    }

    const consensusDrawer =
      consensus?.avgTargetPrice && consensus?.maxTargetPrice
        ? buildConsensusDrawerBody({ consensus, consensusUpside })
        : ''

    const valuationBlock = valuationLiveModel
      ? {
          value: `PER ${valuationLiveModel.valuationInputs.trailingPER.toFixed(1)}x`,
          subValue: valuationPremiumInterpretSub({
            trailingPER: valuationLiveModel.valuationInputs.trailingPER,
            sectorName: (liveStock.sector ?? '').trim(),
          }),
          riskStrip: valuationLiveModel.riskStrip,
          score: calculateValuationScore(valuationLiveModel.valuationInputs),
          detailForDrawer: [valuationLiveModel.value, valuationLiveModel.subValue, valuationLiveModel.meta]
            .filter(Boolean)
            .join('\n\n'),
        }
      : {
          value: d.valuationPrimary ?? (hasPer && trailingPER != null ? `PER ${trailingPER.toFixed(1)}x` : 'PER 없음'),
          subValue:
            hasPer && trailingPER != null
              ? valuationPremiumInterpretSub({
                  trailingPER,
                  sectorName: (liveStock.sector ?? '').trim(),
                })
              : (d.valuationSub?.split('\n')[0] ?? d.valuationSub ?? '밸류 요약'),
          score: valuationScore,
          detailForDrawer: hasPer && trailingPER != null ? `Trailing PER ${trailingPER.toFixed(1)}x` : '',
        }

    const atrStrip = asMetricRiskStrip(d.atrRiskStrip)
    const atrVis =
      atrStrip != null
        ? {
            riskStrip: atrStrip,
            riskBadge: d.atrRiskBadge,
            showRiskInfoIcon: false as boolean | undefined,
          }
        : resolveAtrDistanceRiskVisual(
            typeof d.atrGapValue === 'number' && Number.isFinite(d.atrGapValue)
              ? d.atrGapValue
              : parseAtrDistanceValue(d.atrGap),
          )

    const statsStrip = asMetricRiskStrip(d.statsRiskStrip)
    const statsVis =
      statsStrip != null
        ? {
            riskStrip: statsStrip,
            riskBadge: d.statsRiskBadge,
            showRiskInfoIcon: false as boolean | undefined,
          }
        : resolveStatsRiskVisual(d.stats, d.statsTrend20Pct)

    const indStrip = asMetricRiskStrip(d.indicatorRiskStrip)
    const indVis =
      indStrip != null
        ? {
            riskStrip: indStrip,
            riskBadge: d.indicatorRiskBadge,
            showRiskInfoIcon: d.indicatorShowRiskInfoIcon,
          }
        : resolveIndicatorRiskVisual(d.indicator || d.rsi)

    const earnStrip = asMetricRiskStrip(d.earningsRiskStrip)
    const earnVis =
      earnStrip != null
        ? {
            riskStrip: earnStrip,
            riskBadge: d.earningsRiskBadge,
            showRiskInfoIcon: false as boolean | undefined,
          }
        : { riskStrip: 'neutral' as const, riskBadge: d.earningsRiskBadge }

    const atrAbsNum =
      typeof d.atrGapValue === 'number' && Number.isFinite(d.atrGapValue)
        ? d.atrGapValue
        : parseAtrDistanceValue(d.atrGap ?? '')
    const riseDisplay =
      d.streak === '연속 없음' || !d.streak
        ? '없음'
        : (d.streak.replace(/^양봉 연속\s*/u, '').replace(/^연속(상승|하락)\s*/u, '').trim() || d.streak)
    const candlePrimary =
      d.candleQualityPrimary || d.candleQuality?.split('·')[0]?.trim() || d.candleQuality || ''

    const qLive = quoteState.status === 'ok' ? quoteState.data : null
    const sectorLive = (qLive?.sector ?? liveStock.sector ?? '').trim()
    const consensusAvgUpsideForEps =
      consensusUpside != null && Number.isFinite(consensusUpside.avgUpsidePct)
        ? consensusUpside.avgUpsidePct
        : null

    const roeEpsMetrics = buildRoeEpsGridMetrics(
      {
        per: qLive?.per ?? null,
        pbr: qLive?.pbr ?? null,
        eps: qLive?.eps ?? null,
        bps: qLive?.bps ?? null,
        roeTtmApprox: qLive?.roeTtmApprox ?? null,
        operatingMarginTtm: qLive?.operatingMarginTtm ?? null,
        debtRatio: qLive?.debtRatio ?? null,
        fetchedAt: qLive?.fetchedAt ?? null,
      },
      {
        sectorName: sectorLive,
        price: liveStock.price,
        consensusAvgUpsidePct: consensusAvgUpsideForEps,
        forwardEpsGrowthPct: valuationLiveModel?.valuationInputs.forwardEPSGrowthPct ?? null,
        forwardPER: valuationLiveModel?.valuationInputs.forwardPER ?? null,
      },
    )

    return [
      {
        title: '구조',
        value: `${structureScore}점`,
        subValue: structureInterpretSub(structureScore),
        detailForDrawer: [d.structure, d.structureSub].filter(Boolean).join('\n'),
        score: structureScore,
        descriptionKey: 'structure',
        icon: 'Layers',
        tone: 'blue',
      },
      {
        title: '실행',
        value: `${executionScore}점`,
        subValue: executionInterpretSub(executionScore),
        detailForDrawer: [d.execution, d.executionSub].filter(Boolean).join('\n'),
        score: executionScore,
        descriptionKey: 'execution',
        icon: 'Zap',
        tone: 'violet',
      },
      {
        title: 'ATR 이격',
        value: (() => {
          if (typeof d.atrGapValue === 'number' && Number.isFinite(d.atrGapValue)) {
            return d.atrGapValue.toFixed(1)
          }
          const m = d.atrGap?.match(/^([+-]?[\d.]+)/)
          return m ? m[1] : d.atrGap || '—'
        })(),
        subValue: atrMaGapInterpretSub(atrAbsNum),
        detailForDrawer: [d.atrGap, d.atrGapSub, d.atrRiskBadge].filter(Boolean).join('\n'),
        ...atrVis,
        score: 60,
        descriptionKey: 'atrDistance',
        icon: 'Ruler',
        tone: 'amber',
      },
      {
        title: '연속상승',
        value: riseDisplay,
        subValue: consecutiveRiseInterpretSub(riseDisplay),
        detailForDrawer: [d.streak, d.streakSub].filter(Boolean).join('\n'),
        score: 62,
        descriptionKey: 'consecutiveRise',
        icon: 'TrendingUp',
        tone: 'sky',
      },
      {
        title: '시장',
        value: marketPrimary,
        subValue: marketSubLine,
        detailForDrawer: d.marketDetail || '',
        cardAccent: marketCardAccentFromHeadline(d.marketHeadline),
        score: marketScore,
        descriptionKey: 'market',
        icon: 'Globe2',
        tone: 'emerald',
      },
      {
        title: '섹터 자금흐름',
        value: sectorFlowMainTitle(sectorSnapM),
        subValue: sectorFiveDayVsMarketSub(sectorSnapM),
        detailForDrawer: [sectorSnapM.sectorFlowStatus && `상태: ${sectorSnapM.sectorFlowStatus}`, sectorSubMultiline]
          .filter(Boolean)
          .join('\n\n'),
        cardAccent:
          sectorSnapM.sectorFlowStatus === '주도섹터' || sectorSnapM.sectorFlowStatus === '관심섹터'
            ? 'info'
            : sectorSnapM.sectorFlowStatus === '중립'
              ? 'neutral'
              : 'warning',
        statusBadge: sectorSnapM.sectorFlowStatus === '관심섹터' ? '관심' : undefined,
        score: sectorSnapM.sectorFlowScore,
        descriptionKey: 'sectorFlow',
        icon: 'Landmark',
        tone: 'indigo',
      },
      {
        title: '구조 상태',
        value: d.structureState?.split('/')[0]?.trim() || d.structureState || '데이터 없음',
        subValue: structureStateInterpretSub(d.structureState),
        detailForDrawer: [d.structureState, d.structureStateSub].filter(Boolean).join('\n'),
        score: structureScore,
        descriptionKey: 'structureState',
        icon: 'Map',
        tone: 'orange',
      },
      {
        title: '수급 (3D)',
        value: '\u00a0',
        supplyForeignWon: foreignNetAmount3D,
        supplyInstitutionWon: institutionNetAmount3D,
        detailForDrawer: supplyDrawerBody,
        cardAccent: supplyCardAccentFromFiSum(fiSum),
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
        score: supplyScoreLive,
        riskStrip: supplyRiskStrip,
        indicatorTooltipOverride: supplyTooltipOverride,
        descriptionKey: 'supply',
        icon: 'Users',
        tone: 'cyan',
      },
      {
        title: '컨센서스',
        value: hasConsensusTargets ? '\u00a0' : '데이터 없음',
        ...(hasConsensusTargets
          ? {
              consensusAvgWon: consensus!.avgTargetPrice,
              consensusMaxWon: consensus!.maxTargetPrice,
              consensusSpotWon: spotPx,
              consensusRecommendationScore: consensus!.recommendationScore,
              subValue: consensusSubComputed,
              subValueEmphasis: consensusSubEm,
              cornerBadge: consensusCorner,
              indicatorTooltipOverride: consensusTooltipOverride,
              detailForDrawer: consensusDrawer,
              score: consensusScore,
              riskStrip: 'neutral' as const,
            }
          : {
              subValue: undefined,
              detailForDrawer: consensusDrawer,
              score: consensusScore,
              riskStrip: 'neutral' as const,
            }),
        descriptionKey: 'consensus',
        icon: 'SlidersHorizontal',
        tone: 'teal',
      },
      {
        title: '캔들질',
        value: d.candleQualityPrimary || d.candleQuality?.split('·')[0]?.trim() || d.candleQuality || '데이터 없음',
        subValue: candleQualityInterpretSub(
          candlePrimary || d.candleQualityPrimary || d.candleQuality || 'CLV5 0',
        ),
        detailForDrawer: [d.candleQuality, d.candleQualitySub].filter(Boolean).join('\n'),
        score: 56,
        descriptionKey: 'candleQuality',
        icon: 'CandlestickChart',
        tone: 'rose',
      },
      {
        title: '밸류에이션',
        ...valuationBlock,
        descriptionKey: 'valuation',
        icon: 'Droplets',
        tone: 'slate',
      },
      {
        title: '지표',
        value: d.indicatorPrimary ?? (d.indicator?.split('/')[0]?.trim() || d.rsi || '데이터 없음'),
        subValue: indicatorRsiMfiInterpretSub({
          indicatorLine: d.indicator ?? '',
          rsiNumeric: indicatorScore,
        }),
        detailForDrawer: [d.indicator, d.indicatorSub, d.rsi, d.technical].filter(Boolean).join('\n'),
        ...indVis,
        score: indicatorScore,
        descriptionKey: 'indicators',
        icon: 'Activity',
        tone: 'blue',
      },
      {
        title: '실적발표일',
        value: d.earningsPrimary ?? '예정일 미공시',
        subValue: d.earningsSub?.trim() ? d.earningsSub : '직전 분기 서프라이즈 미연동',
        detailForDrawer:
          d.earningsDetailForDrawer?.trim() ||
          [d.earningsPrimary, d.earningsSub].filter(Boolean).join('\n'),
        sparkline: d.earningsSparkline,
        valueEmphasis: d.earningsValueEmphasis,
        subValueEmphasis: d.earningsSubEmphasis,
        ...earnVis,
        score: 60,
        descriptionKey: 'earnings',
        icon: 'CalendarDays',
        tone: 'red',
      },
      {
        title: '통계',
        value:
          d.statsPrimary ??
          (() => {
            const m = d.stats?.match(/대비\s*([+-]\d+(?:\.\d+)?%)/)
            return m ? m[1] : d.stats?.slice(0, 20) || '데이터 없음'
          })(),
        subValue: statisticsAvg20InterpretSub(d.stats),
        detailForDrawer: [d.stats, d.statsSub].filter(Boolean).join('\n'),
        ...statsVis,
        score: 55,
        descriptionKey: 'statistics',
        icon: 'Percent',
        tone: 'slate',
      },
      ...roeEpsMetrics,
    ]
  }, [logicState.data, liveStock.price, liveStock.sector, queryCode, quoteState, valuationLiveModel])

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
    const marketScore = marketScoreFromLogicIndicators(d)
    const marketStatus = marketStatusFromLogicIndicators(d)

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
    const valuationScore = valuationLiveModel
      ? calculateValuationScore(valuationLiveModel.valuationInputs)
      : hasPer && trailingPER != null
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

    const supportPrice =
      quoteState.status === 'ok' ? (quoteState.data.low ?? price * 0.95) : price * 0.95
    const resistancePrice =
      quoteState.status === 'ok' ? (quoteState.data.high ?? price * 1.02) : price * 1.02
    const recentHigh20 =
      quoteState.status === 'ok' ? (quoteState.data.high ?? price * 1.03) : price * 1.03
    const atr14WonFromLogic =
      typeof d?.atr14Won === 'number' && Number.isFinite(d.atr14Won) && d.atr14Won > 0
        ? d.atr14Won
        : null
    const atr14 = atr14WonFromLogic ?? Math.max(1, price * 0.018)

    const low20FromLogic =
      typeof d?.low20Min === 'number' &&
      Number.isFinite(d.low20Min) &&
      d.low20Min > 0 &&
      d.low20Min < price
        ? d.low20Min
        : null
    const recentLow20 =
      low20FromLogic ??
      (quoteState.status === 'ok' ? (quoteState.data.low ?? price * 0.94) : price * 0.94)
    const atrDistanceAbs =
      typeof d?.atrGapValue === 'number' && Number.isFinite(d.atrGapValue)
        ? d.atrGapValue
        : parseAtrDistance(d?.atrGap)
    const entryPrice =
      quoteState.status === 'ok' && Number.isFinite(quoteState.data.change)
        ? price - quoteState.data.change
        : price
    const atrRatio = atr14 / price

    const stopV2 = calculateStopPriceV2({
      currentPrice: price,
      entryPrice,
      atr14,
      low20: recentLow20,
      rsi: rsi14,
      atrRatio,
    })

    const v2CandidatesList = stopV2.candidates.map((c) => ({
      method: c.basis,
      price: c.price,
      lossPct: Number(c.lossPct.toFixed(1)),
      valid: c.price < price && c.price > 0,
      reason: c.labelKr,
    }))

    const stopMethodForPanel: StopInfo['method'] =
      stopV2.basis === 'LOW20' ? 'RECENT_LOW' : (stopV2.basis as StopInfo['method'])

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
      stopPrice: stopV2.price,
    }

    const targetPriceResult = calculateTargetPrices(targetPriceInput)
    const t1m = targetPriceResult.targets.find((t) => t.label === '1M')
    const t3m = targetPriceResult.targets.find((t) => t.label === '3M')

    const rr0 = computeStrategyRiskRewardMetrics({
      stopLossPct: Number(stopV2.lossPct),
      firstTakeProfitPct: 9,
      firstTakeProfitSellPct: resolveFirstTakeProfitSellPct(rsi14, finalScore, supplyScore),
      finalTargetPct: 15,
      prob1M: t1m?.probability ?? 0,
      prob3M: t3m?.probability ?? 0,
    })

    const sectorBenchLogic = resolveSectorFundBench((liveStock.sector ?? '').trim())
    const qLogic = quoteState.status === 'ok' ? quoteState.data : null
    const entryInLogic: ExecutionStrategyInputs = {
      price,
      entryPrice,
      structureScore,
      executionScore,
      rsi14,
      atrDistanceAbs,
      atr14,
      weightedRiskReward: Number.isFinite(rr0.weightedRatio) ? rr0.weightedRatio : 0,
      consensusAvgTargetPrice: consensus?.avgTargetPrice ?? null,
      consensusMaxTargetPrice: consensus?.maxTargetPrice ?? null,
      recentLow20,
      sectorName: (liveStock.sector ?? '').trim(),
      operatingMarginTtmPct: qLogic?.operatingMarginTtm ?? null,
      operatingMarginYoYPp: null,
      forwardPer: valuationLiveModel?.valuationInputs.forwardPER ?? null,
      fiveYearAvgPer: sectorBenchLogic.per5y,
      epsGrowthYoYPct: valuationLiveModel?.valuationInputs.forwardEPSGrowthPct ?? null,
      trailingPer: typeof trailingPER === 'number' && Number.isFinite(trailingPER) ? trailingPER : null,
    }
    const entryBundleLogic = computeEntryDecisionBundle(entryInLogic)
    const entryKr = entryBundleLogic.decision
    const strategy = legacyStrategyFromEntryDecision(entryKr) as Strategy

    const threeMonthInput: ThreeMonthStrategyInput = {
      currentPrice: price,
      structureScore,
      finalScore,
      executionScore,
      supplyScore,
      rsi14,
      atrDistance: atrDistanceAbs,
      atr14,
      strategy,
      marketStatus,
      marketScore,
      riskRewardRatio: Number.isFinite(rr0.weightedRatio) ? rr0.weightedRatio : 0,
      supportPrice,
      consensusAvgTargetPrice: consensus?.avgTargetPrice ?? null,
      consensusMaxTargetPrice: consensus?.maxTargetPrice ?? null,
      recentLow20,
      entryPrice,
      sectorName: (liveStock.sector ?? '').trim(),
      operatingMarginTtmPct: qLogic?.operatingMarginTtm ?? null,
      operatingMarginYoYPp: null,
      forwardPer: valuationLiveModel?.valuationInputs.forwardPER ?? null,
      fiveYearAvgPer: sectorBenchLogic.per5y,
      epsGrowthYoYPct: valuationLiveModel?.valuationInputs.forwardEPSGrowthPct ?? null,
      trailingPer: typeof trailingPER === 'number' && Number.isFinite(trailingPER) ? trailingPER : null,
    }
    const threeMonthRaw = calculateThreeMonthStrategy(threeMonthInput)
    const threeMonth = {
      ...threeMonthRaw,
      stopPrice: stopV2.price,
      stopLossPct: Number(stopV2.lossPct),
      stopReason: stopV2.reason,
      stopPanelMethod: stopMethodForPanel,
      stopPanelCandidates: v2CandidatesList,
    }

    const riskRewardMetrics = computeStrategyRiskRewardMetrics({
      stopLossPct: threeMonth.stopLossPct,
      firstTakeProfitPct: threeMonth.firstTakeProfitPct,
      firstTakeProfitSellPct: threeMonth.firstTakeProfitSellPct,
      finalTargetPct: threeMonth.finalTargetPct,
      prob1M: t1m?.probability ?? 0,
      prob3M: t3m?.probability ?? 0,
    })

    const stop: StopInfo = {
      stopPrice: stopV2.price,
      stopLossPct: Number(stopV2.lossPct),
      method: stopMethodForPanel,
      basis: stopV2.basis,
      reason: stopV2.reason,
      candidates: v2CandidatesList,
    }

    const entryStage = legacyEntryStageFromEntryDecision(entryKr)

    const consecutiveRiseDays = parseConsecutiveRiseDays(d?.streak)
    const riskScore = Math.round(Math.max(12, Math.min(88, 72 - (finalScore - 60) * 0.35)))
    const executionInput: ExecutionInput = {
      currentPrice: price,
      finalScore,
      structureScore,
      executionScore,
      supplyScore,
      sectorFlowScore,
      valuationScore,
      consensusScore,
      momentumScore,
      marketScore,
      riskScore,
      rsi14,
      atr14,
      atrDistance: atrDistanceAbs,
      consecutiveRiseDays,
      stopPrice: threeMonth.stopPrice,
      stopLossPct: threeMonth.stopLossPct,
      riskRewardRatio: Number.isFinite(rr0.weightedRatio) ? rr0.weightedRatio : 0,
      strategy,
      entryStage,
      marketStatus,
    }
    const executionPlan = calculateExecutionPlan(executionInput)

    const briefingInput = {
      structureScore,
      executionScore,
      supplyScore,
      consensusScore,
      valuationScore,
      rsi14,
      atrDistance: atrDistanceAbs,
      marketStatus,
      marketLabel: d?.marketHeadline || d?.market || '',
      strategy,
      entryStage,
      threeMonthEntry: threeMonth.entryDecision,
      finalScore,
    }

    return {
      targetPriceResult,
      stop,
      riskRewardMetrics,
      threeMonth,
      executionPlan,
      briefingInput,
    }
  }, [logicState.data, liveStock.price, liveStock.sector, queryCode, quoteState, valuationLiveModel])

  const targetPricePanelResult = logicDerived?.targetPriceResult ?? null

  const targetPriceDisplayMode = useMemo(
    () =>
      resolveTargetPriceDisplayMode({
        entryStageTier: summaryInfo.executionUi.tier,
        entryStageLabel: summaryInfo.executionUi.entryStageLabel,
        strategy: summaryInfo.strategy,
        threeMonthEntryDecision: logicDerived?.threeMonth?.entryDecision,
        recommendedPositionPct: logicDerived?.threeMonth?.recommendedPositionPct ?? Number.NaN,
      }),
    [
      summaryInfo.executionUi.tier,
      summaryInfo.executionUi.entryStageLabel,
      summaryInfo.strategy,
      logicDerived?.threeMonth?.entryDecision,
      logicDerived?.threeMonth?.recommendedPositionPct,
    ],
  )

  const stopInfo = useMemo(() => {
    if (!logicDerived) return mockStopInfo
    return {
      stopPrice: logicDerived.stop.stopPrice,
      stopLossPct: logicDerived.stop.stopLossPct,
      method: logicDerived.stop.method,
      basis: logicDerived.stop.basis,
      reason: logicDerived.stop.reason,
      candidates: logicDerived.stop.candidates,
      warning: logicDerived.stop.warning,
    }
  }, [logicDerived])

  const logicIndicatorSlots = useMemo(() => buildLogicIndicatorGridSlots(liveMetrics), [liveMetrics])

  const chartData = useMemo(() => {
    if (chartState.status === 'ok' && chartState.mode === 'daily' && chartState.points.length) {
      return chartState.points.map((p) => ({ label: p.label, value: p.price }))
    }
    return [{ label: '—', value: liveStock.price }]
  }, [chartState, liveStock.price])

  const stockHeroChart = useMemo((): StockHeroChartProps => {
    return {
      timeframe: tf,
      onTimeframeChange: setTf,
      data: chartData,
      currentPrice: liveStock.price,
      dayChange: liveStock.change,
      status: chartState.status,
      errorMessage: chartState.status === 'error' ? chartState.message : undefined,
      intraday:
        chartState.status === 'ok' && chartState.mode === 'intraday' ? chartState.intraday : null,
      intradayInterval: intradayIv,
      onIntradayIntervalChange: setIntradayIv,
    }
  }, [tf, chartData, liveStock.price, liveStock.change, chartState, intradayIv])

  const heroStock = useMemo(() => {
    const subtitleParts = [liveStock.code, liveStock.market, liveStock.sector].filter(
      (s): s is string => Boolean(s && String(s).trim()),
    )
    return {
      code: liveStock.code,
      name: liveStock.name,
      subtitle: subtitleParts.join(' · '),
      market: liveStock.market,
      price: liveStock.price,
      change: liveStock.change,
      changePct: liveStock.changePercent,
    }
  }, [
    liveStock.code,
    liveStock.name,
    liveStock.market,
    liveStock.sector,
    liveStock.price,
    liveStock.change,
    liveStock.changePercent,
  ])

  const heroInsight = useMemo(() => {
    const score = executionUiBundle?.score ?? 55
    const letter = scoreToLetterGrade(score)
    const fundSig =
      logicDerived?.threeMonth?.fundamentalSignal ?? executionUiBundle?.fundamentalSignal
    const title = getHeadlineByStage(summaryInfo.executionUi.entryStageLabel, fundSig)

    const rsiRaw = logicState.data?.rsi
    const rsi = rsiRaw != null ? Number(String(rsiRaw).replace(/[^\d.]/g, '')) : Number.NaN
    const atrAbs =
      typeof logicState.data?.atrGapValue === 'number' && Number.isFinite(logicState.data.atrGapValue)
        ? logicState.data.atrGapValue
        : Number.NaN
    const reasonShort =
      logicDerived?.threeMonth?.entryReasonShort ??
      executionUiBundle?.entryReasonShort ??
      (Number.isFinite(rsi) && Number.isFinite(atrAbs)
        ? `RSI ${Math.round(rsi)} + ATR 이격 ${atrAbs.toFixed(1)}`
        : (() => {
            const first = summaryInfo.reason.split(' · ')[0]?.trim() || summaryInfo.reason
            return first.length > 80 ? `${first.slice(0, 77)}…` : first
          })())

    return {
      title,
      finalGrade: letter,
      finalGradeTone: letterGradeToTone(letter),
      strategy: summaryInfo.strategy,
      entryStageDisplay: summaryInfo.executionUi.entryStageLabel,
      entryStageEmphasis:
        summaryInfo.strategy === 'TAKE_PROFIT' || summaryInfo.entryStageCode === 'REJECT'
          ? ('danger' as const)
          : ('default' as const),
      reason: reasonShort,
    }
  }, [
    summaryInfo.reason,
    summaryInfo.strategy,
    summaryInfo.entryStageCode,
    summaryInfo.executionUi.entryStageLabel,
    executionUiBundle?.score,
    executionUiBundle?.entryReasonShort,
    executionUiBundle?.fundamentalSignal,
    logicDerived?.threeMonth?.entryReasonShort,
    logicDerived?.threeMonth?.fundamentalSignal,
    logicState.data,
  ])

  return (
    <main className="mx-auto min-w-0 max-w-6xl overflow-x-hidden px-4 py-8 sm:px-6 lg:px-8">
      <article className="overflow-visible rounded-2xl border border-default bg-card shadow-card">
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
          <div className="border-b border-default px-6 py-3 sm:px-8">
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
          <SpecialEventBanner
            messages={logicState.status === 'ok' ? (logicState.data.specialAlerts ?? []) : []}
          />
          <div className="border-b border-default px-6 py-5 sm:px-8">
          <ErrorBoundary>
            <StockHero stock={heroStock} insight={heroInsight} chart={stockHeroChart} />
          </ErrorBoundary>
          </div>

          {logicState.status === 'loading' ? (
            <p className="px-6 pt-4 text-xs text-secondary sm:px-8">로직 지표 계산 중...</p>
          ) : null}
          {logicState.status === 'error' ? (
            <p className="px-6 pt-4 text-xs text-warning-text sm:px-8">로직 지표 오류: {logicState.message}</p>
          ) : null}
          <IndicatorGrid slots={logicIndicatorSlots} subtitle={logicSubtitle} />
          <ExecutionStrategy
            strategy={logicDerived?.threeMonth ?? null}
            riskRewardMetrics={logicDerived?.riskRewardMetrics ?? null}
            executionPlan={logicDerived?.executionPlan ?? null}
            currentPrice={liveStock.price}
            loading={logicState.status === 'loading'}
          />
          <PriceTargets
            result={targetPricePanelResult}
            loading={logicState.status === 'loading' && !targetPricePanelResult}
            displayMode={targetPriceDisplayMode}
          />
          <StopPanel stop={stopInfo} />

          <footer className="border-t border-default px-6 py-4 sm:px-8">
            <p className="inline-flex items-center gap-2 rounded-md border border-default bg-neutral-bg px-3 py-1.5 text-xs text-secondary">
              <Info className="size-3.5 shrink-0" aria-hidden />
              {saveStatus}
              <span className="text-tertiary">·</span>
              <a href="/design-test" className="font-medium text-info-text underline">
                디자인 토큰
              </a>
            </p>
          </footer>
      </article>
    </main>
  )
}
