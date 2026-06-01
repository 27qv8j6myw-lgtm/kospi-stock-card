import { inquireDomesticPrice } from '../kisClient.mjs'
import { isValidStockCode, normalizeStockCode } from './stockCode.mjs'

/**
 * @param {string | null | undefined} rawMarket
 * @returns {string | null}
 */
export function normalizeMarket(rawMarket) {
  const m = String(rawMarket || '').trim().toUpperCase()
  if (!m) return null
  if (m.includes('KOSDAQ')) return 'KOSDAQ'
  if (m.includes('KOSPI')) return 'KOSPI'
  if (m.includes('KONEX')) return 'KONEX'
  const raw = String(rawMarket).trim()
  return raw || null
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * @param {{ appKey: string, appSecret: string, env: 'prod' | 'vps' }} kis
 * @param {string} code6
 */
export async function fetchQuoteWithRetry(kis, code6) {
  try {
    return await inquireDomesticPrice(kis.appKey, kis.appSecret, kis.env, code6)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!/429|rate|limit|초과/i.test(msg)) throw e
    await sleep(2000)
    return await inquireDomesticPrice(kis.appKey, kis.appSecret, kis.env, code6)
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} code
 * @param {string | null} market
 * @param {boolean} [dryRun]
 */
export async function setStockMarket(supabase, code, market, dryRun = false) {
  if (dryRun) return
  const { error } = await supabase
    .from('stocks_master')
    .update({
      market,
      updated_at: new Date().toISOString(),
    })
    .eq('code', code)
  if (error) throw new Error(`${code}: ${error.message}`)
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ appKey: string, appSecret: string, env: 'prod' | 'vps' }} kis
 * @param {Array<{ code: string, name: string, market: string | null }>} stocks
 * @param {{ dryRun?: boolean, parallel?: number }} [opts]
 */
export async function refreshStockMarketSlice(supabase, kis, stocks, opts = {}) {
  const dryRun = Boolean(opts.dryRun)
  const parallel = Math.min(20, Math.max(1, opts.parallel ?? 10))

  let updated = 0
  let delisted = 0
  let errors = 0
  let unchanged = 0

  for (let i = 0; i < stocks.length; i += parallel) {
    const chunk = stocks.slice(i, i + parallel)
    await Promise.all(
      chunk.map(async (stock) => {
        const code = normalizeStockCode(stock.code)
        if (!isValidStockCode(code)) return

        try {
          const quote = await fetchQuoteWithRetry(kis, code)
          const price = Number(quote?.price)
          const hasPrice = Number.isFinite(price) && price > 0

          if (hasPrice) {
            const mkt =
              normalizeMarket(quote.market) ||
              normalizeMarket(stock.market) ||
              'KOSPI'
            if (stock.market === mkt) {
              unchanged++
            } else {
              await setStockMarket(supabase, code, mkt, dryRun)
              updated++
            }
          } else if (stock.market == null) {
            unchanged++
          } else {
            await setStockMarket(supabase, code, null, dryRun)
            delisted++
          }
        } catch {
          errors++
          try {
            if (stock.market != null) {
              await setStockMarket(supabase, code, null, dryRun)
              delisted++
            } else {
              unchanged++
            }
          } catch {
            /* ignore */
          }
        }
      }),
    )
  }

  return { updated, delisted, errors, unchanged, processed: stocks.length }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {number} offset
 * @param {number} limit
 */
export async function fetchStocksMasterSlice(supabase, offset, limit) {
  const { data, error, count } = await supabase
    .from('stocks_master')
    .select('code,name,market', { count: 'exact' })
    .order('code', { ascending: true })
    .range(offset, offset + limit - 1)
  if (error) throw new Error(error.message)
  return { stocks: data ?? [], total: count ?? 0 }
}
