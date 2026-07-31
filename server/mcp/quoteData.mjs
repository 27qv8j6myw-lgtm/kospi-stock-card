/**
 * MCP 커넥터 시세 조회 — KIS 현재가와 관심종목.
 *
 * 대화에서 "삼성전자 지금 얼마야" 처럼 이름으로 물어보는 경우가 많으므로
 * 6자리 코드와 종목명을 모두 받아 코드로 해석한 뒤 조회한다.
 */
import { isValidStockCode, normalizeKisIscd } from '../lib/stockCode.mjs'
import { searchStocksMaster } from '../lib/stocksMasterSearch.mjs'
import { getSupabaseService } from '../lib/supabaseService.mjs'
import { getKisQuote } from '../lib/toolExecutor.mjs'

/** 한 번에 조회할 종목 상한 — 응답 크기와 KIS 레이트 리밋을 함께 고려 */
const MAX_SYMBOLS = 20
const MAX_WATCHLIST = 40

/** 현재가 동시 조회 수 — KIS 레이트 리밋 회피 (portfolioData.mjs 와 동일) */
const QUOTE_CONCURRENCY = 4

/** @param {number | null | undefined} n */
function won(n) {
  if (n == null || !Number.isFinite(Number(n))) return null
  return Math.round(Number(n))
}

/** @param {number | null | undefined} n */
function pct(n) {
  if (n == null || !Number.isFinite(Number(n))) return null
  return Math.round(Number(n) * 100) / 100
}

/** null·빈 값 필드를 제거해 응답을 짧게 유지 */
function compact(obj) {
  /** @type {Record<string, unknown>} */
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v == null || v === '') continue
    out[k] = v
  }
  return out
}

/** 시세는 시각이 중요하므로 날짜만이 아니라 서울 시간까지 남긴다 */
function seoulNow() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date())
}

function requireSupabase() {
  const supabase = getSupabaseService()
  if (!supabase) throw new Error('Supabase 서비스 키가 설정되지 않았습니다')
  return supabase
}

/**
 * 입력 하나를 6자리 코드로 해석한다. 코드가 아니면 종목명으로 검색한다.
 * @param {string} symbol
 * @returns {Promise<{ code: string, matchedName?: string } | { error: string }>}
 */
async function resolveSymbol(symbol) {
  const raw = String(symbol ?? '').trim()
  if (!raw) return { error: '빈 값' }

  const asCode = normalizeKisIscd(raw)
  if (isValidStockCode(asCode)) return { code: asCode }

  const found = await searchStocksMaster(raw, 10)
  if (!found.ok || !Array.isArray(found.items) || found.items.length === 0) {
    return { error: '종목을 찾지 못했습니다' }
  }

  // 정확히 같은 이름이 있으면 우선한다 (예: "삼성전자" 가 "삼성전자우" 보다 먼저)
  const exact = found.items.find((it) => String(it.name ?? '').trim() === raw)
  const picked = exact ?? found.items[0]
  const code = normalizeKisIscd(picked?.code)
  if (!isValidStockCode(code)) return { error: '종목을 찾지 못했습니다' }
  return { code, matchedName: String(picked?.name ?? '').trim() }
}

/**
 * KIS 현재가 응답에는 한글 종목명이 없을 때가 많아 마스터에서 채운다.
 * 카탈로그를 새로 쓰지 않도록 조회만 한다 (도구는 읽기 전용).
 * @param {string[]} codes
 * @returns {Promise<Map<string, string>>}
 */
async function fetchNames(codes) {
  /** @type {Map<string, string>} */
  const names = new Map()
  const unique = [...new Set(codes)]
  if (unique.length === 0) return names

  const supabase = getSupabaseService()
  if (!supabase) return names

  const { data, error } = await supabase
    .from('stocks_master')
    .select('code, name')
    .in('code', unique)
  if (error) {
    console.warn('[mcp/quote] 종목명 조회 실패:', error.message)
    return names
  }
  for (const row of data ?? []) {
    const code = normalizeKisIscd(row.code)
    const name = String(row.name ?? '').trim()
    if (code && name && name !== code) names.set(code, name)
  }
  return names
}

/** @param {string} code */
async function quoteOne(code) {
  const q = await getKisQuote(code)
  return compact({
    code: q.code,
    name: q.name,
    market: q.market,
    sector: q.sector,
    price: won(q.currentPrice),
    change: won(q.change),
    changePct: pct(q.changePct),
    open: won(q.openPrice),
    dayHigh: won(q.dayHigh),
    dayLow: won(q.dayLow),
    volume: won(q.volume),
    tradingValue: won(q.tradingValue),
    marketCap: won(q.marketCap),
    per: pct(q.per),
    pbr: pct(q.pbr),
    eps: won(q.eps),
    bps: won(q.bps),
    dividendYield: pct(q.dividendYield),
    foreignHoldingRate: pct(q.foreignHoldingRate),
  })
}

/**
 * 코드 목록의 현재가를 소량씩 병렬 조회. 실패한 종목은 null 로 남긴다.
 * @param {string[]} codes
 * @returns {Promise<Map<string, Record<string, unknown> | null>>}
 */
async function quoteMany(codes) {
  const unique = [...new Set(codes)]
  /** @type {Map<string, Record<string, unknown> | null>} */
  const out = new Map()

  for (let i = 0; i < unique.length; i += QUOTE_CONCURRENCY) {
    const chunk = unique.slice(i, i + QUOTE_CONCURRENCY)
    const results = await Promise.all(
      chunk.map(async (code) => {
        try {
          return /** @type {const} */ ([code, await quoteOne(code)])
        } catch (e) {
          console.warn('[mcp/quote]', code, e instanceof Error ? e.message : String(e))
          return /** @type {const} */ ([code, null])
        }
      }),
    )
    for (const [code, quote] of results) out.set(code, quote)
  }

  return out
}

/**
 * 종목 현재가. 코드와 종목명을 섞어 넣을 수 있다.
 * @param {string[]} symbols
 */
export async function getQuotes(symbols) {
  const list = (Array.isArray(symbols) ? symbols : [symbols])
    .map((s) => String(s ?? '').trim())
    .filter(Boolean)
    .slice(0, MAX_SYMBOLS)

  if (list.length === 0) throw new Error('조회할 종목을 하나 이상 넣어주세요')

  const resolved = await Promise.all(list.map((s) => resolveSymbol(s)))

  /** @type {{ input: string, reason: string }[]} */
  const unresolved = []
  /** @type {{ input: string, code: string, matchedName: string }[]} */
  const targets = []
  resolved.forEach((r, i) => {
    if ('error' in r) unresolved.push({ input: list[i], reason: r.error })
    else targets.push({ input: list[i], code: r.code, matchedName: r.matchedName ?? '' })
  })

  const codes = targets.map((t) => t.code)
  const [quotes, names] = await Promise.all([quoteMany(codes), fetchNames(codes)])

  const items = targets.map((t) => {
    const quote = quotes.get(t.code)
    if (!quote) return { code: t.code, error: '시세 조회 실패' }
    const better = names.get(t.code) || t.matchedName
    return better ? { ...quote, name: better } : quote
  })

  return compact({
    asOf: seoulNow(),
    timezone: 'Asia/Seoul',
    currency: 'KRW',
    note: '장중에는 실시간에 가까운 값, 장 마감 후에는 종가입니다',
    quotes: items,
    unresolved: unresolved.length > 0 ? unresolved : null,
  })
}

/**
 * 관심종목(감시 리스트) + 현재가. 2군 후보 추적처럼 목록 단위로 볼 때 사용한다.
 * @param {string} userId
 * @param {{ includeQuotes?: boolean }} [opts]
 */
export async function getWatchlist(userId, opts = {}) {
  const includeQuotes = opts.includeQuotes !== false
  const supabase = requireSupabase()

  const { data, error } = await supabase
    .from('pro_watchlist')
    .select('code, note, added_at')
    .eq('user_id', userId)
    .order('added_at', { ascending: false })
    .limit(MAX_WATCHLIST)
  if (error) throw new Error(error.message)

  const rows = (data ?? [])
    .map((r) => ({
      code: normalizeKisIscd(r.code),
      note: r.note ? String(r.note).trim() : '',
      addedAt: r.added_at ? String(r.added_at).slice(0, 10) : '',
    }))
    .filter((r) => isValidStockCode(r.code))

  if (rows.length === 0) {
    return { asOf: seoulNow(), count: 0, items: [] }
  }

  const codes = rows.map((r) => r.code)
  // 시세를 생략해도 이름은 보여줘야 하므로 이름은 항상 가져온다.
  const [quotes, names] = await Promise.all([
    includeQuotes ? quoteMany(codes) : Promise.resolve(new Map()),
    fetchNames(codes),
  ])

  const items = rows.map((r) => {
    const quote = quotes.get(r.code)
    return compact({
      code: r.code,
      name: names.get(r.code) || quote?.name || r.code,
      note: r.note,
      addedAt: r.addedAt,
      price: quote?.price ?? null,
      changePct: quote?.changePct ?? null,
      dayHigh: quote?.dayHigh ?? null,
      dayLow: quote?.dayLow ?? null,
      volume: quote?.volume ?? null,
      marketCap: quote?.marketCap ?? null,
      per: quote?.per ?? null,
      pbr: quote?.pbr ?? null,
    })
  })

  return compact({
    asOf: seoulNow(),
    timezone: 'Asia/Seoul',
    currency: 'KRW',
    count: items.length,
    truncated: (data ?? []).length >= MAX_WATCHLIST ? true : null,
    items,
  })
}
