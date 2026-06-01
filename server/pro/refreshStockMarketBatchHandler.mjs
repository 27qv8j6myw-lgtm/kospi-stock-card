import { getSupabaseService } from '../lib/supabaseService.mjs'
import {
  fetchStocksMasterSlice,
  refreshStockMarketSlice,
} from '../lib/refreshStockMarketCore.mjs'

function cleanEnv(s) {
  if (s == null || typeof s !== 'string') return ''
  let v = s.trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim()
  }
  return v
}

function getKisEnv() {
  const appKey = cleanEnv(process.env.KIS_APP_KEY)
  const appSecret = cleanEnv(process.env.KIS_APP_SECRET)
  const env = process.env.KIS_ENV === 'prod' ? 'prod' : 'vps'
  if (!appKey || !appSecret) {
    throw new Error('KIS_APP_KEY, KIS_APP_SECRET 이 필요합니다')
  }
  return { appKey, appSecret, env }
}

/**
 * @param {import('http').IncomingMessage} req
 */
function parseJsonBody(req) {
  const b = req.body
  if (b == null) return {}
  if (typeof b === 'object') return b
  if (typeof b === 'string' && b.trim()) {
    try {
      return JSON.parse(b)
    } catch {
      return {}
    }
  }
  return {}
}

/**
 * @param {import('http').IncomingMessage} req
 */
function checkRefreshSecret(req) {
  const want = cleanEnv(process.env.STOCK_MARKET_REFRESH_SECRET)
  if (!want) return false
  const header = req.headers['x-stock-market-refresh-secret']
  const fromHeader = Array.isArray(header) ? header[0] : header
  const body = parseJsonBody(req)
  const got = cleanEnv(fromHeader || body.secret)
  return got === want
}

/**
 * POST { secret?, offset?, limit? } — stocks_master.market KIS 기준 배치 갱신
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export async function handleRefreshStockMarketBatch(req, res) {
  if (req.method && req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' })
    return
  }

  if (!checkRefreshSecret(req)) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  const supabase = getSupabaseService()
  if (!supabase) {
    res.status(500).json({ error: 'Supabase service role 없음' })
    return
  }

  const body = parseJsonBody(req)
  const offset = Math.max(0, Number(body.offset ?? 0) || 0)
  const limit = Math.min(30, Math.max(1, Number(body.limit ?? 20) || 20))

  try {
    const kis = getKisEnv()
    const { stocks, total } = await fetchStocksMasterSlice(supabase, offset, limit)
    const stats = await refreshStockMarketSlice(supabase, kis, stocks, { parallel: 10 })
    const nextOffset = offset + stocks.length
    const done = nextOffset >= total || stocks.length === 0

    res.json({
      ok: true,
      offset,
      limit,
      total,
      nextOffset: done ? null : nextOffset,
      done,
      ...stats,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[refresh-stock-market-batch]', message)
    res.status(500).json({ error: message })
  }
}
