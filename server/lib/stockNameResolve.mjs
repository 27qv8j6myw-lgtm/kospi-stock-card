/**
 * 종목 표시명 결정: DB → KIS → DART → 네이버 → 코드
 */
import { getStockNameFromDart } from './dartStocks.mjs'
import { getStockNameFromNaver } from './naverStockName.mjs'
import { isValidStockCode, normalizeKisIscd, normalizeStockCode } from './stockCode.mjs'
import { isValidStockDisplayName, pickStockDisplayName } from './stockDisplayName.mjs'

/**
 * @param {string} code
 * @param {{ dbName?: string | null, kisName?: string | null }} [opts]
 * @returns {Promise<string>}
 */
export async function resolveStockDisplayName(code, opts = {}) {
  const code6 = normalizeStockCode(code) || normalizeKisIscd(code)
  if (!isValidStockCode(code6)) return String(code || '').trim()

  const dbName = opts.dbName != null ? String(opts.dbName).trim() : ''
  if (dbName && isValidStockDisplayName(dbName, code6)) return dbName

  const kisName = opts.kisName != null ? String(opts.kisName).trim() : ''
  if (kisName && isValidStockDisplayName(kisName, code6)) return kisName

  const dartName = await getStockNameFromDart(code6)
  if (dartName && isValidStockDisplayName(dartName, code6)) return dartName

  const naverName = await getStockNameFromNaver(code6)
  if (naverName && isValidStockDisplayName(naverName, code6)) return naverName

  return pickStockDisplayName(code6, kisName, dartName, naverName)
}
