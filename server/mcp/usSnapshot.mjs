/**
 * MCP 커넥터 미국 시장 스냅샷 — 지수·선물·금리·달러·반도체 관심종목을 한 번에.
 *
 * 1차 소스는 Yahoo Finance chart API(비공식, 서버에서만 호출. marketIndices.mjs 가 이미 쓰는 경로)이고,
 * 개별 종목은 실패 시 KIS 해외주식 현재체결가(HHDFS00000300)로 폴백한다.
 * 아침 브리핑에서 "확인 못 함"이 나오던 항목(SOX·VIX·나스닥 선물·WTI/브렌트 근월·10년물·개별 반도체)을
 * 시각·전일 종가와 함께 1차 데이터로 돌려주는 것이 목적이다.
 */
import { inquireOverseasStockPrice } from '../kisClient.mjs'

/** 기본 심볼 그룹 — [야후 심볼, 표시 이름, KIS 거래소(개별주만)] */
export const US_SNAPSHOT_GROUPS = {
  indices: [
    ['^DJI', '다우존스'],
    ['^GSPC', 'S&P 500'],
    ['^IXIC', '나스닥 종합'],
    ['^NDX', '나스닥 100'],
    ['^RUT', '러셀 2000'],
    ['^SOX', '필라델피아 반도체'],
    ['^VIX', 'VIX'],
  ],
  futures: [
    ['NQ=F', '나스닥100 선물 (근월 연속)'],
    ['ES=F', 'S&P500 선물 (근월 연속)'],
    ['CL=F', 'WTI 원유 선물 (근월 연속, $/bbl)'],
    ['BZ=F', '브렌트유 선물 (근월 연속, $/bbl)'],
    ['GC=F', '금 선물 (근월 연속, $/oz)'],
  ],
  rates_fx: [
    ['^TNX', '미국 10년물 금리 (%)'],
    ['^FVX', '미국 5년물 금리 (%)'],
    ['DX-Y.NYB', '달러인덱스 (DXY)'],
    ['KRW=X', '원/달러'],
  ],
  stocks: [
    ['NVDA', '엔비디아', 'NAS'],
    ['MU', '마이크론', 'NAS'],
    ['AMD', 'AMD', 'NAS'],
    ['AVGO', '브로드컴', 'NAS'],
    ['INTC', '인텔', 'NAS'],
    ['TSM', 'TSMC ADR', 'NYS'],
    ['CRWV', '코어위브', 'NAS'],
    ['SOXL', 'SOXL (반도체 3배)', 'AMS'],
    ['SMH', 'SMH (반도체 ETF)', 'NAS'],
    ['EWY', 'EWY (한국 ETF)', 'AMS'],
  ],
}

const GROUP_NAMES = Object.keys(US_SNAPSHOT_GROUPS)
const MAX_EXTRA_SYMBOLS = 15
const FETCH_CONCURRENCY = 6
const FETCH_TIMEOUT_MS = 8_000
const CACHE_TTL_MS = 60_000
const YAHOO_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'

/** 심볼별 메모리 캐시 — 서버리스 인스턴스 안에서만 유효 */
const cache = new Map()

function numberOrNull(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function round(n, digits = 2) {
  if (n == null || !Number.isFinite(n)) return null
  const f = 10 ** digits
  return Math.round(n * f) / f
}

/** epoch(초) → 'YYYY-MM-DD HH:MM' (해당 시간대) */
export function formatEpoch(epochSec, timeZone) {
  if (epochSec == null || !Number.isFinite(Number(epochSec))) return null
  return new Intl.DateTimeFormat('sv-SE', { timeZone, dateStyle: 'short', timeStyle: 'short' }).format(new Date(Number(epochSec) * 1000))
}

/** epoch(초) → 'YYYYMMDD' (뉴욕 기준 거래일) */
function nyYmd(epochSec) {
  if (epochSec == null) return null
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/New_York' }).format(new Date(Number(epochSec) * 1000)).replace(/-/g, '')
}

/**
 * 연속 상승·하락 일수 — 종가 배열(오래된 순)의 끝에서 거슬러 센다.
 * @param {number[]} closes
 * @returns {{ direction: 'up' | 'down' | 'flat', days: number } | null}
 */
export function streakFromCloses(closes) {
  const c = (closes ?? []).filter((x) => Number.isFinite(x))
  if (c.length < 2) return null
  const last = c.at(-1) - c.at(-2)
  if (last === 0) return { direction: 'flat', days: 0 }
  const direction = last > 0 ? 'up' : 'down'
  let days = 0
  for (let i = c.length - 1; i >= 1; i -= 1) {
    const d = c[i] - c[i - 1]
    if ((direction === 'up' && d > 0) || (direction === 'down' && d < 0)) days += 1
    else break
  }
  return { direction, days }
}

/**
 * Yahoo chart 응답(JSON) → 정리된 스냅샷. 네트워크 없이 테스트할 수 있게 분리.
 * @param {string} symbol
 * @param {any} json
 */
export function parseYahooChart(symbol, json) {
  const result = json?.chart?.result?.[0]
  if (!result) throw new Error(json?.chart?.error?.description || 'Yahoo 응답에 결과가 없습니다')
  const meta = result.meta ?? {}
  const price = numberOrNull(meta.regularMarketPrice)
  if (price == null) throw new Error('현재가(regularMarketPrice)가 없습니다')

  const timestamps = Array.isArray(result.timestamp) ? result.timestamp : []
  const closesRaw = result.indicators?.quote?.[0]?.close ?? []
  /** @type {{date: string, close: number}[]} */
  const dailyCloses = []
  timestamps.forEach((ts, i) => {
    const c = numberOrNull(closesRaw[i])
    if (c != null) dailyCloses.push({ date: nyYmd(ts), close: round(c, 4) })
  })
  // 마지막 봉이 진행 중인 당일이면 그 전 봉이 전일 종가
  const lastSessionDate = nyYmd(meta.regularMarketTime)
  const settled = dailyCloses.filter((d) => d.date !== lastSessionDate)
  // chartPreviousClose 는 조회 범위(5일) 시작 전 종가라 전일 종가가 아니다 — 확정 봉의 마지막 종가를 먼저 쓴다
  const prevClose = settled.at(-1)?.close ?? numberOrNull(meta.previousClose) ?? numberOrNull(meta.chartPreviousClose) ?? null
  const change = prevClose != null ? price - prevClose : null
  const streakCloses = [...settled.map((d) => d.close), price]

  return {
    symbol,
    price: round(price, 4),
    prevClose: round(prevClose, 4),
    change: round(change, 4),
    changePct: prevClose ? round((change / prevClose) * 100, 2) : null,
    dayHigh: round(numberOrNull(meta.regularMarketDayHigh), 4),
    dayLow: round(numberOrNull(meta.regularMarketDayLow), 4),
    volume: numberOrNull(meta.regularMarketVolume),
    currency: meta.currency ?? null,
    exchange: meta.fullExchangeName ?? meta.exchangeName ?? null,
    marketTimeET: formatEpoch(meta.regularMarketTime, 'America/New_York'),
    marketTimeKST: formatEpoch(meta.regularMarketTime, 'Asia/Seoul'),
    sessionDate: lastSessionDate,
    dailyCloses: dailyCloses.slice(-5),
    streak: streakFromCloses(streakCloses),
    source: 'yahoo',
  }
}

/**
 * @param {string} symbol
 * @param {typeof fetch} [fetchImpl]
 */
export async function fetchYahooChart(symbol, fetchImpl = fetch) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetchImpl(url, { headers: { 'User-Agent': YAHOO_UA }, signal: controller.signal })
    if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`)
    return parseYahooChart(symbol, await res.json())
  } finally {
    clearTimeout(timer)
  }
}

/** @returns {[string, string, 'prod' | 'vps'] | null} */
function kisCredentials() {
  const clean = (v) => String(v ?? '').trim().replace(/^(["'])(.*)\1$/, '$2').trim()
  const key = clean(process.env.KIS_APP_KEY)
  const secret = clean(process.env.KIS_APP_SECRET)
  if (!key || !secret) return null
  return [key, secret, process.env.KIS_ENV === 'prod' ? 'prod' : 'vps']
}

/**
 * 개별주 폴백 — KIS 해외주식 현재체결가.
 * @param {string} symbol
 * @param {string} exchange NAS·NYS·AMS
 */
async function fetchKisOverseas(symbol, exchange) {
  const creds = kisCredentials()
  if (!creds) throw new Error('KIS 인증정보 없음')
  const q = await inquireOverseasStockPrice(...creds, exchange, symbol)
  return {
    symbol,
    price: round(q.price, 4),
    prevClose: round(q.prevClose, 4),
    change: round(q.change, 4),
    changePct: round(q.changePct, 2),
    volume: q.volume,
    currency: 'USD',
    exchange: q.exchange,
    marketTimeET: null,
    marketTimeKST: null,
    sessionDate: null,
    dailyCloses: null,
    streak: null,
    source: 'kis',
  }
}

/**
 * 한 심볼 조회 (캐시 → Yahoo → KIS 폴백).
 * @param {{symbol: string, label: string, group: string, kisExchange?: string}} spec
 * @param {{fetchImpl?: typeof fetch, now?: number}} [deps]
 */
async function fetchOne(spec, deps = {}) {
  const now = deps.now ?? Date.now()
  const hit = cache.get(spec.symbol)
  if (hit && now - hit.at < CACHE_TTL_MS) return { ...hit.value, label: spec.label, group: spec.group, cached: true }

  const errors = []
  try {
    const value = await fetchYahooChart(spec.symbol, deps.fetchImpl)
    cache.set(spec.symbol, { at: now, value })
    return { ...value, label: spec.label, group: spec.group }
  } catch (e) {
    errors.push(`yahoo: ${e instanceof Error ? e.message : String(e)}`)
  }
  if (spec.kisExchange) {
    try {
      const value = await fetchKisOverseas(spec.symbol, spec.kisExchange)
      cache.set(spec.symbol, { at: now, value })
      return { ...value, label: spec.label, group: spec.group }
    } catch (e) {
      errors.push(`kis: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return { symbol: spec.symbol, label: spec.label, group: spec.group, error: errors.join(' / ') }
}

/**
 * 입력 → 조회할 심볼 목록.
 * @param {{groups?: string[], symbols?: string[]}} input
 */
export function planSymbols({ groups, symbols } = {}) {
  const wanted = Array.isArray(groups) && groups.length > 0 ? groups : GROUP_NAMES
  for (const g of wanted) if (!GROUP_NAMES.includes(g)) throw new Error(`groups 는 ${GROUP_NAMES.join('·')} 중에서 고르세요`)
  /** @type {{symbol: string, label: string, group: string, kisExchange?: string}[]} */
  const specs = []
  for (const g of wanted) {
    for (const [symbol, label, kisExchange] of US_SNAPSHOT_GROUPS[g]) specs.push({ symbol, label, group: g, kisExchange })
  }
  const extra = (Array.isArray(symbols) ? symbols : []).map((s) => String(s ?? '').trim().toUpperCase()).filter(Boolean)
  if (extra.length > MAX_EXTRA_SYMBOLS) throw new Error(`symbols 는 최대 ${MAX_EXTRA_SYMBOLS}개입니다`)
  for (const symbol of extra) {
    if (!/^[\^A-Z0-9.=\-]{1,12}$/.test(symbol)) throw new Error(`심볼 형식이 아닙니다: ${symbol}`)
    if (specs.some((s) => s.symbol === symbol)) continue
    // 사용자 추가 심볼은 야후만 — 거래소를 모르면 KIS 폴백 불가
    specs.push({ symbol, label: symbol, group: 'extra', kisExchange: /^[A-Z]{1,5}$/.test(symbol) ? 'NAS' : undefined })
  }
  return specs
}

/**
 * 미국 시장 스냅샷.
 * @param {{groups?: string[], symbols?: string[]}} input
 * @param {{fetchImpl?: typeof fetch, now?: number}} [deps] 테스트 주입용
 */
export async function getUsSnapshot(input = {}, deps = {}) {
  const specs = planSymbols(input)
  /** @type {any[]} */
  const results = []
  for (let i = 0; i < specs.length; i += FETCH_CONCURRENCY) {
    const chunk = specs.slice(i, i + FETCH_CONCURRENCY)
    results.push(...(await Promise.all(chunk.map((spec) => fetchOne(spec, deps)))))
  }

  /** @type {Record<string, any[]>} */
  const groups = {}
  const failed = []
  for (const r of results) {
    if (r.error) {
      failed.push({ symbol: r.symbol, label: r.label, error: r.error })
      continue
    }
    ;(groups[r.group] ??= []).push(r)
  }

  const retrievedAt = new Date(deps.now ?? Date.now())
  return {
    retrievedAt: retrievedAt.toISOString(),
    retrievedAtKST: formatEpoch(retrievedAt.getTime() / 1000, 'Asia/Seoul'),
    retrievedAtET: formatEpoch(retrievedAt.getTime() / 1000, 'America/New_York'),
    source: 'Yahoo Finance chart API (비공식, 15분 이내 지연 가능) · 개별주 폴백 KIS 해외주식 현재체결가',
    note:
      'price 는 조회 시점의 최근 체결가라 미국 정규장(한국 22:30~05:00, 서머타임 해제 뒤 23:30~06:00) 밖에서는 직전 종가 또는 선물·프리장 값입니다. marketTimeET/KST 가 그 가격의 시각입니다. "=F" 는 근월물 연속 선물이라 월물·거래소가 다른 기사 수치와 다를 수 있고, ^TNX·^FVX 는 % 단위 금리입니다. streak 는 dailyCloses 기준 연속 상승·하락 일수(당일 미완성 봉 포함).',
    count: results.length - failed.length,
    groups,
    failed: failed.length ? failed : null,
  }
}
