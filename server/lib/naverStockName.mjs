/**
 * 네이버 금융 HTML — KIS/DART 에 종목명이 없을 때 보조
 */
import { isValidStockCode, normalizeKisIscd, normalizeStockCode } from './stockCode.mjs'
import { isValidStockDisplayName } from './stockDisplayName.mjs'

/**
 * @param {string} code
 * @returns {Promise<string | null>}
 */
export async function getStockNameFromNaver(code) {
  const code6 = normalizeStockCode(code) || normalizeKisIscd(code)
  if (!isValidStockCode(code6)) return null

  const cleanCode = code6.replace(/^A/, '')

  try {
    const resp = await fetch(
      `https://finance.naver.com/item/main.naver?code=${encodeURIComponent(cleanCode)}`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; Signal15/1.0; +https://signal15.vercel.app)',
          Accept: 'text/html',
        },
        signal: AbortSignal.timeout(10_000),
      },
    )
    if (!resp.ok) return null

    const html = await resp.text()
    const match = html.match(/<title>([^<]+?)\s*:/i)
    const name = match?.[1]?.trim() || null
    if (!name) return null
    if (/네이버|에러|404|not found/i.test(name)) return null
    if (!isValidStockDisplayName(name, code6)) return null
    return name
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn(`[naverStockName] ${code6}:`, msg)
    return null
  }
}
