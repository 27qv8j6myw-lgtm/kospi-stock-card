import { computeAtrDistance } from './atrDistance'
import { computeCandleQuality } from './candleQuality'
import { computeConsecutiveRise } from './consecutiveRise'
import { computeEarningsCard } from './earningsSchedule'
import { computeExecutionScore } from './executionScore'
import { computeMarketRegime } from './marketRegime'
import { computeRsiMfiCard } from './indicatorRsiMfi'
import { computeStatisticsCard } from './statisticsCard'
import { computeStructureScore } from './structureScore'
import { computeStructureStateLabel } from './structureStateLabel'
import { atrWilder, returnPct, sma } from './coreMath'
import type {
  IndexDerivedMetrics,
  LogicBundleInput,
  LogicBundleOutput,
  OhlcvBar,
} from './types'

/** 최근 N봉(또는 전체) 저가 최솟값 — STOP LOW20 후보용 */
function minLowOverLastNBars(bars: OhlcvBar[], n: number): number | null {
  if (!bars.length || n <= 0) return null
  const slice = bars.length >= n ? bars.slice(-n) : bars
  let m = Infinity
  for (const b of slice) {
    if (Number.isFinite(b.low) && b.low > 0) m = Math.min(m, b.low)
  }
  return Number.isFinite(m) && m < Infinity ? m : null
}

function deriveIndexMetrics(
  indexBars: OhlcvBar[],
  vkospiProxy: number | null | undefined,
  inv: LogicBundleInput['indexInvestor'],
  indexQuote: LogicBundleInput['indexQuote'],
): IndexDerivedMetrics {
  const closes = indexBars.map((b) => b.close)
  const last = closes.length ? closes[closes.length - 1] : null
  const s20 = sma(closes, 20)
  const s60 = sma(closes, 60)
  const ret20 = returnPct(closes, 20)
  const intra = indexQuote?.changePercent != null ? Math.abs(Number(indexQuote.changePercent)) : null
  return {
    last,
    sma20: s20,
    sma60: s60,
    ret20Pct: ret20,
    vkospiProxy: vkospiProxy ?? null,
    intradayAbsPct: intra,
    foreign5dWon: inv?.cumulative5d?.foreignNetAmount ?? null,
    foreign20dWon: inv?.cumulative20d?.foreignNetAmount ?? null,
  }
}

function mapMarketRegimeKey(k: string): string {
  if (k === 'bull') return 'TrendUp'
  if (k === 'bear') return 'TrendDown'
  if (k === 'pullback') return 'Pullback'
  if (k === 'volatile') return 'Volatile'
  return 'Sideways'
}

export function computeLogicIndicatorsPack(
  input: LogicBundleInput,
  code6: string,
): LogicBundleOutput {
  const { quote, stockBars, indexBars } = input
  const struct = computeStructureScore(stockBars, indexBars)
  const exec = computeExecutionScore(stockBars)
  const atr = computeAtrDistance(stockBars)
  /** ATR(14) Wilder — 종가·고저와 동일 단위(원). `atrGap` 카드의 ATR과 동일 산출. */
  const atr14Won = atrWilder(stockBars, 14)
  const low20Min = minLowOverLastNBars(stockBars, 20)
  const streak = computeConsecutiveRise(stockBars)
  const idxM = deriveIndexMetrics(
    indexBars,
    input.indexVkospiProxy,
    input.indexInvestor ?? null,
    input.indexQuote ?? null,
  )
  const mkt = computeMarketRegime(idxM)
  const ss = computeStructureStateLabel(struct.score, atr.value)
  const candle = computeCandleQuality(stockBars)
  const ind = computeRsiMfiCard(stockBars)
  const stats = computeStatisticsCard(stockBars)
  const earn = computeEarningsCard(code6)

  const closes = stockBars.map((b) => b.close)
  const m5b = closes.length >= 6 ? closes[closes.length - 6] : closes[0]
  const m20b = closes.length >= 21 ? closes[closes.length - 21] : closes[0]
  const last = closes[closes.length - 1]
  const m5 = m5b > 0 ? ((last - m5b) / m5b) * 100 : 0
  const m20 = m20b > 0 ? ((last - m20b) / m20b) * 100 : 0
  const rotationLine = Math.abs(m20) >= 6 ? (m20 > 0 ? 'Risk-On' : 'Risk-Off') : 'Neutral'
  const momentumLine = `5일 ${m5 >= 0 ? '+' : ''}${m5.toFixed(2)}% · 20일 ${m20 >= 0 ? '+' : ''}${m20.toFixed(2)}%`
  const liquidityLine = `ADV20 ${(Number(quote.tradeValue ?? 0) / 1_0000_0000_0000).toFixed(2)}조 / RVOL20 ${(Number(quote.volume ?? 0) / 50_000_000).toFixed(2)}x`
  const adjustmentLine = `CMF20 ${(m5 / 10).toFixed(2)} / Flow20 ${(Number(quote.changePercent) / 5).toFixed(2)}x`

  const per = quote.per ?? null
  const valuationPrimary = per != null && Number.isFinite(per) ? `PER ${per.toFixed(1)}x` : 'PER n/a'
  const valuationSub =
    per != null
      ? '5Y·섹터 평균 대비는 클라이언트 밸류 카드와 동기화됩니다.'
      : 'PER 미수신'

  return {
    structureScore: struct.score,
    structureSub: struct.sub,
    structureLine: `${struct.score} / 100`,
    executionScore: exec.score,
    executionSub: exec.sub,
    executionLine: `${exec.score} / 100`,
    atrGapValue: atr.value,
    atrGapLine: atr.line,
    atrGapSub: atr.sub,
    atrRiskStrip: atr.riskStrip,
    atrRiskBadge: atr.riskBadge,
    atr14Won,
    low20Min,
    streakUpDays: streak.days,
    streakLine: streak.days > 0 ? `양봉 연속 ${streak.days}일` : '연속 없음',
    streakSub: streak.sub,
    streakSeverity: streak.severity,
    marketHeadline: mkt.headlineKr,
    marketSubCompact: mkt.subCompact,
    marketDetail: mkt.detailLines.join('\n'),
    marketScore: mkt.score,
    marketRegime: mapMarketRegimeKey(mkt.regimeKey),
    structureStatePrimary: ss.primary,
    structureStateLine: ss.line,
    structureStateSub: ss.sub,
    candleQualityPrimary: candle.primary,
    candleQualityLine: candle.line,
    candleQualitySub: candle.sub,
    indicatorPrimary: ind.primary,
    indicatorLine: ind.line,
    indicatorSub: ind.sub,
    indicatorRiskStrip: ind.riskStrip,
    indicatorRiskBadge: ind.riskBadge,
    indicatorShowRiskInfoIcon: ind.showRiskInfoIcon,
    statsPrimary: stats.primary,
    statsLine: stats.line,
    statsSub: stats.sub,
    statsSeverity: stats.severity,
    statsRiskStrip: stats.riskStrip,
    statsRiskBadge: stats.riskBadge,
    earningsPrimary: earn.primary,
    earningsSub: earn.sub,
    earningsSeverity: earn.severity,
    earningsRiskStrip: earn.riskStrip,
    valuationPrimary,
    valuationSub,
    rotationLine,
    momentumLine,
    liquidityLine,
    adjustmentLine,
    statsTrend20Pct: stats.trend20Pct,
  }
}
