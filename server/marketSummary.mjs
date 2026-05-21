/**
 * 홈 시장 지표 스트립 — KIS 지수/환율 API (국내 FHPUP02100000, 해외 FHKST03030200)
 * @typedef {{ key: string, label: string, value: number | null, change: number | null }} MarketSummaryIndex
 */
import {
  inquireDomesticIndexPrice,
  inquireOverseasIndexOrFxSnapshot,
} from './kisClient.mjs'
import { getWtiPrice } from './marketIndices.mjs'

/** @type {Array<{ key: string, label: string, fetch: () => Promise<{ value: number, changePct: number } | null> }>} */
const SOURCES = [
  {
    key: 'kospi',
    label: 'KOSPI',
    fetch: (kis) => inquireDomesticIndexPrice(kis.appKey, kis.appSecret, kis.env, '0001'),
  },
  {
    key: 'kosdaq',
    label: 'KOSDAQ',
    fetch: (kis) => inquireDomesticIndexPrice(kis.appKey, kis.appSecret, kis.env, '1001'),
  },
  {
    key: 'nasdaq',
    label: '나스닥',
    fetch: (kis) => inquireOverseasIndexOrFxSnapshot(kis.appKey, kis.appSecret, kis.env, 'N', 'COMP'),
  },
  {
    key: 'sp500',
    label: 'S&P 500',
    fetch: (kis) => inquireOverseasIndexOrFxSnapshot(kis.appKey, kis.appSecret, kis.env, 'N', 'SPX'),
  },
  {
    key: 'usdkrw',
    label: 'USD/KRW',
    fetch: (kis) => inquireOverseasIndexOrFxSnapshot(kis.appKey, kis.appSecret, kis.env, 'X', 'FX@KRW'),
  },
  {
    key: 'wti',
    label: 'WTI',
    fetch: () => getWtiPrice(),
  },
]

/**
 * @param {string} appKey
 * @param {string} appSecret
 * @param {'prod'|'vps'} env
 * @returns {Promise<{ indices: MarketSummaryIndex[], generatedAt: string }>}
 */
export async function getMarketSummary(appKey, appSecret, env) {
  const kis = { appKey, appSecret, env }
  const rows = await Promise.all(
    SOURCES.map(async (s) => {
      try {
        const snap = await s.fetch(kis)
        return {
          key: s.key,
          label: s.label,
          value: snap?.value ?? null,
          change: snap?.changePct ?? null,
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`[marketSummary] ${s.key}:`, msg)
        return { key: s.key, label: s.label, value: null, change: null }
      }
    }),
  )
  return {
    indices: rows,
    generatedAt: new Date().toISOString(),
  }
}
