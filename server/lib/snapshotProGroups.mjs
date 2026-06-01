/**
 * Pro 그룹 일별 평가 스냅샷 (Vercel Cron · service_role)
 */
import { getKisQuote } from './toolExecutor.mjs'
import { isValidStockCode, normalizeKisIscd } from './stockCode.mjs'

const QUOTE_DELAY_MS = 120

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * @returns {string} YYYY-MM-DD (Asia/Seoul)
 */
export function seoulSnapshotDateKey(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/**
 * @param {import('http').IncomingMessage} req
 */
export function verifyCronSecret(req) {
  const secret = String(process.env.CRON_SECRET || '').trim()
  if (!secret) return false
  const auth = req.headers?.authorization
  const header = Array.isArray(auth) ? auth[0] : auth
  return header === `Bearer ${secret}`
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseService
 * @param {{ snapshotDate?: string }} [opts]
 */
export async function runProGroupSnapshots(supabaseService, opts = {}) {
  const snapshotDate = opts.snapshotDate || seoulSnapshotDateKey()

  const { error: delErr } = await supabaseService
    .from('pro_group_snapshots')
    .delete()
    .eq('snapshot_date', snapshotDate)

  if (delErr) throw new Error(`스냅샷 삭제 실패: ${delErr.message}`)

  const { data: groups, error: groupErr } = await supabaseService
    .from('pro_groups')
    .select('id, user_id, initial_capital, cash_balance')

  if (groupErr) throw new Error(groupErr.message)

  const { data: holdings, error: holdErr } = await supabaseService
    .from('pro_holdings')
    .select('group_id, code, quantity, avg_price')

  if (holdErr) throw new Error(holdErr.message)

  /** @type {Record<string, Array<{ code: string, quantity: number, avgPrice: number }>>} */
  const byGroup = {}
  for (const h of holdings || []) {
    const gid = String(h.group_id || '')
    if (!gid) continue
    const code = normalizeKisIscd(h.code)
    if (!isValidStockCode(code)) continue
    const quantity = Number(h.quantity) || 0
    if (quantity <= 0) continue
    const avgPrice = Number(h.avg_price) || 0
    if (!byGroup[gid]) byGroup[gid] = []
    byGroup[gid].push({ code, quantity, avgPrice })
  }

  /** @type {Map<string, number>} */
  const priceCache = new Map()

  /**
   * @param {string} code6
   */
  async function priceForCode(code6) {
    if (priceCache.has(code6)) return priceCache.get(code6)
    let price = 0
    try {
      const quote = await getKisQuote(code6)
      price = Number(quote?.currentPrice) || 0
    } catch {
      price = 0
    }
    priceCache.set(code6, price)
    await sleep(QUOTE_DELAY_MS)
    return price
  }

  /** @type {Array<Record<string, unknown>>} */
  const rows = []

  for (const g of groups || []) {
    const groupId = String(g.id)
    const items = byGroup[groupId] || []
    let stockValue = 0
    let totalCost = 0

    for (const h of items) {
      const price = await priceForCode(h.code)
      stockValue += price * h.quantity
      totalCost += h.avgPrice * h.quantity
    }

    const cash = Number(g.cash_balance) || 0
    const totalValue = stockValue + cash
    const initial = Number(g.initial_capital) || 0
    /** 평가손익 % = (V − P) / P × 100 (자산현황과 동일, 종목별 단순평균 금지) */
    const returnPct = totalCost > 0 ? ((stockValue - totalCost) / totalCost) * 100 : null

    rows.push({
      user_id: g.user_id,
      group_id: g.id,
      snapshot_date: snapshotDate,
      total_value: totalValue,
      stock_value: stockValue,
      cash_balance: cash,
      initial_capital: initial,
      return_pct: returnPct,
    })
  }

  if (rows.length) {
    const { error: upsertErr } = await supabaseService.from('pro_group_snapshots').upsert(rows, {
      onConflict: 'user_id,group_id,snapshot_date',
    })
    if (upsertErr) throw new Error(upsertErr.message)
  }

  return {
    ok: true,
    date: snapshotDate,
    groups: groups?.length || 0,
    saved: rows.length,
    uniqueQuotes: priceCache.size,
  }
}
