import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { inquireChartByTimeframe, inquireDomesticPrice, inquireInvestorByStock } from './kisClient.mjs'
import { getIntradayChart, krxMarketStatus } from './yahooIntraday.mjs'
import { completeJsonChat, getAiConfig } from './aiClient.mjs'
import { runResearchStock } from './researchStock.mjs'
import {
  buildSourceList,
  generateMarketBriefingWithAi,
  searchBrokerReports,
  searchLatestNews,
} from './marketBriefing.mjs'
import { computeLogicIndicatorsPack } from './indicators/logicBundle.mjs'
import { buildEarningsIntel, extractSpecialAlertsFromKisRaw } from './earningsIntel.mjs'
import { runScreeningSimple } from './screening/runScreeningSimple.mjs'
import { getCompareStockPayload } from './screening/compareStock.mjs'
import { analyzeStockScenario } from './ai/stockScenario.mjs'
import { scoreSingleStock, fetchIndexScreeningContext } from './screening/scoreStock.mjs'
import { getMarketIndices } from './marketIndices.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
/** `server/` 의 부모 = 프로젝트 루트 (실행 cwd 와 무관) */
const PROJECT_ROOT = path.resolve(__dirname, '..')
const ENV_PATH = path.join(PROJECT_ROOT, '.env')

// dotenv v17+: 이미 process.env 에 키가 있으면(빈 문자열 포함) .env 값을 쓰지 않음.
// IDE/에이전트가 KIS_APP_KEY= 형태로 비워 둔 경우가 있어 override 필수.
const envLoad = dotenv.config({
  path: ENV_PATH,
  override: true,
  quiet: true,
})
if (envLoad.error && envLoad.error.code !== 'ENOENT') {
  console.warn('[dotenv]', envLoad.error.message)
}

const PORT = Number(process.env.PORT) || 8787
const app = express()

/** .env 에 따옴표·앞뒤 공백이 붙은 비밀값 정리 */
function cleanEnvSecret(v) {
  if (v == null || typeof v !== 'string') return ''
  let s = v.trim()
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim()
  }
  return s
}


/** 차트 요청 캐시/중복제거 (모의투자 호출 제한 보호) */
const chartCache = new Map()
const chartInflight = new Map()
const intradayCache = new Map()
const intradayInflight = new Map()
const logicCache = new Map()
const logicInflight = new Map()

function chartTtlMs(tf) {
  return tf === '5D' ? 5_000 : 10 * 60_000
}

function intradayChartTtlMs() {
  return krxMarketStatus() === 'open' ? 5 * 60_000 : 24 * 60 * 60_000
}

function logicTtlMs() {
  // vps 호출 제한 보호: 로직 지표는 10분 캐시
  return 10 * 60_000
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n))
}

function mean(arr) {
  if (!arr.length) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function stddev(arr) {
  if (arr.length < 2) return 0
  const m = mean(arr)
  const v = mean(arr.map((x) => (x - m) ** 2))
  return Math.sqrt(v)
}

function computeRsi(closes, period = 14) {
  if (closes.length < period + 1) return null
  let gain = 0
  let loss = 0
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff >= 0) gain += diff
    else loss += Math.abs(diff)
  }
  const avgGain = gain / period
  const avgLoss = loss / period
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

function parseNumberText(v) {
  if (v == null) return null
  const n = Number(String(v).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

const MS_DAY = 86_400_000
/** 서울일 기준 평균 목표가 스냅샷(메모리). 재시작 시 초기화되어 4·12주 추세는 누적 후 표시됩니다. */
const consensusDaySnapshots = new Map()

function seoulDayKey(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

function dayKeyToUtcMs(dayKey) {
  return new Date(`${String(dayKey)}T06:00:00+09:00`).getTime()
}

function recordConsensusSnapshot(code6, avg, min, max) {
  if (!avg || avg <= 0) return
  const code = String(code6).replace(/\D/g, '').padStart(6, '0')
  const day = seoulDayKey()
  let rows = consensusDaySnapshots.get(code) || []
  const last = rows[rows.length - 1]
  if (last && last.day === day) {
    last.avg = avg
    last.min = min
    last.max = max
  } else {
    rows = [...rows, { day, avg, min, max }].slice(-420)
  }
  consensusDaySnapshots.set(code, rows)
}

function consensusTrendPctFromHistory(code6, currentAvg, lookbackDays) {
  const code = String(code6).replace(/\D/g, '').padStart(6, '0')
  const rows = consensusDaySnapshots.get(code) || []
  if (!rows.length || !currentAvg || currentAvg <= 0) return null
  const cutoff = Date.now() - lookbackDays * MS_DAY
  let best = null
  for (const r of rows) {
    const t = dayKeyToUtcMs(r.day)
    if (t > cutoff) continue
    if (!best || t > dayKeyToUtcMs(best.day)) best = r
  }
  if (!best?.avg || best.avg <= 0) return null
  return ((currentAvg / best.avg) - 1) * 100
}

function parseFnGuideEstDate(s) {
  const raw = String(s || '').trim().replace(/\//g, '-')
  if (!raw) return null
  const d = new Date(`${raw}T12:00:00+09:00`)
  return Number.isFinite(d.getTime()) ? d : null
}

function countBrokerTargetRevisions7d(comp) {
  const rows = Array.isArray(comp) ? comp : []
  const now = Date.now()
  let up = 0
  let down = 0
  let flat = 0
  let reports = 0
  for (const row of rows) {
    const est = parseFnGuideEstDate(row.EST_DT)
    if (!est) continue
    if (now - est.getTime() > 7 * MS_DAY) continue
    const cur = parseNumberText(row.TARGET_PRC)
    const bf = parseNumberText(row.TARGET_PRC_BF)
    if (cur == null || bf == null) continue
    reports += 1
    if (cur > bf) up += 1
    else if (cur < bf) down += 1
    else flat += 1
  }
  return { up, down, flat, reports }
}

function dispersionLabelFromWidth(widthPct) {
  if (widthPct == null || !Number.isFinite(widthPct)) return '분포 미산출'
  if (widthPct <= 20) return '컨센서스 수렴'
  if (widthPct >= 55) return '컨센서스 분기'
  return '컨센서스 분포 보통'
}

/** FnGuide 컨센서스 JSON — 증권사별 목표가(TARGET_PRC) + 평균(AVG_PRC) */
async function fetchFnGuideConsensus(code6) {
  const code = String(code6).replace(/\D/g, '').padStart(6, '0')
  const gicode = `A${code}`
  const url = `https://comp.fnguide.com/SVO2/json/data/01_06/03_${gicode}.json`
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; kospi-stock-card)',
      accept: 'application/json,text/plain,*/*',
      referer: `https://comp.fnguide.com/SVO2/ASP/SVD_Consensus.asp?pGB=1&gicode=${gicode}`,
    },
  })
  if (!res.ok) return null
  let data
  try {
    const raw = await res.text()
    data = JSON.parse(raw.replace(/^\uFEFF/, ''))
  } catch {
    return null
  }
  const comp = Array.isArray(data?.comp) ? data.comp : []
  if (!comp.length) return null

  const brokerTargets = []
  for (const row of comp) {
    const t = parseNumberText(row.TARGET_PRC)
    if (t != null && t > 0) brokerTargets.push(t)
  }
  if (!brokerTargets.length) return null

  const avgFromConsensus = parseNumberText(comp[0].AVG_PRC)
  const avgTargetPrice =
    avgFromConsensus != null && avgFromConsensus > 0
      ? avgFromConsensus
      : Math.round(mean(brokerTargets))
  const maxTargetPrice = Math.max(...brokerTargets)
  const minTargetPrice = Math.min(...brokerTargets)
  const safeMax = Math.max(maxTargetPrice, avgTargetPrice)
  const safeMin = Math.min(minTargetPrice, avgTargetPrice)

  const avgRecomCd = parseNumberText(comp[0].AVG_RECOM_CD)
  const avgBf = parseNumberText(comp[0].AVG_PRC_BF)
  const avgVsBfPct =
    avgBf != null && avgBf > 0 && avgTargetPrice > 0 ? ((avgTargetPrice - avgBf) / avgBf) * 100 : null

  const dispersionWidthPct =
    avgTargetPrice > 0 ? ((safeMax - safeMin) / avgTargetPrice) * 100 : null
  const dispersionHighSkewPct =
    avgTargetPrice > 0 ? ((safeMax - avgTargetPrice) / avgTargetPrice) * 100 : null
  const dispersionLowSkewPct =
    avgTargetPrice > 0 ? ((avgTargetPrice - safeMin) / avgTargetPrice) * 100 : null
  const dispersionLabelKo = dispersionLabelFromWidth(dispersionWidthPct)

  const rev = countBrokerTargetRevisions7d(comp)

  let latestEst = 0
  for (const row of comp) {
    const d = parseFnGuideEstDate(row.EST_DT)
    if (d && d.getTime() > latestEst) latestEst = d.getTime()
  }
  const lastUpdateDays =
    latestEst > 0 ? Math.max(0, Math.floor((Date.now() - latestEst) / MS_DAY)) : null

  return {
    avgTargetPrice,
    maxTargetPrice: safeMax,
    minTargetPrice: safeMin,
    analystCount: comp.length,
    lastUpdateDays,
    avgRecomCd,
    avgTargetPriceBf: avgBf,
    avgVsBfPct,
    dispersionWidthPct,
    dispersionHighSkewPct,
    dispersionLowSkewPct,
    dispersionLabelKo,
    revision7dUp: rev.up,
    revision7dDown: rev.down,
    revision7dFlat: rev.flat,
    revision7dReports: rev.reports,
  }
}

function recommendationLabelFromFnGuideScore(cd) {
  if (cd == null || !Number.isFinite(cd)) return null
  if (cd >= 4.5) return '매수(상단)'
  if (cd >= 3.5) return '매수'
  if (cd >= 2.5) return '보유'
  if (cd >= 1.5) return '매도'
  return '매도(강)'
}

async function fetchNaverConsensus(code6) {
  const code = String(code6).replace(/\D/g, '').padStart(6, '0')
  const url = `https://finance.naver.com/item/main.naver?code=${code}`
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0',
      accept: 'text/html,application/xhtml+xml',
    },
  })
  if (!res.ok) throw new Error(`네이버 컨센서스 조회 실패 (${res.status})`)
  const html = await res.text()
  const table = html.match(/<table[^>]*summary="투자의견 정보"[\s\S]*?<\/table>/)?.[0] ?? ''
  if (!table) return null

  const recommendationScore = parseNumberText(
    table.match(/<span class="f_(?:up|down|eq)"><em>([\d.]+)<\/em>/)?.[1],
  )
  const recommendationText =
    table.match(/<span class="f_(?:up|down|eq)"><em>[\d.]+<\/em>\s*([^<\s]+)/)?.[1] ?? null
  const targetPrice = parseNumberText(table.match(/<span class="bar">l<\/span>\s*<em>([\d,]+)<\/em>/)?.[1])
  if (!targetPrice || targetPrice <= 0) return null

  return {
    source: 'naver-finance',
    avgTargetPrice: targetPrice,
    maxTargetPrice: targetPrice,
    recommendationScore,
    recommendationText,
    analystCount: null,
    lastUpdateDays: null,
  }
}

/** FnGuide 우선(증권사별 목표가 분포), 실패 시 네이버 단일 목표가 */
async function fetchConsensusDetails(code6) {
  const code = String(code6).replace(/\D/g, '').padStart(6, '0')
  const [fg, nv] = await Promise.all([
    fetchFnGuideConsensus(code).catch(() => null),
    fetchNaverConsensus(code).catch(() => null),
  ])

  const emptyRevision = { revision7dUp: 0, revision7dDown: 0, revision7dFlat: 0, revision7dReports: 0 }

  if (fg) {
    recordConsensusSnapshot(code, fg.avgTargetPrice, fg.minTargetPrice, fg.maxTargetPrice)
    const trend4w = consensusTrendPctFromHistory(code, fg.avgTargetPrice, 28)
    const trend12w = consensusTrendPctFromHistory(code, fg.avgTargetPrice, 84)
    const rows = consensusDaySnapshots.get(code) || []
    const trendNote =
      trend4w == null && trend12w == null
        ? `4·12주 평균 목표가 추세는 서버에 일별 스냅샷이 쌓이면 표시됩니다. (현재 ${rows.length}일치)`
        : null
    return {
      source: 'fnguide',
      avgTargetPrice: fg.avgTargetPrice,
      maxTargetPrice: fg.maxTargetPrice,
      minTargetPrice: fg.minTargetPrice,
      recommendationScore: fg.avgRecomCd ?? nv?.recommendationScore ?? null,
      recommendationText: nv?.recommendationText ?? recommendationLabelFromFnGuideScore(fg.avgRecomCd),
      analystCount: fg.analystCount,
      lastUpdateDays: fg.lastUpdateDays ?? nv?.lastUpdateDays ?? null,
      avgTargetPriceBf: fg.avgTargetPriceBf,
      avgVsBfPct: fg.avgVsBfPct,
      dispersionWidthPct: fg.dispersionWidthPct,
      dispersionHighSkewPct: fg.dispersionHighSkewPct,
      dispersionLowSkewPct: fg.dispersionLowSkewPct,
      dispersionLabelKo: fg.dispersionLabelKo,
      revision7dUp: fg.revision7dUp,
      revision7dDown: fg.revision7dDown,
      revision7dFlat: fg.revision7dFlat,
      revision7dReports: fg.revision7dReports,
      consensusAvgTrend4wPct: trend4w,
      consensusAvgTrend12wPct: trend12w,
      consensusTrendNote: trendNote,
    }
  }
  if (nv) {
    recordConsensusSnapshot(code, nv.avgTargetPrice, nv.avgTargetPrice, nv.maxTargetPrice ?? nv.avgTargetPrice)
    const trend4w = consensusTrendPctFromHistory(code, nv.avgTargetPrice, 28)
    const trend12w = consensusTrendPctFromHistory(code, nv.avgTargetPrice, 84)
    const rows = consensusDaySnapshots.get(code) || []
    const trendNote =
      trend4w == null && trend12w == null
        ? `4·12주 추세는 FnGuide 다증권 데이터 연동 시 정확해집니다. (스냅샷 ${rows.length}일치)`
        : null
    return {
      ...nv,
      minTargetPrice: nv.minTargetPrice ?? nv.avgTargetPrice,
      ...emptyRevision,
      avgTargetPriceBf: null,
      avgVsBfPct: null,
      dispersionWidthPct: 0,
      dispersionHighSkewPct: 0,
      dispersionLowSkewPct: 0,
      dispersionLabelKo: '단일 출처(분산 미표시)',
      consensusAvgTrend4wPct: trend4w,
      consensusAvgTrend12wPct: trend12w,
      consensusTrendNote: trendNote,
    }
  }
  return null
}

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

function indexVkospiProxyFromBars(indexBars) {
  const closes = indexBars.map((b) => b.close).filter((n) => Number.isFinite(n) && n > 0)
  const rets = []
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) rets.push((closes[i] - closes[i - 1]) / closes[i - 1])
  }
  if (rets.length >= 20) return stddev(rets.slice(-20)) * Math.sqrt(252) * 100
  if (rets.length >= 5) return stddev(rets) * Math.sqrt(252) * 100
  return null
}

async function computeKisLogicIndicators(quote, stockChart, investor, consensus, ctx = {}) {
  const stockBars = barsFromKisChart(stockChart)
  const indexBars = barsFromKisChart(Array.isArray(ctx.indexChart) ? ctx.indexChart : [])
  const vk = indexVkospiProxyFromBars(indexBars)
  const code6 = String(quote?.code || '').replace(/\D/g, '').padStart(6, '0') || '000000'

  const idxQuote = ctx.indexQuote
  const idxChange =
    idxQuote?.changePercent != null && Number.isFinite(Number(idxQuote.changePercent))
      ? Number(idxQuote.changePercent)
      : null

  const pack = computeLogicIndicatorsPack(
    {
      quote: {
        price: Number(quote?.price) || 0,
        changePercent: Number(quote?.changePercent) || 0,
        volume: Number(quote?.volume) || 0,
        tradeValue: quote?.tradeValue != null ? Number(quote.tradeValue) : undefined,
        per: quote?.per != null ? Number(quote.per) : null,
      },
      stockBars,
      indexBars,
      indexVkospiProxy: vk,
      indexInvestor: ctx.indexInvestor ?? null,
      indexQuote: idxChange != null ? { changePercent: idxChange } : null,
    },
    code6,
  )

  const closes = stockBars.map((b) => b.close)
  const last = closes.length ? closes[closes.length - 1] : Number(quote?.price) || 0
  const sma20c = closes.length >= 20 ? mean(closes.slice(-20)) : last
  const rsi = computeRsi(closes, 14)

  const c3 = investor?.cumulative3d
  const c5 = investor?.cumulative5d
  const hasInvHistory = (c3?.daysUsed ?? 0) > 0
  const invRowsLen = Array.isArray(investor?.rows) ? investor.rows.length : 0

  const foreignNetShares3D = c3?.foreignNetShares ?? 0
  const foreignNetAmount3D = c3?.foreignNetAmount ?? 0
  const institutionNetShares3D = c3?.institutionNetShares ?? 0
  const institutionNetAmount3D = c3?.institutionNetAmount ?? 0
  const retailNetShares3D = c3?.personalNetShares ?? 0
  const retailNetAmount3D = c3?.personalNetAmount ?? 0

  const fiNetAmount3D = foreignNetAmount3D + institutionNetAmount3D
  const flow = hasInvHistory
    ? `수급(3거래일 누적) ${fiNetAmount3D >= 0 ? '우위' : '약세'} | 외인 ${foreignNetShares3D.toLocaleString('ko-KR')}주 · 기관 ${institutionNetShares3D.toLocaleString('ko-KR')}주`
    : '수급(3거래일 누적) 데이터 없음'
  const foreign = hasInvHistory
    ? `외국인(3거래일 누적) ${foreignNetShares3D >= 0 ? '순매수' : '순매도'} ${Math.abs(foreignNetShares3D).toLocaleString('ko-KR')}주`
    : '외국인(3거래일 누적) 데이터 없음'
  const institution = hasInvHistory
    ? `기관(3거래일 누적) ${institutionNetShares3D >= 0 ? '순매수' : '순매도'} ${Math.abs(institutionNetShares3D).toLocaleString('ko-KR')}주`
    : '기관(3거래일 누적) 데이터 없음'
  const volume = `거래량 ${Number(quote.volume || 0).toLocaleString('ko-KR')}주`

  const lastBar = stockBars.length ? stockBars[stockBars.length - 1] : null
  const candle =
    lastBar && lastBar.close >= lastBar.open
      ? '양봉(종가 우위) · 단기 상승 압력'
      : '음봉(종가 약세) · 단기 조정 압력'

  const rets20 = []
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) rets20.push((closes[i] - closes[i - 1]) / closes[i - 1])
  }
  const volDaily = rets20.length >= 20 ? stddev(rets20.slice(-20)) : stddev(rets20)
  const volPct = (volDaily || 0) * Math.sqrt(252) * 100
  const volatility = `연환산 변동성 ${volPct.toFixed(1)}%`

  const specialAlerts = extractSpecialAlertsFromKisRaw(quote?.raw)
  const earn = await buildEarningsIntel(code6, stockBars)

  return {
    structure: pack.structureLine,
    structureSub: pack.structureSub,
    execution: pack.executionLine,
    executionSub: pack.executionSub,
    market: pack.marketHeadline,
    marketHeadline: pack.marketHeadline,
    marketDetail: pack.marketDetail,
    marketSubCompact: pack.marketSubCompact,
    marketScore: pack.marketScore,
    marketRegime: pack.marketRegime,
    flow,
    technical: `RSI ${rsi == null ? 'N/A' : rsi.toFixed(1)} | SMA20 ${Math.round(sma20c).toLocaleString('ko-KR')}`,
    stats: pack.statsLine,
    statsPrimary: pack.statsPrimary,
    statsSub: pack.statsSub,
    statsTrend20Pct: pack.statsTrend20Pct,
    statsRiskStrip: pack.statsRiskStrip,
    statsRiskBadge: pack.statsRiskBadge,
    atrGap: pack.atrGapLine,
    atrGapValue: pack.atrGapValue,
    atrGapSub: pack.atrGapSub,
    atrRiskStrip: pack.atrRiskStrip,
    atrRiskBadge: pack.atrRiskBadge,
    atr14Won: pack.atr14Won ?? null,
    low20Min: pack.low20Min ?? null,
    streak: pack.streakLine,
    streakSub: pack.streakSub,
    streakSeverity: pack.streakSeverity,
    rotation: pack.rotationLine,
    structureState: pack.structureStatePrimary,
    structureStateSub: pack.structureStateSub,
    adjustment: pack.adjustmentLine,
    candleQuality: pack.candleQualityLine,
    candleQualityPrimary: pack.candleQualityPrimary,
    candleQualitySub: pack.candleQualitySub,
    liquidity: pack.liquidityLine,
    indicator: pack.indicatorLine,
    indicatorPrimary: pack.indicatorPrimary,
    indicatorSub: pack.indicatorSub,
    indicatorRiskStrip: pack.indicatorRiskStrip,
    indicatorRiskBadge: pack.indicatorRiskBadge,
    indicatorShowRiskInfoIcon: pack.indicatorShowRiskInfoIcon,
    rsi: pack.indicatorPrimary,
    unusual: specialAlerts.length ? specialAlerts.join(' · ') : undefined,
    specialAlerts,
    volume,
    volatility,
    foreign,
    institution,
    momentum: pack.momentumLine,
    candle,
    valuationPrimary: pack.valuationPrimary,
    valuationSub: pack.valuationSub,
    earningsPrimary: earn.earningsPrimary,
    earningsSub: earn.earningsSub,
    earningsSeverity: earn.earningsSeverity,
    earningsRiskStrip: earn.earningsRiskStrip,
    earningsRiskBadge: earn.earningsRiskBadge,
    earningsDetailForDrawer: earn.earningsDetailForDrawer,
    earningsSparkline: earn.earningsSparkline,
    earningsValueEmphasis: earn.earningsValueEmphasis,
    earningsSubEmphasis: earn.earningsSubEmphasis,
    supplyDetails: {
      foreignNetShares3D,
      foreignNetAmount3D,
      institutionNetShares3D,
      institutionNetAmount3D,
      retailNetShares3D,
      retailNetAmount3D,
      ...(invRowsLen >= 5 && c5
        ? {
            foreignNetAmount5D: c5.foreignNetAmount,
            institutionNetAmount5D: c5.institutionNetAmount,
            retailNetAmount5D: c5.personalNetAmount,
          }
        : {}),
      supplyPeriod: '직전 3거래일 누적',
    },
    consensusDetails: consensus || null,
    logicUi: pack,
  }
}

const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
)

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true)
      if (allowedOrigins.has(origin)) return cb(null, true)
      try {
        const host = new URL(origin).hostname
        if (host.endsWith('.vercel.app')) return cb(null, true)
      } catch {
        /* ignore */
      }
      return cb(null, false)
    },
  }),
)

app.use(express.json({ limit: '512kb' }))

async function generateAIFill({ payload }) {
  const system = [
    '너는 한국 주식 카드 데이터 생성기다.',
    '입력 데이터를 바탕으로 과장 없이 보수적으로 요약한다.',
    '반드시 JSON만 반환한다.',
  ].join(' ')

  const kisOk = payload?.kisDataAvailable !== false
  const user = {
    instruction: kisOk
      ? '아래 시세/차트 입력을 바탕으로 카드 데이터를 생성해라. 최근 뉴스/공시/증권사 리포트 등 공개정보를 검색해 반영하고, 모든 문구는 한국어로 작성해라. 특히 logicIndicators의 각 필드는 1줄씩 반드시 채워라.'
      : 'KIS 시세·차트 데이터가 없고 종목 코드(또는 최소 정보만) 주어졌다. 공개 정보·일반적 관점으로만 보수적으로 작성하고, 특정 가격·등락·수치는 단정하거나 꾸며내지 마라. 모르면 "데이터 없음" 톤으로 짧게 써라. 모든 문구는 한국어로. logicIndicators의 각 필드는 반드시 채워라.',
    input: payload,
    output_schema: {
      summaryTitle: 'string',
      summaryBody: 'string',
      finalOpinion: {
        finalGrade: 'A|B|C|D',
        strategy: 'BUY|WATCH',
        entryStage: '신규진입|보유|관망|익절',
        keyReasons: ['핵심 근거1', '핵심 근거2', '핵심 근거3'],
        risks: ['리스크1', '리스크2'],
      },
      executionSignals: {
        decision: '신규진입|보유|관망|익절',
        upsideScore: 0,
        targetReturnPct: 0,
        stopLossPct: 0,
      },
      executionPlan: 'string',
      logicIndicators: {
        structure: '예: 74 / 100',
        execution: '예: 63 / 100',
        market: '예: Caution (VIX 17.2)',
        flow: '예: 에너지 중립 | 체결강도 1.02x',
        technical: '예: RSI 58 | MFI 54',
        stats: '예: 유사 패턴 승률 62.1%, 참고 수익률 +2.1%',
        rsi: '예: RSI 58',
        volume: '예: 20일 평균 대비 1.42x',
        volatility: '예: 저변동 수축 구간',
        foreign: '예: 외국인 3일 순매수',
        institution: '예: 기관 2일 순매도',
        momentum: '예: 단기 모멘텀 +0.6σ',
        candle: '예: 양봉 장악형',
      },
      executionStrategy: {
        positionSize: { percent: 0, amountKrw: 0, note: 'string' },
        oneRLossKrw: 0,
        oneRLossNote: 'string',
        basePlan: 'string',
        maxPositionPercent: 0,
        maxPositionNote: 'string',
      },
      targets: [
        { horizon: '1D', sub: '', price: 0, pct: 0, rate: 0, n: 0 },
        { horizon: '7D', sub: '', price: 0, pct: 0, rate: 0, n: 0 },
        { horizon: '1M', sub: '(21D)', price: 0, pct: 0, rate: 0, n: 0 },
        { horizon: '3M', sub: '(63D)', price: 0, pct: 0, rate: 0, n: 0 },
      ],
    },
  }

  return completeJsonChat({ system, user: JSON.stringify(user) })
}

/** AI 투자 메모 — 클라이언트 프롬프트(종목·숫자·뉴스 JSON)를 받아 JSON 응답 */
async function generateAiBriefingJson({ prompt }) {
  const system = [
    '너는 한국 주식 애널리스트다. 입력 프롬프트의 규칙·금지사항·문단 순서를 그대로 따른다.',
    '숫자(원, %, PER, 억)를 빼먹지 말고, 추상 표현만으로 채우지 말 것.',
    '매수·매도를 단정하지 말고 가능성·조건부 표현을 쓴다.',
    '반드시 아래 키만 가진 JSON 객체 하나만 반환한다 (다른 텍스트 금지).',
    '키: title(string), paragraphs(string[] 정확히 6개 — 가격/트리거/펀더멘털/수급리스크/카탈리스트/전략 순),',
    'keyPoints(string[] 4~7), risks(string[] 2~5), strategyComment(string), strategyPlan(object), tone은 "bullish"|"neutral"|"caution" 중 하나.',
  ].join(' ')

  const json = await completeJsonChat({ system, user: prompt })

  const strArr = (v, max = 8) =>
    Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).slice(0, max).map((x) => x.trim()) : []
  const str = (v, fallback = '') => (typeof v === 'string' && v.trim() ? v.trim() : fallback)

  const toneRaw = str(json.tone, 'neutral').toLowerCase()
  const tone = ['bullish', 'neutral', 'caution'].includes(toneRaw) ? toneRaw : 'neutral'

  let paragraphs = strArr(json.paragraphs, 10)
  const pad = '이 문단은 생성되지 않았습니다.'
  while (paragraphs.length < 6) paragraphs.push(pad)
  paragraphs = paragraphs.slice(0, 6)

  const keyPoints = strArr(json.keyPoints, 10)
  const risks = strArr(json.risks, 10)
  const toNum = (v) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  const strategyPlanRaw = json?.strategyPlan && typeof json.strategyPlan === 'object'
    ? json.strategyPlan
    : null
  const strategyPlan = strategyPlanRaw
    ? {
        title: str(strategyPlanRaw.title, '지금 전략'),
        marketView: str(strategyPlanRaw.marketView, ''),
        timingView: str(strategyPlanRaw.timingView, ''),
        positioningView: str(strategyPlanRaw.positioningView, ''),
        riskView: str(strategyPlanRaw.riskView, ''),
        strategyMemo: str(strategyPlanRaw.strategyMemo, ''),
        evidence: strArr(strategyPlanRaw.evidence, 8),
        confidence: clamp(toNum(strategyPlanRaw.confidence) ?? 50, 0, 100),
      }
    : null

  return {
    title: str(json.title, '투자 메모'),
    paragraphs,
    keyPoints: keyPoints.length ? keyPoints : ['핵심 포인트를 생성하지 못했습니다.'],
    risks: risks.length ? risks : ['리스크를 생성하지 못했습니다.'],
    strategyComment: str(json.strategyComment, ''),
    strategyPlan: strategyPlan || undefined,
    confidence: strategyPlan?.confidence ?? undefined,
    tone,
  }
}

app.post('/api/ai-briefing', async (req, res) => {
  const aiCfg = getAiConfig()
  if (!aiCfg) {
    res.status(503).json({
      error:
        'AI API 키가 없습니다. Vercel Project → Settings → Environment Variables에 ANTHROPIC_API_KEY를 추가한 뒤 재배포하세요.',
      stage: 'config',
    })
    return
  }

  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : ''
  if (!prompt) {
    res.status(400).json({ error: 'JSON body에 prompt(string)가 필요합니다.' })
    return
  }
  if (prompt.length > 48_000) {
    res.status(400).json({ error: 'prompt가 너무 깁니다.' })
    return
  }

  try {
    const briefing = await generateAiBriefingJson({ prompt })
    res.json(briefing)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[api/ai-briefing]', message)
    res.status(502).json({ error: message, stage: 'llm' })
  }
})

const handleScreenerBriefing = async (req, res) => {
  const stockName = String(req.body?.stockName || '').trim()
  const stockCode = String(req.body?.stockCode || '').replace(/\D/g, '').padStart(6, '0')
  const mode = String(req.body?.mode || '')
  if (!stockName || !stockCode) {
    res.status(400).json({ error: 'stockName, stockCode가 필요합니다.' })
    return
  }

  const [news, reports] = await Promise.all([
    searchLatestNews(stockName, stockCode).catch(() => []),
    searchBrokerReports(stockName, stockCode).catch(() => []),
  ])

  if (mode === 'news-only') {
    res.json({ news, reports: [], sources: buildSourceList(news, []), updatedAt: new Date().toISOString() })
    return
  }
  if (mode === 'reports-only') {
    res.json({ news: [], reports, sources: buildSourceList([], reports), updatedAt: new Date().toISOString() })
    return
  }

  const metrics = typeof req.body?.metrics === 'object' && req.body.metrics ? req.body.metrics : {}
  const strategy = typeof req.body?.strategy === 'object' && req.body.strategy ? req.body.strategy : {}

  const aiCfg = getAiConfig()

  const sources = buildSourceList(news, reports)

  if (!aiCfg) {
    res.json({
      briefing: {
        title: `${stockName} 투자 브리핑`,
        paragraphs: [
          '최신 뉴스 데이터가 부족해 차트·수급 중심으로 판단합니다.',
          '증권사 목표가/의견은 확인 가능한 범위에서만 반영했습니다.',
          '실적·수주·정책 이슈는 제목 기준으로 추출되어 세부 검증이 필요합니다.',
          '단기 과열 구간 여부(RSI/ATR)는 점검 후 추격보다 눌림 대응이 유리할 수 있습니다.',
          '1개월 +15% 전략은 변동성 관리(손절 -5~-7%, +10% 분할익절)를 우선하시기 바랍니다.',
        ],
        keyPoints: ['ANTHROPIC_API_KEY가 없어 로컬 요약으로 표시됩니다.'],
        risks: ['목표가 수치는 확인된 리포트에서만 반영합니다.'],
        strategyComment: '데이터 제한으로 보수적으로 대응하시기 바랍니다.',
        tone: 'neutral',
      },
      news,
      reports,
      sources,
      updatedAt: new Date().toISOString(),
    })
    return
  }

  try {
    const briefing = await generateMarketBriefingWithAi({
      stockName,
      stockCode,
      metrics,
      strategy,
      news,
      reports,
    })
    res.json({
      briefing,
      news,
      reports,
      sources,
      updatedAt: new Date().toISOString(),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    res.json({
      briefing: {
        title: `${stockName} 투자 브리핑`,
        paragraphs: [
          '최신 뉴스/리포트 해석 중 오류가 발생해 차트·수급 중심으로 판단합니다.',
          '뉴스 트리거와 리포트 수치는 링크 원문 확인 후 재검증이 필요합니다.',
          '증권사 리포트가 30일 이상 경과하면 참고 가중치를 낮춰 해석하시기 바랍니다.',
          'RSI/ATR 과열 여부를 체크해 추격 매수보다 눌림 대응을 우선하십시오.',
          '단기 트리거와 펀더멘털을 분리해 1개월/3개월 전략을 각각 점검하시기 바랍니다.',
        ],
        keyPoints: ['AI 분석 실패 시 안전 폴백이 적용됩니다.'],
        risks: [message.slice(0, 160)],
        strategyComment: '데이터 확인 가능한 범위에서만 보수적으로 대응하시기 바랍니다.',
        tone: 'caution',
      },
      news,
      reports,
      sources,
      updatedAt: new Date().toISOString(),
      warning: message,
    })
  }
}

app.post('/api/screener-briefing', handleScreenerBriefing)
// Backward-compatible alias
app.post('/api/market-briefing', handleScreenerBriefing)

/** AI 투자 메모 1단계 — 최근 기사·리포트 리서치 (Claude + web_search) */
app.post('/api/research-stock', async (req, res) => {
  const aiCfg = getAiConfig()
  if (!aiCfg) {
    res.status(503).json({ error: 'ANTHROPIC_API_KEY 가 필요합니다.', stage: 'config' })
    return
  }
  const stockName = String(req.body?.stockName ?? req.body?.name ?? '').trim()
  const stockCode = String(req.body?.stockCode ?? req.body?.code ?? '')
    .replace(/\D/g, '')
    .padStart(6, '0')
  if (!stockName || stockCode === '000000') {
    res.status(400).json({ error: 'stockName(또는 name)과 stockCode(또는 code)가 필요합니다.' })
    return
  }
  try {
    const result = await runResearchStock(stockName, stockCode)
    res.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[api/research-stock]', message)
    res.status(502).json({ error: message, stage: 'research' })
  }
})

app.get('/api/health', (_req, res) => {
  const appKey = cleanEnvSecret(process.env.KIS_APP_KEY)
  const appSecret = cleanEnvSecret(process.env.KIS_APP_SECRET)
  const anthropicKey = cleanEnvSecret(process.env.ANTHROPIC_API_KEY)
  const aiCfg = getAiConfig()
  const hasKis = Boolean(appKey && appSecret)
  const envFileExists = fs.existsSync(ENV_PATH)
  res.json({
    ok: true,
    kisConfigured: hasKis,
    anthropicConfigured: Boolean(anthropicKey),
    aiConfigured: Boolean(aiCfg),
    aiProvider: aiCfg ? 'anthropic' : null,
    aiBriefingPost: Boolean(aiCfg),
    kisEnv: process.env.KIS_ENV || 'vps',
    anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-opus-4-7',
    anthropicResearchModel: process.env.ANTHROPIC_RESEARCH_MODEL || 'claude-sonnet-4-5',
    anthropicSummaryModel: process.env.ANTHROPIC_SUMMARY_MODEL || 'claude-sonnet-4-5',
    aiModel: aiCfg?.model ?? null,
    /** 비밀값은 절대 내려주지 않음 — 파일/변수만 점검용 */
    check: {
      envPath: ENV_PATH,
      envFileExists,
      appKeyPresent: Boolean(appKey),
      appSecretPresent: Boolean(appSecret),
      anthropicKeyPresent: Boolean(anthropicKey),
    },
  })
})

app.get('/api/market-indices', async (_req, res) => {
  try {
    const result = await getMarketIndices()
    res.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[/api/market-indices]', message)
    res.status(500).json({ error: message })
  }
})

app.get('/api/intraday-chart', async (req, res) => {
  const code = String(req.query.code || '005930').replace(/\D/g, '').padStart(6, '0')
  const intervalRaw = String(req.query.interval || '5m')
  const interval = ['1m', '5m', '15m'].includes(intervalRaw) ? intervalRaw : '5m'
  const suffix = String(req.query.suffix || 'KS').toUpperCase() === 'KQ' ? 'KQ' : 'KS'
  const key = `intraday:${code}:${interval}:${suffix}`
  const ttl = intradayChartTtlMs()
  const now = Date.now()

  const cached = intradayCache.get(key)
  if (cached && now - cached.at < ttl) {
    res.json({ ...cached.body, cached: true, fetchedAt: new Date(cached.at).toISOString() })
    return
  }

  try {
    let task = intradayInflight.get(key)
    if (!task) {
      task = getIntradayChart(code, interval, suffix)
      intradayInflight.set(key, task)
    }
    const body = await task
    intradayInflight.delete(key)
    intradayCache.set(key, { body, at: Date.now() })
    res.json({ ...body, cached: false, fetchedAt: new Date().toISOString() })
  } catch (e) {
    intradayInflight.delete(key)
    const message = e instanceof Error ? e.message : String(e)
    console.error('[api/intraday-chart]', message)
    res.status(502).json({ error: message, stage: 'yahoo_intraday' })
  }
})

app.get('/api/chart', async (req, res) => {
  const appKey = process.env.KIS_APP_KEY?.trim()
  const appSecret = process.env.KIS_APP_SECRET?.trim()
  if (!appKey || !appSecret) {
    res.status(503).json({
      error: '서버에 KIS_APP_KEY, KIS_APP_SECRET 이 설정되지 않았습니다.',
    })
    return
  }

  const code = String(req.query.code || '005930').replace(/\D/g, '').padStart(6, '0')
  const tf = String(req.query.tf || '5D')
  if (!['5D', '1M', '3M', '1Y'].includes(tf)) {
    res.status(400).json({ error: '지원하지 않는 timeframe 입니다.' })
    return
  }

  const env = process.env.KIS_ENV === 'prod' ? 'prod' : 'vps'
  const key = `${env}:${code}:${tf}`
  const ttl = chartTtlMs(tf)
  const now = Date.now()

  const cached = chartCache.get(key)
  if (cached && now - cached.at < ttl) {
    res.json({
      code,
      tf,
      points: cached.points,
      fetchedAt: new Date(cached.at).toISOString(),
      kisEnv: env,
      cached: true,
    })
    return
  }

  try {
    let task = chartInflight.get(key)
    if (!task) {
      task = inquireChartByTimeframe(appKey, appSecret, env, code, tf)
      chartInflight.set(key, task)
    }
    const points = await task
    chartInflight.delete(key)

    chartCache.set(key, { points, at: Date.now() })

    res.json({
      code,
      tf,
      points,
      fetchedAt: new Date().toISOString(),
      kisEnv: env,
      cached: false,
    })
  } catch (e) {
    chartInflight.delete(key)
    const message = e instanceof Error ? e.message : String(e)

    // 한도 초과 시 직전 캐시를 살려서 화면 깨짐 방지
    if (message.includes('EGW00201')) {
      const stale = chartCache.get(key)
      if (stale?.points?.length) {
        res.json({
          code,
          tf,
          points: stale.points,
          fetchedAt: new Date(stale.at).toISOString(),
          kisEnv: env,
          cached: true,
          warning: 'KIS 호출 한도로 캐시 차트를 표시합니다.',
        })
        return
      }
    }

    res.status(502).json({ error: message })
  }
})


app.get('/api/ai-fill', async (req, res) => {
  const appKey = cleanEnvSecret(process.env.KIS_APP_KEY)
  const appSecret = cleanEnvSecret(process.env.KIS_APP_SECRET)
  const aiCfg = getAiConfig()

  if (!aiCfg) {
    res.status(503).json({
      error:
        'AI API 키가 없습니다. 프로젝트 루트 .env 에 ANTHROPIC_API_KEY 를 넣고 프록시 서버(npm run dev 또는 npm run dev:server)를 재시작하세요.',
      stage: 'config',
    })
    return
  }

  const code = String(req.query.code || '005930').replace(/\D/g, '').padStart(6, '0')
  const env = process.env.KIS_ENV === 'prod' ? 'prod' : 'vps'
  const model = aiCfg.model

  let payload
  if (appKey && appSecret) {
    try {
      const quote = await inquireDomesticPrice(appKey, appSecret, env, code)
      const chart5d = await inquireChartByTimeframe(appKey, appSecret, env, code, '5D')
      const chart1m = await inquireChartByTimeframe(appKey, appSecret, env, code, '1M')

      payload = {
        code,
        kisDataAvailable: true,
        quote: {
          nameKr: quote.nameKr,
          market: quote.market,
          price: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
          volume: quote.volume,
        },
        chart: {
          d5: chart5d.slice(-5),
          m1Last22: chart1m.slice(-22),
        },
        timestamp: new Date().toISOString(),
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[api/ai-fill] stage=kis', message)
      res.status(502).json({
        error: `KIS 조회 실패(시세·차트). AI 호출 이전 단계에서 중단되었습니다: ${message}`,
        stage: 'kis',
        hint: '모의투자 호출 한도·토큰 만료·종목코드를 확인하거나, KIS 없이 테스트하려면 .env 에서 KIS_APP_KEY/SECRET 을 비워 두면 됩니다.',
      })
      return
    }
  } else {
    payload = {
      code,
      kisDataAvailable: false,
      quote: null,
      chart: { d5: [], m1Last22: [] },
      timestamp: new Date().toISOString(),
    }
  }

  try {
    const ai = await generateAIFill({ payload })
    res.json({
      code,
      ai,
      model,
      aiProvider: 'anthropic',
      kisDataAvailable: payload.kisDataAvailable === true,
      fetchedAt: new Date().toISOString(),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[api/ai-fill] stage=llm', message)
    res.status(502).json({
      error: message,
      stage: 'llm',
      hint: 'ANTHROPIC_MODEL 이 Anthropic 콘솔에서 허용된 모델 ID인지 확인하세요.',
    })
  }
})

app.get('/api/logic-indicators', async (req, res) => {
  const appKey = cleanEnvSecret(process.env.KIS_APP_KEY)
  const appSecret = cleanEnvSecret(process.env.KIS_APP_SECRET)
  if (!appKey || !appSecret) {
    res.status(503).json({
      error: 'KIS_APP_KEY, KIS_APP_SECRET 이 필요합니다.',
      stage: 'config',
    })
    return
  }

  const code = String(req.query.code || '005930').replace(/\D/g, '').padStart(6, '0')
  const env = process.env.KIS_ENV === 'prod' ? 'prod' : 'vps'
  const key = `${env}:${code}:v5`
  const ttl = logicTtlMs()
  const now = Date.now()

  const cached = logicCache.get(key)
  if (cached && now - cached.at < ttl) {
    res.json({
      code,
      source: 'kis-derived',
      logicIndicators: cached.logicIndicators,
      fetchedAt: new Date(cached.at).toISOString(),
      kisEnv: env,
      cached: true,
    })
    return
  }

  try {
    let task = logicInflight.get(key)
    if (!task) {
      task = (async () => {
        const quote = await inquireDomesticPrice(appKey, appSecret, env, code)
        const [chart1y, indexChart, indexQuote, investor, indexInvestor, consensus] = await Promise.all([
          inquireChartByTimeframe(appKey, appSecret, env, code, '1Y'),
          inquireChartByTimeframe(appKey, appSecret, env, '069500', '1Y').catch(() => []),
          inquireDomesticPrice(appKey, appSecret, env, '069500').catch(() => null),
          inquireInvestorByStock(appKey, appSecret, env, code),
          inquireInvestorByStock(appKey, appSecret, env, '069500').catch(() => null),
          fetchConsensusDetails(code).catch(() => null),
        ])
        return await computeKisLogicIndicators(quote, chart1y, investor, consensus, {
          indexChart,
          indexQuote,
          indexInvestor,
        })
      })()
      logicInflight.set(key, task)
    }
    const logicIndicators = await task
    logicInflight.delete(key)
    logicCache.set(key, { at: Date.now(), logicIndicators })
    res.json({
      code,
      source: 'kis-derived',
      logicIndicators,
      fetchedAt: new Date().toISOString(),
      kisEnv: env,
      cached: false,
    })
  } catch (e) {
    logicInflight.delete(key)
    const message = e instanceof Error ? e.message : String(e)
    const stale = logicCache.get(key)
    if (stale?.logicIndicators) {
      res.json({
        code,
        source: 'kis-derived',
        logicIndicators: stale.logicIndicators,
        fetchedAt: new Date(stale.at).toISOString(),
        kisEnv: env,
        cached: true,
        warning: 'KIS 호출 한도로 캐시 로직 지표를 표시합니다.',
      })
      return
    }
    res.status(502).json({ error: message, stage: 'kis' })
  }
})

/** AI 시나리오 — `/api/ai-stock-scenario`(단일 세그먼트, Vercel·리버스 프록시 호환) + 레거시 `/api/ai/stock-scenario` */
async function handleAiStockScenarioReq(req, res) {
  const appKey = cleanEnvSecret(process.env.KIS_APP_KEY)
  const appSecret = cleanEnvSecret(process.env.KIS_APP_SECRET)
  if (!appKey || !appSecret) {
    res.status(503).json({ error: 'KIS_APP_KEY, KIS_APP_SECRET 이 필요합니다.' })
    return
  }

  const rawCode = req.query.code
  if (!rawCode) {
    res.status(400).json({ error: 'code 필수' })
    return
  }
  const code = String(rawCode).replace(/\D/g, '').padStart(6, '0')
  const env = process.env.KIS_ENV === 'prod' ? 'prod' : 'vps'

  try {
    const indexCtx = await fetchIndexScreeningContext(appKey, appSecret, env)
    const scored = await scoreSingleStock(appKey, appSecret, env, code, indexCtx)

    const stockData = {
      name: scored.name || code,
      sector: scored.sector || '',
      currentPrice: scored.currentPrice,
      changePct: scored.changePct,
      totalScore: scored.totalScore,
      subScores: scored.subScores,
      rsi: scored.subScores?.rsi,
      atrGap: scored.subScores?.atrGap,
      return5D: scored.sectorReturn5D,
      per: scored.per,
      fiveYearAvgPer: null,
      operatingMargin: scored.operatingMargin,
      consensusAvg: null,
      consensusUpside: null,
      foreign3D: scored.supplyDemand3D?.foreign ?? 0,
      institution3D: scored.supplyDemand3D?.institution ?? 0,
    }

    const result = await analyzeStockScenario(code, stockData)
    if (!result) {
      res.status(500).json({ error: 'AI 분석 실패 - null 응답' })
      return
    }
    res.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[/api/ai-stock-scenario]', message)
    res.status(500).json({ error: message })
  }
}

app.get('/api/quote', async (req, res) => {
  const appKey = process.env.KIS_APP_KEY?.trim()
  const appSecret = process.env.KIS_APP_SECRET?.trim()
  if (!appKey || !appSecret) {
    res.status(503).json({
      error:
        '서버에 KIS_APP_KEY, KIS_APP_SECRET 이 설정되지 않았습니다. 프로젝트 루트 .env 경로를 확인하세요.',
      check: {
        envPath: ENV_PATH,
        envFileExists: fs.existsSync(ENV_PATH),
      },
    })
    return
  }

  const code = String(req.query.code || '005930')
  const env = process.env.KIS_ENV === 'prod' ? 'prod' : 'vps'

  try {
    const q = await inquireDomesticPrice(appKey, appSecret, env, code)
    const { raw: _raw, ...rest } = q
    res.json({
      ...rest,
      fetchedAt: new Date().toISOString(),
      kisEnv: env,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    res.status(502).json({ error: message })
  }
})

app.get('/api/ai-stock-scenario', handleAiStockScenarioReq)
app.get('/api/ai/stock-scenario', handleAiStockScenarioReq)

app.get('/api/screening', async (_req, res) => {
  const appKey = process.env.KIS_APP_KEY?.trim()
  const appSecret = process.env.KIS_APP_SECRET?.trim()
  if (!appKey || !appSecret) {
    res.status(503).json({
      error:
        '서버에 KIS_APP_KEY, KIS_APP_SECRET 이 설정되지 않았습니다. 프로젝트 루트 .env 경로를 확인하세요.',
      check: {
        envPath: ENV_PATH,
        envFileExists: fs.existsSync(ENV_PATH),
      },
    })
    return
  }

  const env = process.env.KIS_ENV === 'prod' ? 'prod' : 'vps'

  try {
    const out = await runScreeningSimple(appKey, appSecret, env)
    res.json({
      ...out,
      fetchedAt: new Date().toISOString(),
      kisEnv: env,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    res.status(502).json({ error: message })
  }
})

app.get('/api/compare-stock', async (req, res) => {
  const appKey = process.env.KIS_APP_KEY?.trim()
  const appSecret = process.env.KIS_APP_SECRET?.trim()
  if (!appKey || !appSecret) {
    res.status(503).json({
      error:
        '서버에 KIS_APP_KEY, KIS_APP_SECRET 이 설정되지 않았습니다. 프로젝트 루트 .env 경로를 확인하세요.',
      check: {
        envPath: ENV_PATH,
        envFileExists: fs.existsSync(ENV_PATH),
      },
    })
    return
  }

  const raw = req.query.code
  if (raw == null || String(raw).trim() === '') {
    res.status(400).json({ error: 'code 쿼리가 필요합니다.' })
    return
  }

  const env = process.env.KIS_ENV === 'prod' ? 'prod' : 'vps'

  try {
    const out = await getCompareStockPayload(appKey, appSecret, env, String(raw))
    res.json({
      ...out,
      fetchedAt: new Date().toISOString(),
      kisEnv: env,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    res.status(502).json({ error: message })
  }
})

export default app

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    const exists = fs.existsSync(ENV_PATH)
    const kisOk = Boolean(cleanEnvSecret(process.env.KIS_APP_KEY) && cleanEnvSecret(process.env.KIS_APP_SECRET))
    const aiCfg = getAiConfig()
    const antOk = Boolean(cleanEnvSecret(process.env.ANTHROPIC_API_KEY))
    console.log(`KIS proxy listening on http://127.0.0.1:${PORT}`)
    console.log(`[dotenv] ${ENV_PATH} exists=${exists}`)
    console.log(
      `[ai-fill] KIS=${kisOk ? 'on' : 'off'} Claude=${aiCfg ? aiCfg.model : 'off'} (anthropic_key=${antOk ? 'on' : 'off'})`,
    )
  })
}
