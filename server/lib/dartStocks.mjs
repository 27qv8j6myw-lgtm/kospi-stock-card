/**
 * DART corpCode 기반 종목명 (public/data/stocks.json 캐시)
 */
import { loadStocksJsonFile } from './loadStocksJsonFile.mjs'
import { isValidStockCode, normalizeStockCode } from './stockCode.mjs'

/** @type {Array<{ code: string, name: string }> | null} */
let cachedStocks = null
/** @type {number} */
let cachedAt = 0

const CACHE_TTL_MS = 60 * 60 * 1000

/**
 * @returns {Promise<Array<{ code: string, name: string }>>}
 */
export async function getDartStocks() {
  if (cachedStocks && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedStocks
  }

  try {
    const data = await loadStocksJsonFile()
    cachedStocks = (data.stocks || [])
      .map((s) => {
        const code = normalizeStockCode(s?.code)
        const name = String(s?.name ?? '').trim()
        return code && name ? { code, name } : null
      })
      .filter(Boolean)
    cachedAt = Date.now()
    return cachedStocks
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[dartStocks] load 실패:', msg)
    return cachedStocks || []
  }
}

/**
 * @param {string} code
 * @returns {Promise<string | null>}
 */
export async function getStockNameFromDart(code) {
  const code6 = normalizeStockCode(code)
  if (!isValidStockCode(code6)) return null

  const stocks = await getDartStocks()
  const direct = stocks.find((s) => s.code === code6)
  if (direct?.name) return direct.name

  const withoutA = code6.startsWith('A') ? code6.slice(1) : null
  if (withoutA && isValidStockCode(withoutA)) {
    const hit = stocks.find((s) => s.code === withoutA)
    if (hit?.name) return hit.name
  }

  const withA = `A${code6}`
  const hitA = stocks.find((s) => s.code === withA)
  return hitA?.name || null
}
