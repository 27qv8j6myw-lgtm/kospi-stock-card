/** Yahoo Finance chart API (비공식) — 시장 지수 스냅샷, 서버 5분 캐시 */

let cachedIndices = null
let cachedAt = 0
const CACHE_TTL_MS = 5 * 60 * 1000

const SYMBOLS = [
  { key: 'usdkrw', yahooSymbol: 'KRW=X', label: 'USD/KRW', format: 'price' },
  { key: 'kospi', yahooSymbol: '^KS11', label: 'KOSPI', format: 'index' },
  { key: 'kospi200', yahooSymbol: '^KS200', label: 'KOSPI200', format: 'index' },
  { key: 'wti', yahooSymbol: 'CL=F', label: 'WTI', format: 'usd' },
  { key: 'vix', yahooSymbol: '^VIX', label: 'VIX', format: 'index' },
]

/**
 * @param {string} yahooSymbol
 * @returns {Promise<{ value: number, changePct: number } | null>}
 */
async function fetchYahooSnapshot(yahooSymbol) {
  const data = await fetchYahooQuote(yahooSymbol)
  if (!data) return null
  return { value: data.price, changePct: data.changePct }
}

/** KIS 지수 실패 시 market-summary 폴백 */
export async function fetchYahooMarketSnapshot(yahooSymbol) {
  return fetchYahooSnapshot(yahooSymbol)
}

/**
 * KIS 전면 장애 시 국내 종목 시세 폴백 — KOSPI(.KS) → KOSDAQ(.KQ) 순서 시도.
 * @param {string} code6
 * @returns {Promise<{ price: number, changePct: number } | null>}
 */
export async function fetchYahooKrxQuote(code6) {
  const code = String(code6 ?? '').replace(/\D/g, '').padStart(6, '0').slice(0, 6)
  if (!code || code === '000000') return null
  for (const suffix of ['.KS', '.KQ']) {
    const data = await fetchYahooQuote(`${code}${suffix}`)
    if (data && Number.isFinite(data.price) && data.price > 0) {
      return { price: data.price, changePct: data.changePct }
    }
  }
  return null
}

/** 종목 카드 PageHeader·market-summary 공용 */
export async function getWtiPrice() {
  return fetchYahooSnapshot('CL=F')
}

/** 종목 카드 PageHeader·market-summary 공용 */
export async function getVixIndex() {
  return fetchYahooSnapshot('^VIX')
}

/**
 * @param {string} symbol
 */
async function fetchYahooQuote(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      },
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }

    const data = await res.json()
    const result = data?.chart?.result?.[0]

    if (!result) {
      throw new Error('No data')
    }

    const meta = result.meta
    const current = meta.regularMarketPrice
    const prevClose = meta.chartPreviousClose ?? meta.previousClose

    if (current == null || prevClose == null || !Number.isFinite(current) || !Number.isFinite(prevClose)) {
      throw new Error('Missing price data')
    }

    const changePct = ((current - prevClose) / prevClose) * 100

    return {
      price: current,
      prevClose,
      changePct,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`[MarketIndices] ${symbol} failed:`, msg)
    return null
  }
}

export async function getMarketIndices() {
  if (cachedIndices && Date.now() - cachedAt < CACHE_TTL_MS) {
    return { ...cachedIndices, source: 'cache' }
  }

  console.log('[MarketIndices] Fetching fresh data')

  const results = await Promise.all(
    SYMBOLS.map(async (s) => {
      const data = await fetchYahooQuote(s.yahooSymbol)
      return { key: s.key, label: s.label, format: s.format, data }
    }),
  )

  const indices = {}
  for (const r of results) {
    if (r.data) {
      indices[r.key] = {
        label: r.label,
        format: r.format,
        price: r.data.price,
        changePct: r.data.changePct,
      }
    }
  }

  const result = {
    indices,
    generatedAt: new Date().toISOString(),
  }

  cachedIndices = result
  cachedAt = Date.now()

  return { ...result, source: 'fresh' }
}
