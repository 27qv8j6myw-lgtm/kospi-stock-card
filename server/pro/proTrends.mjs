/**
 * Pro 마켓 트렌드 — activity_logs 익명 집계 (user_id/이름 미포함)
 */

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const ACTIVITY_FETCH_LIMIT = 10_000
const MASTER_IN_CHUNK = 200

/**
 * @param {unknown} metadata
 * @returns {string | null}
 */
function codeFromMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return null
  const raw = String(/** @type {{ code?: string }} */ (metadata).code ?? '')
    .replace(/\D/g, '')
    .padStart(6, '0')
  return raw && raw !== '000000' ? raw : null
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseService
 * @param {string[]} codes
 */
async function fetchMastersByCodes(supabaseService, codes) {
  /** @type {Array<{ code: string, name: string, sector: string | null }>} */
  const all = []
  for (let i = 0; i < codes.length; i += MASTER_IN_CHUNK) {
    const slice = codes.slice(i, i + MASTER_IN_CHUNK)
    const { data, error } = await supabaseService
      .from('stocks_master')
      .select('code, name, sector')
      .in('code', slice)
    if (error) throw new Error(error.message)
    if (data?.length) all.push(...data)
  }
  return all
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseService
 */
export async function buildProTrendsPayload(supabaseService) {
  const since7 = new Date(Date.now() - SEVEN_DAYS_MS).toISOString()

  const { data: acts, error } = await supabaseService
    .from('activity_logs')
    .select('action, metadata, created_at')
    .gte('created_at', since7)
    .limit(ACTIVITY_FETCH_LIMIT)

  if (error) throw new Error(error.message)

  /** @type {Record<string, number>} */
  const viewCount = {}
  /** @type {Record<string, number>} */
  const chatCount = {}

  for (const a of acts || []) {
    if (a.action !== 'view_stock') continue
    const meta =
      a.metadata && typeof a.metadata === 'object' && !Array.isArray(a.metadata)
        ? /** @type {Record<string, unknown>} */ (a.metadata)
        : {}
    const code = codeFromMetadata(a.metadata)
    if (!code) continue

    viewCount[code] = (viewCount[code] || 0) + 1
    if (String(meta.source ?? '') === 'chat') {
      chatCount[code] = (chatCount[code] || 0) + 1
    }
  }

  const popularStocks = Object.entries(viewCount)
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const aiAnalyzed = Object.entries(chatCount)
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const codes = Object.keys(viewCount)
  const masters = codes.length ? await fetchMastersByCodes(supabaseService, codes) : []

  /** @type {Record<string, string>} */
  const nameMap = {}
  /** @type {Record<string, number>} */
  const sectorCount = {}

  for (const m of masters) {
    nameMap[m.code] = m.name || m.code
    const sec = String(m.sector || '').trim() || '기타'
    sectorCount[sec] = (sectorCount[sec] || 0) + (viewCount[m.code] || 0)
  }

  for (const code of codes) {
    if (!nameMap[code]) nameMap[code] = code
    if (!masters.some((m) => m.code === code)) {
      const sec = '기타'
      sectorCount[sec] = (sectorCount[sec] || 0) + (viewCount[code] || 0)
    }
  }

  const sectorDistribution = Object.entries(sectorCount)
    .map(([sector, count]) => ({ sector, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  for (const s of popularStocks) {
    s.name = nameMap[s.code] || s.code
  }
  for (const s of aiAnalyzed) {
    s.name = nameMap[s.code] || s.code
  }

  return { popularStocks, aiAnalyzed, sectorDistribution }
}

/**
 * @param {import('express').Application} app
 * @param {{ getSupabaseService: () => import('@supabase/supabase-js').SupabaseClient | null, getUserIdFromRequest: (req: import('express').Request) => Promise<string | null>, requireProUser: typeof import('../lib/proAccess.mjs').requireProUser }} deps
 */
export function registerProTrendsRoute(app, { getSupabaseService, getUserIdFromRequest, requireProUser }) {
  app.get('/api/pro-trends', async (req, res) => {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    try {
      const payload = await buildProTrendsPayload(supabaseService)
      res.json(payload)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[pro-trends]', message)
      res.status(500).json({ error: message })
    }
  })
}
