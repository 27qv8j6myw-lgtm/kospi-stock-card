import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { inquireChartByTimeframe, inquireDomesticPrice, inquireInvestorByStock } from './kisClient.mjs'
import { completeJsonChat, getAiConfig } from './aiClient.mjs'
import {
  buildSourceList,
  generateMarketBriefingWithAi,
  searchBrokerReports,
  searchLatestNews,
} from './marketBriefing.mjs'

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
const logicCache = new Map()
const logicInflight = new Map()

function chartTtlMs(tf) {
  return tf === '3D' ? 5_000 : 10 * 60_000
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

  let latestEst = 0
  for (const row of comp) {
    const raw = String(row.EST_DT || '').trim()
    const normalized = raw.replace(/\//g, '-')
    const ts = Date.parse(normalized)
    if (Number.isFinite(ts) && ts > latestEst) latestEst = ts
  }
  const lastUpdateDays =
    latestEst > 0 ? Math.max(0, Math.floor((Date.now() - latestEst) / 86_400_000)) : null

  return {
    avgTargetPrice,
    maxTargetPrice: safeMax,
    minTargetPrice: safeMin,
    analystCount: comp.length,
    lastUpdateDays,
    avgRecomCd,
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
  const [fg, nv] = await Promise.all([
    fetchFnGuideConsensus(code6).catch(() => null),
    fetchNaverConsensus(code6).catch(() => null),
  ])

  if (fg) {
    return {
      source: 'fnguide',
      avgTargetPrice: fg.avgTargetPrice,
      maxTargetPrice: fg.maxTargetPrice,
      minTargetPrice: fg.minTargetPrice,
      recommendationScore: fg.avgRecomCd ?? nv?.recommendationScore ?? null,
      recommendationText: nv?.recommendationText ?? recommendationLabelFromFnGuideScore(fg.avgRecomCd),
      analystCount: fg.analystCount,
      lastUpdateDays: fg.lastUpdateDays ?? nv?.lastUpdateDays ?? null,
    }
  }
  if (nv) return nv
  return null
}

function computeKisLogicIndicators(quote, chart1m, investor, consensus) {
  const closes = chart1m.map((p) => Number(p.price)).filter((n) => Number.isFinite(n))
  const last = closes.length ? closes[closes.length - 1] : quote.price
  const prev = closes.length > 1 ? closes[closes.length - 2] : last
  const sma20 = closes.length >= 20 ? mean(closes.slice(-20)) : mean(closes)
  const rsi = computeRsi(closes, 14)
  const mfiProxy = rsi == null ? null : clamp(rsi - 3, 0, 100)

  let upStreak = 0
  for (let i = closes.length - 1; i > 0; i--) {
    if (closes[i] > closes[i - 1]) upStreak += 1
    else break
  }
  let downStreak = 0
  for (let i = closes.length - 1; i > 0; i--) {
    if (closes[i] < closes[i - 1]) downStreak += 1
    else break
  }

  const rets = []
  const diffs = []
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) rets.push((closes[i] - closes[i - 1]) / closes[i - 1])
    diffs.push(Math.abs(closes[i] - closes[i - 1]))
  }
  const volDaily = stddev(rets.slice(-20))
  const volPct = volDaily * Math.sqrt(252) * 100
  const atrProxy = diffs.length ? mean(diffs.slice(-14)) : 0
  const atrGap = atrProxy > 0 ? Math.abs(last - sma20) / atrProxy : 0

  const m5Base = closes.length >= 6 ? closes[closes.length - 6] : prev
  const m20Base = closes.length >= 21 ? closes[closes.length - 21] : prev
  const m5 = m5Base > 0 ? ((last - m5Base) / m5Base) * 100 : 0
  const m20 = m20Base > 0 ? ((last - m20Base) / m20Base) * 100 : 0

  const trend = sma20 > 0 ? ((last - sma20) / sma20) * 100 : 0
  const structureScore = Math.round(clamp(50 + trend * 6 + m20 * 1.2, 1, 99))
  const executionScore = Math.round(
    clamp(
      55 +
        (rsi == null ? 0 : (50 - Math.abs(50 - rsi)) * 0.5) -
        volPct * 0.35 +
        Math.abs(m5) * 0.8,
      1,
      99,
    ),
  )

  const market =
    Math.abs(quote.changePercent) >= 2.5
      ? `Caution (일중 변동 ${quote.changePercent.toFixed(2)}%)`
      : `Neutral (일중 변동 ${quote.changePercent.toFixed(2)}%)`

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
  const volatility = `연환산 변동성 ${volPct.toFixed(1)}%`
  const momentum = `5일 ${m5 >= 0 ? '+' : ''}${m5.toFixed(2)}% · 20일 ${m20 >= 0 ? '+' : ''}${m20.toFixed(2)}%`
  const candle = quote.change >= 0 ? '양봉(종가 우위) · 단기 상승 압력' : '음봉(종가 약세) · 단기 조정 압력'
  const stats = `20일 평균 ${Math.round(sma20).toLocaleString('ko-KR')}원 대비 ${trend >= 0 ? '+' : ''}${trend.toFixed(2)}%`
  const rotation =
    Math.abs(m20) >= 6 ? (m20 > 0 ? 'Risk-On' : 'Risk-Off') : 'Neutral'
  const structureState =
    trend >= 1.5 ? '상승장 유지 / 눌림 대기' : trend <= -1.5 ? '하락장 진행 / 반등 경계' : '횡보 / 방향성 약함'
  const adjustment = `CMF20 ${(m5 / 10).toFixed(2)} / Flow20 ${(quote.changePercent / 5).toFixed(2)}x`
  const candleQuality = `CLV5 ${(m5 / 20).toFixed(2)} / CLV10 ${(m20 / 20).toFixed(2)}`
  const liquidity = `ADV20 ${(Number(quote.tradeValue || 0) / 1_0000_0000_0000).toFixed(2)}조 / RVOL20 ${(Number(quote.volume || 0) / 50_000_000).toFixed(2)}x`
  const indicator = `RSI ${rsi == null ? 'N/A' : rsi.toFixed(0)} / MFI ${mfiProxy == null ? 'N/A' : mfiProxy.toFixed(0)}`
  const unusual = upStreak >= 4 || downStreak >= 4 ? `연속 ${upStreak >= 4 ? '상승' : '하락'} ${Math.max(upStreak, downStreak)}일` : '특이사항 없음'

  return {
    structure: `${structureScore} / 100`,
    execution: `${executionScore} / 100`,
    market,
    flow,
    technical: `RSI ${rsi == null ? 'N/A' : rsi.toFixed(1)} | SMA20 ${Math.round(sma20).toLocaleString('ko-KR')}`,
    stats,
    atrGap: `${atrGap.toFixed(1)} ATR`,
    streak: upStreak > 0 ? `연속상승 ${upStreak}일` : downStreak > 0 ? `연속하락 ${downStreak}일` : '연속 없음',
    rotation,
    structureState,
    adjustment,
    candleQuality,
    liquidity,
    indicator,
    unusual,
    rsi: rsi == null ? 'RSI 데이터 부족' : `RSI ${rsi.toFixed(1)}`,
    volume,
    volatility,
    foreign,
    institution,
    momentum,
    candle,
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
  const tf = String(req.query.tf || '3D')
  if (!['3D', '1W', '1M', '3M', '1Y'].includes(tf)) {
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
      const chart1w = await inquireChartByTimeframe(appKey, appSecret, env, code, '1W')
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
          w1Last7: chart1w.slice(-7),
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
      chart: { w1Last7: [], m1Last22: [] },
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
        const chart1m = await inquireChartByTimeframe(appKey, appSecret, env, code, '1M')
        const investor = await inquireInvestorByStock(appKey, appSecret, env, code)
        const consensus = await fetchConsensusDetails(code).catch(() => null)
        return computeKisLogicIndicators(quote, chart1m, investor, consensus)
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
