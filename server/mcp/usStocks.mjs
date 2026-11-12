/**
 * MCP 커넥터 미국 개별종목 — KIS 해외주식 API 로 일봉·분봉·현재가상세를 직접 가져온다.
 *
 * get_us_snapshot(Yahoo) 이 못 주는 것: 긴 일봉(수정주가), 분봉, 52주·PER·시총·원화환산.
 * 거래소(NAS·NYS·AMS)를 모르면 차례로 시도해 맞는 곳을 찾고 인스턴스 안에서 기억한다.
 */
import { inquireOverseasDailyBars, inquireOverseasMinuteBars, inquireOverseasPriceDetail } from '../kisClient.mjs'

const EXCHANGES = ['NAS', 'NYS', 'AMS']
const SYMBOL_RE = /^[A-Z0-9.\-]{1,16}$/
/** 심볼 → 거래소 (찾은 뒤 재사용) */
const exchangeCache = new Map([
  ['NVDA', 'NAS'], ['MU', 'NAS'], ['AMD', 'NAS'], ['AVGO', 'NAS'], ['INTC', 'NAS'], ['CRWV', 'NAS'], ['SMH', 'NAS'],
  ['TSM', 'NYS'], ['SOXL', 'AMS'], ['EWY', 'AMS'],
])

function credentials() {
  const clean = (v) => String(v ?? '').trim().replace(/^(["'])(.*)\1$/, '$2').trim()
  const key = clean(process.env.KIS_APP_KEY)
  const secret = clean(process.env.KIS_APP_SECRET)
  if (!key || !secret) throw new Error('KIS 인증정보가 설정되지 않았습니다')
  return [key, secret, process.env.KIS_ENV === 'prod' ? 'prod' : 'vps']
}

function normSymbol(symbol) {
  const s = String(symbol ?? '').trim().toUpperCase()
  if (!SYMBOL_RE.test(s)) throw new Error(`미국 종목 심볼 형식이 아닙니다: ${symbol}`)
  return s
}

function round(n, digits = 4) {
  if (n == null || !Number.isFinite(n)) return null
  const f = 10 ** digits
  return Math.round(n * f) / f
}

/**
 * 거래소를 정해 fn 을 실행. exchange 가 주어지면 그곳만, 아니면 캐시 → NAS → NYS → AMS 순.
 * @template T
 * @param {string} symbol
 * @param {string | undefined} exchange
 * @param {(excd: string) => Promise<T>} fn
 * @returns {Promise<{exchange: string, value: T}>}
 */
export async function withExchange(symbol, exchange, fn) {
  if (exchange) {
    const excd = String(exchange).trim().toUpperCase()
    if (!EXCHANGES.includes(excd)) throw new Error(`exchange 는 ${EXCHANGES.join('·')} 중 하나여야 합니다`)
    return { exchange: excd, value: await fn(excd) }
  }
  const known = exchangeCache.get(symbol)
  const order = known ? [known, ...EXCHANGES.filter((e) => e !== known)] : EXCHANGES
  const errors = []
  for (const excd of order) {
    try {
      const value = await fn(excd)
      exchangeCache.set(symbol, excd)
      return { exchange: excd, value }
    } catch (e) {
      errors.push(`${excd}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  throw new Error(`${symbol} 을(를) NAS·NYS·AMS 어디에서도 찾지 못했습니다 (${errors.join(' / ')})`)
}

/** 현지(ET) HHMMSS → 세션 구분 */
export function usSession(hhmmss) {
  const t = Number(String(hhmmss ?? '').slice(0, 4))
  if (!Number.isFinite(t)) return null
  if (t < 930) return 'pre'
  if (t < 1600) return 'regular'
  return 'after'
}

const fmtDateTime = (ymd, hms) => (ymd && hms ? `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)} ${hms.slice(0, 2)}:${hms.slice(2, 4)}` : null)

function meta(symbol, exchange) {
  return { symbol, exchange, retrievedAt: new Date().toISOString(), currency: 'USD', source: 'KIS 해외주식' }
}

/**
 * 미국 종목 일봉(주봉·월봉).
 * @param {{symbol: string, limit?: number, end_date?: string, period?: 'D'|'W'|'M', adjusted?: boolean, exchange?: string}} input
 */
export async function getUsDailyBars({ symbol, limit, end_date, period, adjusted, exchange }) {
  const sym = normSymbol(symbol)
  const requested = limit ?? 60
  if (!Number.isInteger(requested) || requested < 1 || requested > 500) throw new Error('limit은 1~500 정수여야 합니다')
  if (end_date != null && !/^\d{8}$/.test(end_date)) throw new Error('end_date는 YYYYMMDD 형식이어야 합니다')
  const adj = adjusted !== false
  const creds = credentials()
  const { exchange: excd, value } = await withExchange(sym, exchange, (e) =>
    inquireOverseasDailyBars(...creds, e, sym, { period: period ?? 'D', endDate: end_date, adjusted: adj, maxBars: requested }))
  const bars = value.bars
  return {
    ...meta(sym, excd), period: period ?? 'D', adjusted: adj, requested, count: bars.length, pages: value.pages,
    fromDate: bars[0]?.date ?? null, latestDataDate: bars.at(-1)?.date ?? null,
    note: '날짜는 미국 현지 거래일입니다. 오래된 순이며 최신 봉은 장중이면 미완성입니다. 정규장 기준 OHLCV 이고 시간외 체결은 포함하지 않습니다.' +
      (adj ? ' 수정주가(분할·배당 반영)라 당시 실제 호가와 다를 수 있습니다.' : ''),
    bars,
  }
}

/**
 * 미국 종목 분봉 — 최근 최대 120개.
 * @param {{symbol: string, interval?: number, limit?: number, include_prev?: boolean, exchange?: string}} input
 */
export async function getUsMinuteBars({ symbol, interval, limit, include_prev, exchange }) {
  const sym = normSymbol(symbol)
  const nmin = interval ?? 5
  if (![1, 5, 10, 15, 30, 60].includes(nmin)) throw new Error('interval 은 1·5·10·15·30·60 중 하나여야 합니다')
  const requested = limit ?? 60
  if (!Number.isInteger(requested) || requested < 1 || requested > 120) throw new Error('limit은 1~120 정수여야 합니다')
  const creds = credentials()
  const { exchange: excd, value } = await withExchange(sym, exchange, (e) =>
    inquireOverseasMinuteBars(...creds, e, sym, { nmin, includePrev: include_prev === true, maxBars: requested }))
  const bars = value.slice(-requested).map((b) => ({
    timeET: fmtDateTime(b.localDate, b.localTime), timeKST: fmtDateTime(b.kstDate, b.kstTime), session: usSession(b.localTime),
    open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume,
  }))
  const sessions = [...new Set(bars.map((b) => b.session).filter(Boolean))]
  return {
    ...meta(sym, excd), intervalMinutes: nmin, requested, count: bars.length, sessions,
    fromET: bars[0]?.timeET ?? null, toET: bars.at(-1)?.timeET ?? null,
    note: 'KIS 가 한 번에 최근 120개까지만 줍니다. session 은 현지 시각 기준 pre(09:30 전)·regular·after(16:00 이후)이며, 시간외 봉이 실제로 오는지는 KIS 응답에 따릅니다 — sessions 에 pre/after 가 없으면 정규장 봉만 온 것입니다.',
    bars,
  }
}

/**
 * 미국 종목 현재가상세 (최대 10종목) + 최근 1분봉으로 본 마지막 체결.
 * @param {{symbols: string[], exchange?: string}} input
 */
export async function getUsQuotes({ symbols, exchange }) {
  const list = [...new Set((Array.isArray(symbols) ? symbols : []).map(normSymbol))]
  if (list.length === 0) throw new Error('symbols 가 비어 있습니다')
  if (list.length > 10) throw new Error('symbols 는 최대 10개입니다')
  const creds = credentials()
  const quotes = []
  const failed = []
  for (const sym of list) {
    try {
      const { exchange: excd, value: d } = await withExchange(sym, exchange, (e) => inquireOverseasPriceDetail(...creds, e, sym))
      /** @type {any} */
      let lastTrade = null
      try {
        const mins = await inquireOverseasMinuteBars(...creds, excd, sym, { nmin: 1, maxBars: 5 })
        const b = mins.at(-1)
        if (b) {
          lastTrade = { price: b.close, timeET: fmtDateTime(b.localDate, b.localTime), timeKST: fmtDateTime(b.kstDate, b.kstTime), session: usSession(b.localTime),
            vsRegularPct: d.price ? round(((b.close - d.price) / d.price) * 100, 2) : null }
        }
      } catch { /* 분봉 실패는 상세만 반환 */ }
      quotes.push({
        symbol: sym, exchange: excd, price: round(d.price), prevClose: round(d.prevClose), change: round(d.change), changePct: round(d.changePct, 2),
        open: round(d.open), high: round(d.high), low: round(d.low), volume: d.volume, prevVolume: d.prevVolume,
        high52w: round(d.high52w), low52w: round(d.low52w), per: d.per, pbr: d.pbr, eps: d.eps, marketCap: d.marketCap,
        krwPrice: d.krwPrice, fxRate: d.fxRate, lastTrade,
      })
    } catch (e) {
      failed.push({ symbol: sym, error: e instanceof Error ? e.message : String(e) })
    }
  }
  return {
    retrievedAt: new Date().toISOString(), currency: 'USD', source: 'KIS 해외주식 현재가상세(HHDFS76200200) + 1분봉',
    note: 'price·changePct 는 KIS 정규장 기준(전일 종가 base 대비)입니다. lastTrade 는 가장 최근 1분봉의 종가·시각이고 session 이 pre/after 면 시간외 체결, vsRegularPct 는 price 대비 괴리입니다. KIS 무료 시세는 지연될 수 있고 krwPrice 는 KIS 고시 환율 환산값입니다.',
    count: quotes.length, quotes, failed: failed.length ? failed : null,
  }
}
