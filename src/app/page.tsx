import { useEffect, useMemo, useState } from 'react'
import { Info } from 'lucide-react'
import { ExecutionStrategy } from '../components/ExecutionStrategy'
import { MainStockCard } from '../components/MainStockCard'
import { MetricGrid } from '../components/MetricGrid'
import { PriceChart } from '../components/PriceChart'
import { StockNameSearch } from '../components/StockNameSearch'
import { StockHeader } from '../components/StockHeader'
import { StopPanel } from '../components/StopPanel'
import { SummaryPanel } from '../components/SummaryPanel'
import { TargetPricePanel } from '../components/TargetPricePanel'
import { useKisChart } from '../hooks/useKisChart'
import { useKisLogicIndicators } from '../hooks/useKisLogicIndicators'
import { useKisQuote } from '../hooks/useKisQuote'
import {
  executionCards,
  logicMetrics,
  saveStatus,
  stockInfo,
  stopInfo as mockStopInfo,
} from '../lib/mockData'
import {
  calculateConsensusScore,
  calculateConsensusUpside,
  calculateExecutionPlan,
  calculateRiskReward,
  calculateSupplyScore,
  calculateValuationScore,
  formatKrwAmountToEok,
  calculateFinalScore,
  calculateStopPrice,
  calculateTargetPrices,
  getEntryStage,
  getFinalGrade,
  getStrategy,
} from '../lib/signalLogic'
import { generateMetricSummary } from '../lib/summaryLogic'
import type { ExecutionCard, ExecutionInput, LogicMetric, Timeframe } from '../types/stock'
import type { TargetStopInput } from '../types/stock'

export default function Page() {
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
    const structure = Number(logicState.data?.structure?.split('/')[0]?.trim() || 72)
    const execution = Number(logicState.data?.execution?.split('/')[0]?.trim() || 10)
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
    const foreignNetAmount = logicState.data?.supplyDetails?.foreignNetAmount ?? 0
    const institutionNetAmount = logicState.data?.supplyDetails?.institutionNetAmount ?? 0
    const retailNetAmount = logicState.data?.supplyDetails?.retailNetAmount ?? -(foreignNetAmount + institutionNetAmount)
    const supplyScore = calculateSupplyScore({
      foreignNetAmount,
      institutionNetAmount,
      retailNetAmount,
      volumeTrendScore: 62,
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
    const score = calculateFinalScore({
      structure,
      execution,
      supply: supplyScore,
      rotation: 58,
      consensus: consensusScore,
      valuation: valuationScore,
      momentum: 45,
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
        `수급은 외국인 ${formatKrwAmountToEok(foreignNetAmount)}, 기관 ${formatKrwAmountToEok(institutionNetAmount)}로 우호적입니다`,
      )
    } else if (supplyScore <= 45) {
      detailParts.push(
        `수급은 외국인 ${formatKrwAmountToEok(foreignNetAmount)}, 기관 ${formatKrwAmountToEok(institutionNetAmount)}로 부담 구간입니다`,
      )
    } else {
      detailParts.push('수급은 뚜렷한 방향성 없이 중립입니다')
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
  }, [logicState.data, quoteState, liveStock.price])

  const metricSummary = useMemo(() => {
    const d = logicState.data
    const structureScore = Number(d?.structure?.split('/')[0]?.trim() || 60)
    const executionScore = Number(d?.execution?.split('/')[0]?.trim() || 50)
    const supplyScore = Number(d?.flow?.match(/-?\d+(\.\d+)?/)?.[0] || 52)
    const foreignNetAmount = d?.supplyDetails?.foreignNetAmount ?? 0
    const institutionNetAmount = d?.supplyDetails?.institutionNetAmount ?? 0
    const retailNetAmount = -(foreignNetAmount + institutionNetAmount)
    const computedSupplyScore = calculateSupplyScore({
      foreignNetAmount,
      institutionNetAmount,
      retailNetAmount,
      volumeTrendScore: 62,
    })
    const rotationScore = Number(d?.rotation?.match(/-?\d+(\.\d+)?/)?.[0] || 58)
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
    const finalScore =
      summaryInfo.finalGrade === 'A'
        ? 86
        : summaryInfo.finalGrade === 'B+'
          ? 78
          : summaryInfo.finalGrade === 'B'
            ? 68
            : 58
    const rsi14 = Number(d?.rsi?.replace(/[^\d.]/g, '') || 50)
    const atrDistance = Number(d?.atrGap?.replace(/[^\d.]/g, '') || 1.8)
    const consecutiveRiseDays = Number(d?.streak?.replace(/[^\d]/g, '') || 0)
    const strategy = (summaryInfo.strategy || 'HOLD') as
      | 'BUY'
      | 'HOLD'
      | 'WATCH_ONLY'
      | 'TAKE_PROFIT'
      | 'REJECT'
    const entryStage =
      summaryInfo.entryStage === '신규진입'
        ? 'ACCEPT'
        : summaryInfo.entryStage === '관망'
          ? 'WATCH'
          : summaryInfo.entryStage === 'REJECT'
            ? 'REJECT'
            : 'CAUTION'

    return generateMetricSummary({
      finalScore,
      structureScore,
      executionScore,
      supplyScore: computedSupplyScore || supplyScore,
      rotationScore,
      consensusScore,
      valuationScore,
      foreignNetAmount,
      institutionNetAmount,
      retailNetAmount,
      indicatorScore,
      candleQualityScore,
      marketScore,
      rsi14,
      atrDistance,
      consecutiveRiseDays,
      strategy,
      entryStage,
    })
  }, [logicState.data, summaryInfo.finalGrade, summaryInfo.strategy, summaryInfo.entryStage, liveStock.price, quoteState])

  const liveMetrics: LogicMetric[] = useMemo(() => {
    const d = logicState.data
    if (!d) return logicMetrics
    const foreignNetShares = d.supplyDetails?.foreignNetShares ?? 0
    const institutionNetShares = d.supplyDetails?.institutionNetShares ?? 0
    const retailNetShares = d.supplyDetails?.retailNetShares ?? -(foreignNetShares + institutionNetShares)
    const foreignNetAmount = d.supplyDetails?.foreignNetAmount ?? 0
    const institutionNetAmount = d.supplyDetails?.institutionNetAmount ?? 0
    const retailNetAmount = d.supplyDetails?.retailNetAmount ?? -(foreignNetAmount + institutionNetAmount)
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
    return [
      { title: '구조', value: d.structure || '데이터 없음', score: structureScore, descriptionKey: 'structure', icon: 'Layers', tone: 'blue' },
      { title: '실행', value: d.execution || '데이터 없음', score: executionScore, descriptionKey: 'execution', icon: 'Zap', tone: 'violet' },
      { title: 'ATR 이격', value: d.atrGap || '데이터 없음', score: 60, descriptionKey: 'atrDistance', icon: 'Ruler', tone: 'amber' },
      { title: '연속상승', value: d.streak || '데이터 없음', score: 62, descriptionKey: 'consecutiveRise', icon: 'TrendingUp', tone: 'sky' },
      { title: '시장', value: d.market || '데이터 없음', score: marketScore, descriptionKey: 'market', icon: 'Globe2', tone: 'emerald' },
      { title: '로테이션', value: d.rotation || '데이터 없음', score: 58, descriptionKey: 'rotation', icon: 'RefreshCw', tone: 'indigo' },
      { title: '구조 상태', value: d.structureState || '데이터 없음', score: structureScore, descriptionKey: 'structure', icon: 'Map', tone: 'orange' },
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
          supplyPeriod: '금일 실시간',
        },
        score: calculateSupplyScore({
          foreignNetAmount,
          institutionNetAmount,
          retailNetAmount,
          volumeTrendScore: 62,
        }),
        descriptionKey: 'supply',
        icon: 'Users',
        tone: 'cyan',
      },
      {
        title: '컨센서스',
        value:
          consensus?.avgTargetPrice && consensus?.maxTargetPrice
            ? `평균 ${consensus.avgTargetPrice.toLocaleString('ko-KR')}원 / 최고 ${consensus.maxTargetPrice.toLocaleString('ko-KR')}원`
            : '데이터 없음',
        subValue:
          consensusUpside != null
            ? `평균 ${consensusUpside.avgUpsidePct >= 0 ? '+' : ''}${consensusUpside.avgUpsidePct.toFixed(1)}% / 최고 ${consensusUpside.maxUpsidePct >= 0 ? '+' : ''}${consensusUpside.maxUpsidePct.toFixed(1)}%`
            : '외부 컨센서스 데이터 미수신',
        meta:
          consensus?.recommendationScore != null || consensus?.recommendationText
            ? `투자의견 ${consensus.recommendationScore?.toFixed(2) ?? '-'} (${consensus.recommendationText ?? '-'}) · 출처 네이버 금융`
            : '출처 네이버 금융',
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
  }, [logicState.data, liveStock.price])

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

  const executionData: ExecutionCard[] = useMemo(() => {
    const score = summaryInfo.finalGrade === 'A' ? 86 : summaryInfo.finalGrade === 'B+' ? 78 : 68
    const input: TargetStopInput = {
      currentPrice: liveStock.price,
      atr14: Math.max(1, liveStock.price * 0.018),
      rsi14: Number(logicState.data?.rsi?.replace(/[^\d.]/g, '') || 50),
      finalScore: score,
      structureScore: Number(logicState.data?.structure?.split('/')[0]?.trim() || 70),
      executionScore: Number(logicState.data?.execution?.split('/')[0]?.trim() || 40),
      supportPrice: quoteState.status === 'ok' ? (quoteState.data.low ?? liveStock.price * 0.95) : liveStock.price * 0.95,
      resistancePrice: quoteState.status === 'ok' ? (quoteState.data.high ?? liveStock.price * 1.02) : liveStock.price * 1.02,
      recentHigh20: quoteState.status === 'ok' ? (quoteState.data.high ?? liveStock.price * 1.03) : liveStock.price * 1.03,
      recentLow20: quoteState.status === 'ok' ? (quoteState.data.low ?? liveStock.price * 0.94) : liveStock.price * 0.94,
      marketStatus:
        logicState.data?.market?.includes('Caution')
          ? 'Caution'
          : logicState.data?.market?.includes('Risk-On')
            ? 'RiskOn'
            : 'Neutral',
    }
    const stop = calculateStopPrice(input)
    const targets = calculateTargetPrices(input)
    const oneMonth = targets.find((t) => t.horizon === '1M')?.targetPrice ?? input.currentPrice
    const rr = calculateRiskReward(input.currentPrice, stop.stopPrice, oneMonth)
    const strategy = (summaryInfo.strategy || 'HOLD') as ExecutionInput['strategy']
    const entryStage: ExecutionInput['entryStage'] =
      summaryInfo.entryStage === '신규진입'
        ? 'ACCEPT'
        : summaryInfo.entryStage === '관망'
          ? 'WATCH'
          : summaryInfo.entryStage === 'REJECT'
            ? 'REJECT'
            : summaryInfo.entryStage === '보유'
              ? 'CAUTION'
              : 'WATCH'
    const plan = calculateExecutionPlan({
      currentPrice: input.currentPrice,
      finalScore: score,
      structureScore: input.structureScore,
      executionScore: input.executionScore,
      supplyScore: 42,
      momentumScore: 45,
      riskScore: 64,
      rsi14: input.rsi14,
      atr14: input.atr14,
      stopPrice: stop.stopPrice,
      stopLossPct: stop.stopLossPct,
      riskRewardRatio: rr.ratio,
      marketStatus: input.marketStatus,
      strategy,
      entryStage,
      accountSize: 50_000_000,
    })
    return [
      { title: '추천 비중', value: `${plan.recommendedPositionPct}%`, hint: plan.action },
      {
        title: '1R 손실금',
        value: `${stop.stopLossPct.toFixed(2)}%, ${(stop.stopPrice - input.currentPrice).toLocaleString('ko-KR')}원`,
        hint: plan.riskAmountWon
          ? `계좌 리스크 ${plan.riskAmountPct}% · ${plan.riskAmountWon.toLocaleString('ko-KR')}원`
          : `계좌 리스크 ${plan.riskAmountPct}%`,
      },
      { title: '기본 실행', value: `${plan.timeStop} / ${plan.stopRule} / ${plan.takeProfitRule}` },
      { title: '최대 비중', value: `${plan.maxPositionPct}% · R/R ${rr.ratio} (${rr.verdict})`, hint: plan.summary },
    ]
  }, [summaryInfo.finalGrade, liveStock.price, logicState.data, quoteState])

  const targets = useMemo(() => {
    const score = summaryInfo.finalGrade === 'A' ? 86 : summaryInfo.finalGrade === 'B+' ? 78 : 68
    const input: TargetStopInput = {
      currentPrice: liveStock.price,
      atr14: Math.max(1, liveStock.price * 0.018),
      rsi14: Number(logicState.data?.rsi?.replace(/[^\d.]/g, '') || 50),
      finalScore: score,
      structureScore: Number(logicState.data?.structure?.split('/')[0]?.trim() || 70),
      executionScore: Number(logicState.data?.execution?.split('/')[0]?.trim() || 40),
      supportPrice: quoteState.status === 'ok' ? (quoteState.data.low ?? liveStock.price * 0.95) : liveStock.price * 0.95,
      resistancePrice: quoteState.status === 'ok' ? (quoteState.data.high ?? liveStock.price * 1.02) : liveStock.price * 1.02,
      recentHigh20: quoteState.status === 'ok' ? (quoteState.data.high ?? liveStock.price * 1.03) : liveStock.price * 1.03,
      recentLow20: quoteState.status === 'ok' ? (quoteState.data.low ?? liveStock.price * 0.94) : liveStock.price * 0.94,
      marketStatus:
        logicState.data?.market?.includes('Caution')
          ? 'Caution'
          : logicState.data?.market?.includes('Risk-On')
            ? 'RiskOn'
            : 'Neutral',
    }
    return calculateTargetPrices(input)
  }, [liveStock.price, summaryInfo.finalGrade, logicState.data, quoteState])

  const stopInfo = useMemo(() => {
    if (quoteState.status !== 'ok') return mockStopInfo
    const score = summaryInfo.finalGrade === 'A' ? 86 : summaryInfo.finalGrade === 'B+' ? 78 : 68
    const input: TargetStopInput = {
      currentPrice: quoteState.data.price,
      atr14: Math.max(1, quoteState.data.price * 0.018),
      rsi14: Number(logicState.data?.rsi?.replace(/[^\d.]/g, '') || 50),
      finalScore: score,
      structureScore: Number(logicState.data?.structure?.split('/')[0]?.trim() || 70),
      executionScore: Number(logicState.data?.execution?.split('/')[0]?.trim() || 40),
      supportPrice: quoteState.data.low ?? quoteState.data.price * 0.95,
      resistancePrice: quoteState.data.high ?? quoteState.data.price * 1.02,
      recentHigh20: quoteState.data.high ?? quoteState.data.price * 1.03,
      recentLow20: quoteState.data.low ?? quoteState.data.price * 0.94,
      marketStatus:
        logicState.data?.market?.includes('Caution')
          ? 'Caution'
          : logicState.data?.market?.includes('Risk-On')
            ? 'RiskOn'
            : 'Neutral',
    }
    const stop = calculateStopPrice(input)
    return {
      stopPrice: stop.stopPrice,
      stopLossPct: stop.stopLossPct,
      method: stop.method,
      supportPrice: stop.supportPrice,
    }
  }, [quoteState, summaryInfo.finalGrade, logicState.data])

  const chartData = useMemo(() => {
    return chartState.points.length
      ? chartState.points.map((p) => ({ label: p.label, value: p.price }))
      : [{ label: '—', value: liveStock.price }]
  }, [chartState.points, liveStock.price])

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <article className="overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm">
        <StockHeader
          title="Signal15"
          subtitle=""
          asOfDate={liveStock.asOfDate}
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

        <div className="grid grid-cols-1 md:grid-cols-2">
          <SummaryPanel summary={summaryInfo} metricSummary={metricSummary} />
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

        {logicState.status === 'loading' ? (
          <p className="px-6 pt-4 text-xs text-slate-500 sm:px-8">로직 지표 계산 중...</p>
        ) : null}
        {logicState.status === 'error' ? (
          <p className="px-6 pt-4 text-xs text-amber-700 sm:px-8">로직 지표 오류: {logicState.message}</p>
        ) : null}
        <MetricGrid metrics={liveMetrics} subtitle={logicSubtitle} />
        <ExecutionStrategy cards={executionData.length ? executionData : executionCards} />
        <TargetPricePanel targets={targets} />
        <StopPanel stop={stopInfo} />

        <footer className="border-t border-slate-200 px-6 py-4 sm:px-8">
          <p className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
            <Info className="size-3.5" />
            {saveStatus}
          </p>
        </footer>
      </article>
    </main>
  )
}
