import { buildEarningsIntel } from '../earningsIntel.mjs'
import { fetchProChartBars } from './proStockChart.mjs'
import { getCachedOrFetch } from './cacheHelper.mjs'

/**
 * @param {string} code6
 * @param {{ sector?: string | null, marketCap?: number | null } | null} quote
 * @param {{ bars?: Array<{ date?: string, close?: number, volume?: number }> }} [opts]
 */
export async function getProStockSummaryExtras(code6, quote, opts = {}) {
  const code = String(code6).replace(/\D/g, '').padStart(6, '0').slice(0, 6)

  const bars =
    opts.bars?.length > 0
      ? opts.bars.map((b) => ({
          ts: String(b.date ?? ''),
          close: Number(b.close) || 0,
          open: Number(b.open) || Number(b.close) || 0,
          high: Number(b.high) || Number(b.close) || 0,
          low: Number(b.low) || Number(b.close) || 0,
          volume: Number(b.volume) || 0,
        }))
      : await fetchProChartBars(code, 66).catch(() => [])

  const earningsRaw = await getCachedOrFetch(
    `earnings_intel:${code}`,
    () => buildEarningsIntel(code, bars),
    6,
  )

  const earnings = earningsRaw
    ? {
        primary: earningsRaw.earningsPrimary ?? null,
        sub: earningsRaw.earningsSub ?? null,
        subEmphasis: earningsRaw.earningsSubEmphasis ?? 'default',
        riskBadge: earningsRaw.earningsRiskBadge ?? null,
      }
    : null

  return { earnings }
}
