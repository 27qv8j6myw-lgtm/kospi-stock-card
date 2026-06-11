/**
 * 홈·Pro 시장 지표 스트립 — KIS 우선, 실패 시 Yahoo 폴백
 * @typedef {{ key: string, label: string, value: number | null, change: number | null }} MarketSummaryIndex
 */
import {
  inquireDomesticIndexPrice,
  inquireOverseasIndexOrFxSnapshot,
} from './kisClient.mjs'
import { fetchYahooMarketSnapshot, getWtiPrice } from './marketIndices.mjs'

/** @type {Record<string, string>} */
const YAHOO_FALLBACK = {
  kospi: '^KS11',
  kosdaq: '^KQ11',
  nasdaq: '^IXIC',
  sp500: '^GSPC',
  usdkrw: 'KRW=X',
}

/**
 * @param {string} key
 * @param {string} label
 * @param {() => Promise<{ value: number, changePct?: number } | null>} kisFetch
 * @returns {Promise<MarketSummaryIndex>}
 */
async function resolveIndexRow(key, label, kisFetch) {
  try {
    const snap = await kisFetch()
    if (snap?.value != null && Number.isFinite(snap.value)) {
      return {
        key,
        label,
        value: snap.value,
        change: snap.changePct != null && Number.isFinite(snap.changePct) ? snap.changePct : null,
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`[marketSummary] ${key} KIS:`, msg)
  }

  const yahooSymbol = YAHOO_FALLBACK[key]
  if (yahooSymbol) {
    try {
      const y = await fetchYahooMarketSnapshot(yahooSymbol)
      if (y?.value != null && Number.isFinite(y.value)) {
        console.log(`[marketSummary] ${key} Yahoo fallback OK`)
        return {
          key,
          label,
          value: y.value,
          change: y.changePct != null && Number.isFinite(y.changePct) ? y.changePct : null,
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`[marketSummary] ${key} Yahoo:`, msg)
    }
  }

  return { key, label, value: null, change: null }
}

/**
 * @param {string} appKey
 * @param {string} appSecret
 * @param {'prod'|'vps'} env
 * @returns {Promise<{ indices: MarketSummaryIndex[], generatedAt: string }>}
 */
export async function getMarketSummary(appKey, appSecret, env) {
  const kis = { appKey, appSecret, env }

  const rows = await Promise.all([
    resolveIndexRow('kospi', 'KOSPI', () =>
      inquireDomesticIndexPrice(kis.appKey, kis.appSecret, kis.env, '0001'),
    ),
    resolveIndexRow('kosdaq', 'KOSDAQ', () =>
      inquireDomesticIndexPrice(kis.appKey, kis.appSecret, kis.env, '1001'),
    ),
    resolveIndexRow('nasdaq', '나스닥', () =>
      inquireOverseasIndexOrFxSnapshot(kis.appKey, kis.appSecret, kis.env, 'N', 'COMP'),
    ),
    resolveIndexRow('sp500', 'S&P 500', () =>
      inquireOverseasIndexOrFxSnapshot(kis.appKey, kis.appSecret, kis.env, 'N', 'SPX'),
    ),
    resolveIndexRow('usdkrw', 'USD/KRW', () =>
      inquireOverseasIndexOrFxSnapshot(kis.appKey, kis.appSecret, kis.env, 'X', 'FX@KRW'),
    ),
    resolveIndexRow('wti', 'WTI', () => getWtiPrice()),
  ])

  return {
    indices: rows,
    generatedAt: new Date().toISOString(),
  }
}

/** KOSPI 값이 있을 때만 캐시·응답 유효 */
export function isMarketSummaryUsable(data) {
  if (!data?.indices?.length) return false
  const kospi = data.indices.find((i) => i.key === 'kospi')
  return kospi?.value != null && Number.isFinite(kospi.value)
}
