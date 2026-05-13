import { buildScoringInput } from './buildScoringInput.mjs'
import { screeningStockNameKr } from './sectorMaster.mjs'
import {
  inquireChartByTimeframe,
  inquireDomesticPrice,
  inquireInvestorByStock,
  chartPointsToReturnPct,
} from '../kisClient.mjs'
import { computeLogicIndicatorsPack } from '../indicators/logicBundle.mjs'

function barsFromKisChart(chart) {
  if (!Array.isArray(chart)) return []
  return chart.map((p) => ({
    ts: String(p.ts ?? ''),
    open: Number(p.open ?? p.price) || 0,
    high: Number(p.high ?? p.price) || 0,
    low: Number(p.low ?? p.price) || 0,
    close: Number(p.price) || 0,
    volume: Math.max(0, Number(p.volume ?? 0)),
  }))
}

function sectorReturn5DFromDaily(dailyChart) {
  const pts = Array.isArray(dailyChart) ? dailyChart.slice(-6) : []
  return chartPointsToReturnPct(pts)
}

/**
 * @param {string} appKey
 * @param {string} appSecret
 * @param {'prod'|'vps'} env
 * @param {string} code6
 * @param {{ indexChart: unknown[], indexQuote: object|null, indexInvestor: object|null }} indexCtx
 */
export async function scoreSingleStock(appKey, appSecret, env, code6, indexCtx) {
  const code = String(code6).replace(/\D/g, '').padStart(6, '0')

  const input = await buildScoringInput(appKey, appSecret, env, code, { dailyBars: 90 })
  const stockBars = barsFromKisChart(input.dailyChart)
  const indexBars = barsFromKisChart(Array.isArray(indexCtx.indexChart) ? indexCtx.indexChart : [])

  const bi = input.basicInfo
  const raw = bi.raw && typeof bi.raw === 'object' ? bi.raw : {}
  const nameFromRaw = String(raw.hts_kor_isnm || raw.hts_kor_isnm1 || raw.prdt_name || '').trim()

  if (process.env.SCREENING_DEBUG_BASICINFO === '1') {
    console.log(`[Screening] ${code} basicInfo:`, {
      stockName: bi.stockName,
      nameKr: bi.nameKr,
      hts_kor_isnm: raw.hts_kor_isnm,
      hts_kor_isnm1: raw.hts_kor_isnm1,
      prdt_name: raw.prdt_name,
    })
  }

  const fromStockName = typeof bi.stockName === 'string' ? bi.stockName.trim() : ''
  const fromNameKr = typeof bi.nameKr === 'string' ? bi.nameKr.trim() : ''
  const fromApi = fromStockName || fromNameKr || nameFromRaw
  const onlySixDigits = /^\d{6}$/.test(String(fromApi).replace(/\s/g, ''))
  const nameLooksLikeCodeOnly = !fromApi || String(fromApi).trim() === code || onlySixDigits
  const displayName = nameLooksLikeCodeOnly ? screeningStockNameKr(code) || code : String(fromApi).trim()

  const quote = {
    price: Number(bi.price) || 0,
    changePercent: Number(bi.changePercent) || 0,
    volume: Number(bi.volume) || 0,
    tradeValue: bi.tradeValue != null ? Number(bi.tradeValue) : undefined,
    per: bi.per != null ? Number(bi.per) : null,
  }

  const idxChange =
    indexCtx.indexQuote?.changePercent != null && Number.isFinite(Number(indexCtx.indexQuote.changePercent))
      ? Number(indexCtx.indexQuote.changePercent)
      : null

  const closes = indexBars.map((b) => b.close).filter((n) => Number.isFinite(n) && n > 0)
  const rets = []
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) rets.push((closes[i] - closes[i - 1]) / closes[i - 1])
  }
  let vk = null
  if (rets.length >= 20) {
    const std = stddevSample(rets.slice(-20))
    vk = std * Math.sqrt(252) * 100
  } else if (rets.length >= 5) {
    const std = stddevSample(rets)
    vk = std * Math.sqrt(252) * 100
  }

  const pack = computeLogicIndicatorsPack(
    {
      quote,
      stockBars,
      indexBars,
      indexVkospiProxy: vk,
      indexInvestor: indexCtx.indexInvestor ?? null,
      indexQuote: idxChange != null ? { changePercent: idxChange } : null,
    },
    code,
  )

  const structureScore = Number(pack.structureScore) || 0
  const executionScore = Number(pack.executionScore) || 0
  const marketScore = Number(pack.marketScore) || 0

  const totalScore = Math.round(
    Math.max(0, Math.min(100, structureScore * 0.38 + executionScore * 0.37 + marketScore * 0.25)),
  )

  let expected1MPct = 0
  if (totalScore >= 90) expected1MPct = 18
  else if (totalScore >= 80) expected1MPct = 12
  else if (totalScore >= 70) expected1MPct = 7
  else if (totalScore >= 60) expected1MPct = 3

  const sectorReturn5D = sectorReturn5DFromDaily(input.dailyChart)

  const rsiFromLine = parseRsiFromIndicatorLine(pack.indicatorLine)
  const atrWon = pack.atrGapValue != null && Number.isFinite(Number(pack.atrGapValue)) ? Number(pack.atrGapValue) : 0
  const atrGapPct = bi.price > 0 && atrWon > 0 ? (atrWon / bi.price) * 100 : 0
  const c3 = input.investorTrading?.cumulative3d
  const f3 = Number(c3?.foreignNetAmount) || 0
  const i3 = Number(c3?.institutionNetAmount) || 0
  let supplyDemandScore = 50
  if (f3 > 0 && i3 > 0) supplyDemandScore = 68
  else if (f3 < 0 && i3 < 0) supplyDemandScore = 36
  else if (f3 > 0 || i3 > 0) supplyDemandScore = 58
  else if (f3 < 0 || i3 < 0) supplyDemandScore = 44

  return {
    code,
    name: displayName,
    sector: String(bi.sector || '').trim(),
    sectorId: '',
    sectorLabel: '',
    totalScore,
    subScores: {
      structure: structureScore,
      execution: executionScore,
      market: marketScore,
      rsi: rsiFromLine ?? 0,
      atrGap: Math.round(atrGapPct * 10) / 10,
      supplyDemand: supplyDemandScore,
    },
    expected1MPct,
    currentPrice: Number(bi.price) || 0,
    changePct: Number(bi.changePercent) || 0,
    sectorReturn5D,
    entryStage: String(pack.structureStatePrimary || pack.structureStateLine || '—').slice(0, 120),
    supplyDemand3D: {
      foreign: c3?.foreignNetAmount ?? 0,
      institution: c3?.institutionNetAmount ?? 0,
    },
    per: bi.per != null && Number.isFinite(Number(bi.per)) ? Number(bi.per) : 0,
    operatingMargin:
      bi.operatingMarginTtm != null && Number.isFinite(Number(bi.operatingMarginTtm))
        ? Number(bi.operatingMarginTtm)
        : 0,
    consensusUpside: 0,
  }
}

function parseRsiFromIndicatorLine(line) {
  const m = String(line || '').match(/RSI[^0-9]*([\d.]+)/i)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

function stddevSample(arr) {
  if (!arr.length) return 0
  const m = arr.reduce((a, b) => a + b, 0) / arr.length
  const v = arr.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, arr.length - 1)
  return Math.sqrt(Math.max(0, v))
}

/**
 * KOSPI 지수 컨텍스트를 한 번만 불러올 때 사용.
 * @param {string} appKey
 * @param {string} appSecret
 * @param {'prod'|'vps'} env
 */
export async function fetchIndexScreeningContext(appKey, appSecret, env) {
  const [indexChart, indexQuote, indexInvestor] = await Promise.all([
    inquireChartByTimeframe(appKey, appSecret, env, '069500', '1Y').catch(() => []),
    inquireDomesticPrice(appKey, appSecret, env, '069500').catch(() => null),
    inquireInvestorByStock(appKey, appSecret, env, '069500').catch(() => null),
  ])
  return { indexChart, indexQuote, indexInvestor }
}
