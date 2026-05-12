import type { KISLogicIndicators } from '../hooks/useKisLogicIndicators'
import {
  calculateConsensusScore,
  calculateConsensusUpside,
  calculateFinalScore,
  calculateSupplyScore,
  calculateTargetPrices,
  calculateThreeMonthStrategy,
  calculateValuationScore,
  inferSectorFlowSnapshot,
  parseAtrDistance,
  parseMomentumScoreFromLogic,
  getStrategy,
} from './signalLogic'
import { getCurrentPrice } from './kis'
import { calculateScreeningScore } from './screenerRanking'
import { sectorDefinitions, type ScreenerSectorKey } from './sectorDefinitions'
import { sectorUniverse, type SectorStock } from './sectorUniverse'
import type { Strategy } from '../types/stock'

type QuoteLike = {
  code: string
  nameKr: string | null
  price: number
  per: number | null
}

const IT_COMPONENT_THEME_BY_STOCK: Record<string, string> = {
  삼성전기: 'MLCC·FC-BGA',
  LG이노텍: '카메라모듈·애플 공급망',
  대덕전자: '서버 PCB·FC-BGA',
  심텍: 'AI 서버 패키징 기판',
  코리아써키트: '고다층 PCB',
  해성디에스: '리드프레임·패키징',
  이수페타시스: 'AI 서버 기판·NVIDIA',
  비에이치: '스마트폰 FPCB',
  인터플렉스: '고부가 FPCB',
  파트론: '카메라모듈·RF',
  자화전자: '카메라 액추에이터',
  와이솔: 'RF 부품',
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

export type ScreenerStock = {
  code: string
  name: string
  sector: string
  currentPrice: number
  targetPrice1M: number
  expectedReturnPct: number
  probability1M: number
  finalScore: number
  structureScore: number
  executionScore: number
  supplyScore: number
  sectorFlowScore: number
  consensusUpsidePct: number
  valuationScore: number
  marketScore: number
  screeningScore: number
  rsi14: number
  atrDistance: number
  recommendedWeightPct: number
  aiOneLine: string
  aiWhyNow?: string
  aiRisk?: string
  aiStrategy?: string
}

export type ScreenerSectorResult = {
  key: ScreenerSectorKey
  label: string
  isLeading: boolean
  leaderNote: string
  stocks: ScreenerStock[]
}

export type ScreenerResult = {
  sectors: ScreenerSectorResult[]
  top5: ScreenerStock[]
}

async function fetchLogicIndicators(code: string): Promise<KISLogicIndicators | null> {
  const res = await fetch(`/api/logic-indicators?code=${encodeURIComponent(code)}`)
  if (!res.ok) return null
  const json = await res.json()
  return (json?.logicIndicators || null) as KISLogicIndicators | null
}

function parseScoreText(v: string | undefined, fallback = 55): number {
  const n = Number(String(v || '').split('/')[0].replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : fallback
}

function marketScoreFromText(market: string | undefined) {
  if (!market) return 58
  if (market.includes('Risk-On')) return 78
  if (market.includes('Caution')) return 42
  return 60
}

function fallbackOneLine(stock: {
  name: string
  sector: string
  finalScore: number
  structureScore: number
  executionScore: number
  supplyScore: number
  sectorFlowScore: number
  consensusUpsidePct: number
  rsi14: number
  atrDistance: number
}) {
  if (stock.sector.includes('IT부품')) {
    const theme = IT_COMPONENT_THEME_BY_STOCK[stock.name] || 'AI 서버·고부가 기판'
    const riskIt =
      stock.rsi14 >= 78
        ? '다만 단기 과열 구간이라 눌림 확인이 필요'
        : '수급이 유지되면 상대강도 지속 가능성이 큽니다'
    return `${stock.name}은 ${theme} 테마가 부각되는 구간이며, ${riskIt}.`
  }
  const positives: string[] = []
  if (stock.structureScore >= 75) positives.push('추세 구조가 견조')
  if (stock.supplyScore >= 62) positives.push('외국인·기관 수급이 우호적')
  if (stock.sectorFlowScore >= 70) positives.push('섹터 자금 유입이 강함')
  if (stock.consensusUpsidePct >= 12) positives.push(`컨센서스 상승여력 ${stock.consensusUpsidePct.toFixed(1)}%`)
  if (stock.executionScore >= 65) positives.push('진입/관리 타이밍 점수가 양호')

  const risk =
    stock.rsi14 >= 78
      ? '단기 과열 구간이라 눌림 확인이 필요'
      : stock.atrDistance >= 3.2
        ? '변동성 확대 구간이라 분할 접근이 유리'
        : '추세 훼손 전까지는 우상향 시나리오가 유효'

  const core = positives.slice(0, 2).join(', ')
  if (core) return `${stock.name}은 ${stock.sector} 내에서 ${core}한 상태이며, ${risk}합니다.`
  return `${stock.name}은 ${stock.sector} 내에서 점수 균형은 보통이지만, ${risk}합니다.`
}

async function buildStock(
  sectorLabel: string,
  stock: SectorStock,
): Promise<ScreenerStock | null> {
  try {
    const [quote, logic] = await Promise.all([getCurrentPrice(stock.code), fetchLogicIndicators(stock.code)])
    const q = quote as QuoteLike
    const structureScore = parseScoreText(logic?.structure, 60)
    const executionScore = parseScoreText(logic?.execution, 55)
    const rsi14 = Number(String(logic?.rsi || '').replace(/[^\d.]/g, '')) || 52
    const atrDistance = parseAtrDistance(logic?.atrGap)
    const marketScore = marketScoreFromText(logic?.market)
    const supplyScore = calculateSupplyScore({
      foreignNetAmount3D: logic?.supplyDetails?.foreignNetAmount3D ?? 0,
      institutionNetAmount3D: logic?.supplyDetails?.institutionNetAmount3D ?? 0,
      retailNetAmount3D: logic?.supplyDetails?.retailNetAmount3D ?? 0,
      foreignNetAmount5D: logic?.supplyDetails?.foreignNetAmount5D ?? null,
      institutionNetAmount5D: logic?.supplyDetails?.institutionNetAmount5D ?? null,
      retailNetAmount5D: logic?.supplyDetails?.retailNetAmount5D ?? null,
    })
    const sectorFlowBase = inferSectorFlowSnapshot({
      sectorName: sectorLabel,
      supplyScore,
      rotationLine: logic?.rotation,
      momentumLine: logic?.momentum,
    }).sectorFlowScore
    const consensus = logic?.consensusDetails
    const consensusScore =
      consensus?.avgTargetPrice && consensus?.maxTargetPrice
        ? calculateConsensusScore({
            currentPrice: q.price,
            avgTargetPrice: consensus.avgTargetPrice,
            maxTargetPrice: consensus.maxTargetPrice,
            analystCount: consensus.analystCount ?? 1,
            lastConsensusUpdateDays: consensus.lastUpdateDays ?? 7,
          })
        : 55
    const consensusUpsidePct =
      consensus?.avgTargetPrice && consensus?.maxTargetPrice
        ? calculateConsensusUpside(q.price, consensus.avgTargetPrice, consensus.maxTargetPrice).avgUpsidePct
        : 8
    const itThemeBonus =
      sectorLabel.includes('IT부품') && IT_COMPONENT_THEME_BY_STOCK[q.nameKr || stock.name] ? 5 : 0
    const reportBonus = consensusUpsidePct >= 12 ? 5 : 0
    const flowBonus = supplyScore >= 60 ? 5 : 0
    const sectorFlowScore = clamp(sectorFlowBase + itThemeBonus + reportBonus + flowBonus, 0, 100)
    const valuationScore =
      typeof q.per === 'number' && Number.isFinite(q.per)
        ? calculateValuationScore({
            trailingPER: q.per,
            forwardPER: q.per,
            forwardEPSGrowthPct: 0,
            sectorAveragePER: q.per,
            historicalPERPercentile: 50,
          })
        : 52
    const momentumScore = parseMomentumScoreFromLogic(logic?.momentum, rsi14)
    const finalScore = calculateFinalScore({
      structure: structureScore,
      execution: executionScore,
      supply: supplyScore,
      sectorFlow: sectorFlowScore,
      consensus: consensusScore,
      valuation: valuationScore,
      momentum: momentumScore,
      market: marketScore,
      news: 60,
    })

    const targets = calculateTargetPrices({
      currentPrice: q.price,
      atr14: Math.round(q.price * 0.018),
      atrPct: 1.8,
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
      supportPrice: Math.round(q.price * 0.95),
      recentHigh20: Math.round(q.price * 1.06),
      recentHigh60: Math.round(q.price * 1.12),
      consensusAvgTargetPrice: consensus?.avgTargetPrice || undefined,
      consensusMaxTargetPrice: consensus?.maxTargetPrice || undefined,
      marketStatus: marketScore >= 70 ? 'RiskOn' : marketScore <= 45 ? 'Caution' : 'Neutral',
    })
    const oneMonth = targets.targets.find((r) => r.label === '1M') ?? targets.targets[1]
    const tm = calculateThreeMonthStrategy({
      currentPrice: q.price,
      finalScore,
      executionScore,
      supplyScore,
      rsi14,
      atrDistance,
      atr14: Math.round(q.price * 0.018),
      strategy: getStrategy(finalScore, rsi14, executionScore) as Strategy,
      marketStatus: marketScore >= 70 ? 'RiskOn' : marketScore <= 45 ? 'Caution' : 'Neutral',
      marketScore,
      riskRewardRatio: 2,
      supportPrice: Math.round(q.price * 0.95),
      consensusAvgTargetPrice: consensus?.avgTargetPrice ?? null,
      consensusMaxTargetPrice: consensus?.maxTargetPrice ?? null,
    })
    const screeningScore = calculateScreeningScore({
      finalScore,
      executionScore,
      supplyScore,
      sectorFlowScore,
      consensusUpsidePct,
      valuationScore,
      marketScore,
      rsi14,
      atrDistance,
    })

    const base: ScreenerStock = {
      code: stock.code,
      name: q.nameKr || stock.name,
      sector: sectorLabel,
      currentPrice: q.price,
      targetPrice1M: oneMonth.targetPrice,
      expectedReturnPct: oneMonth.expectedReturnPct,
      probability1M: oneMonth.probability,
      finalScore,
      structureScore,
      executionScore,
      supplyScore,
      sectorFlowScore,
      consensusUpsidePct,
      valuationScore,
      marketScore,
      screeningScore,
      rsi14,
      atrDistance,
      recommendedWeightPct: tm.recommendedPositionPct,
      aiOneLine: fallbackOneLine({
        name: q.nameKr || stock.name,
        sector: sectorLabel,
        finalScore,
        structureScore,
        executionScore,
        supplyScore,
        sectorFlowScore,
        consensusUpsidePct,
        rsi14,
        atrDistance,
      }),
    }
    return base
  } catch {
    return null
  }
}

export async function runSectorScreener(): Promise<ScreenerResult> {
  const sectors: ScreenerSectorResult[] = []
  for (const sector of sectorDefinitions) {
    const universe = sectorUniverse[sector.key] || []
    const built = await Promise.all(universe.map((s) => buildStock(sector.label, s)))
    const picks = built
      .filter((x): x is ScreenerStock => Boolean(x))
      .sort((a, b) => b.screeningScore - a.screeningScore)
      .slice(0, 3)
    const avgFlow = picks.length
      ? picks.reduce((acc, s) => acc + s.sectorFlowScore, 0) / picks.length
      : 0
    const topScore = picks[0]?.screeningScore ?? 0
    const isLeading = avgFlow >= 68 || topScore >= 80
    const leaderNote = isLeading
      ? `주도 자금 유입(흐름 ${avgFlow.toFixed(0)})`
      : `순환 후보(흐름 ${avgFlow.toFixed(0)})`
    sectors.push({ key: sector.key, label: sector.label, isLeading, leaderNote, stocks: picks })
  }

  const top5 = sectors
    .flatMap((s) => s.stocks)
    .sort((a, b) => b.screeningScore - a.screeningScore)
    .slice(0, 5)
  return { sectors, top5 }
}
