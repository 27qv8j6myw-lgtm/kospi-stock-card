/**
 * Pro 대시보드 — 투자자별 순매수/순매도 상위
 */
import { getTopFlowStocks, getTopFlowStocksByInvestor } from '../kisClient.mjs'
import { getCachedOrFetch } from './cacheHelper.mjs'
import { isValidStockDisplayName, pickStockDisplayName } from './stockMasterKisLookup.mjs'
import { screeningStockNameKr } from '../screening/sectorMaster.mjs'

function cleanEnv(s) {
  if (s == null || typeof s !== 'string') return ''
  let v = s.trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim()
  }
  return v
}

function getKisCreds() {
  const appKey = cleanEnv(process.env.KIS_APP_KEY)
  const appSecret = cleanEnv(process.env.KIS_APP_SECRET)
  const env = process.env.KIS_ENV === 'prod' ? 'prod' : 'vps'
  if (!appKey || !appSecret) {
    throw new Error('KIS_APP_KEY, KIS_APP_SECRET 이 필요합니다.')
  }
  return { appKey, appSecret, env }
}

/** @param {string} raw */
function normalizeInvestor(raw) {
  const v = String(raw || 'foreign').toLowerCase()
  if (v === 'institution' || v === 'individual') return v
  return 'foreign'
}

/** @param {string} raw */
function normalizeTradeType(raw) {
  return String(raw || 'buy').toLowerCase() === 'sell' ? 'sell' : 'buy'
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseService
 * @param {Awaited<ReturnType<typeof getTopFlowStocks>>} stocks
 */
async function enrichTopFlowNames(supabaseService, stocks) {
  if (!stocks?.length) return []

  const codes = stocks.map((s) => s.code).filter(Boolean)
  const { data: masterStocks } = await supabaseService
    .from('stocks_master')
    .select('code, name, market')
    .in('code', codes)

  const masterMap = Object.fromEntries((masterStocks || []).map((s) => [s.code, s]))
  /** @type {{ code: string, name: string, market: string | null }[]} */
  const toRegister = []

  const enriched = stocks.map((item) => {
    const master = masterMap[item.code]
    const name = pickStockDisplayName(
      item.code,
      master?.name,
      item.name,
      screeningStockNameKr(item.code),
    )

    if (master?.name && isValidStockDisplayName(master.name, item.code)) {
      return {
        ...item,
        name,
        market: master.market ?? item.market,
      }
    }

    if (isValidStockDisplayName(item.name, item.code)) {
      toRegister.push({
        code: item.code,
        name: String(item.name).trim(),
        market: item.market || null,
      })
      return { ...item, name }
    }

    return { ...item, name: item.code }
  })

  if (toRegister.length > 0) {
    const { error } = await supabaseService
      .from('stocks_master')
      .upsert(
        toRegister.map((row) => ({
          code: row.code,
          name: row.name,
          market: row.market && String(row.market).trim() ? row.market : 'KOSPI',
          sector: '—',
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'code' },
      )
    if (!error) {
      console.log(`[Auto-register] TopFlow ${toRegister.length}개`)
    } else {
      console.warn('[Auto-register TopFlow]', error.message)
    }
  }

  return enriched
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient | null} supabaseService
 * @param {{ investor?: string, type?: string }} query
 */
export async function fetchProTopFlow(supabaseService, query = {}) {
  const investor = normalizeInvestor(query.investor)
  const type = normalizeTradeType(query.type)
  const { appKey, appSecret, env } = getKisCreds()

  const cacheKey = `top_flow_all:${type}`
  /** @type {Awaited<ReturnType<typeof getTopFlowStocksByInvestor>>} */
  const all = await getCachedOrFetch(
    cacheKey,
    () => getTopFlowStocksByInvestor(appKey, appSecret, env, type, 10),
    5 / 60,
  )

  let stocks = Array.isArray(all?.[investor]) ? all[investor] : []

  if (supabaseService && stocks.length > 0) {
    stocks = await enrichTopFlowNames(supabaseService, stocks)
  }

  return {
    stocks,
    investor,
    type,
    updatedAt: new Date().toISOString(),
  }
}
