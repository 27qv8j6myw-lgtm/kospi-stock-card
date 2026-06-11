/**
 * 관리자 — Pro 권한·Pro 활동 통계 API
 */
import { createUserSupabaseFromRequest } from '../lib/auth.mjs'
import { calcCost } from '../lib/pricing.mjs'
import { buildUserMap, isAdminUserEmail } from '../lib/userInfo.mjs'
import {
  handleAdminSyncStocksBatch,
  handleAdminSyncStocksFetch,
} from './adminSyncStocksHandlers.mjs'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const ACTIVITY_FETCH_LIMIT = 10_000
const USAGE_FETCH_LIMIT = 10_000

/** @returns {string} 서울 기준 오늘 00:00 ISO */
function seoulTodayStartIso() {
  const key = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  return new Date(`${key}T00:00:00+09:00`).toISOString()
}

/**
 * @param {string} userId
 * @returns {{ view_stock: number, chat: number, diagnosis: number, add_holding: number, lastSeen: string | null }}
 */
function emptyActivityBucket() {
  return { view_stock: 0, chat: 0, diagnosis: 0, add_holding: 0, lastSeen: null }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseService
 * @param {string[]} codes
 */
async function stockNameMap(supabaseService, codes) {
  if (!codes.length) return {}
  const { data: stocks } = await supabaseService
    .from('stocks_master')
    .select('code, name')
    .in('code', codes)
  return Object.fromEntries((stocks || []).map((s) => [s.code, s.name]))
}

/**
 * @param {unknown} metadata
 * @returns {string | null}
 */
/**
 * @param {string} endpoint
 * @returns {'analysis' | 'chat' | 'diagnosis' | 'other'}
 */
function usageCostCategory(endpoint) {
  const ep = String(endpoint || '')
  if (ep === 'chat-stream' || ep === 'chat') return 'chat'
  if (ep.includes('diagnosis')) return 'diagnosis'
  if (ep === 'stock-analysis' || ep === 'news-summary') return 'analysis'
  return 'other'
}

function codeFromMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return null
  const raw = String(/** @type {{ code?: string }} */ (metadata).code ?? '')
    .replace(/\D/g, '')
    .padStart(6, '0')
  return raw && raw !== '000000' ? raw : null
}

/**
 * @param {Record<string, Record<string, number>>} byUser
 * @param {ReturnType<typeof buildUserMap>} userMap
 * @param {Record<string, string>} codeNameMap
 */
function buildUserStockList(byUser, userMap, codeNameMap) {
  return Object.entries(byUser)
    .map(([uid, codes]) => {
      const info = userMap[uid] || {
        userId: uid,
        name: uid.slice(0, 8),
        email: '',
        avatar: null,
      }
      const stocks = Object.entries(codes)
        .map(([code, count]) => ({
          code,
          count,
          name: codeNameMap[code] || code,
        }))
        .sort((a, b) => b.count - a.count)
      const total = stocks.reduce((s, x) => s + x.count, 0)
      return {
        userId: info.userId,
        name: info.name,
        email: info.email,
        avatar: info.avatar,
        isAdmin: isAdminUserEmail(info.email),
        stocks,
        total,
        stockCount: stocks.length,
      }
    })
    .sort((a, b) => b.total - a.total)
}

/**
 * @param {import('express').Application} app
 * @param {{ getSupabaseService: () => import('@supabase/supabase-js').SupabaseClient | null, getUserIdFromRequest: (req: import('express').Request) => Promise<string | null> }} deps
 */
export function registerAdminProRoutes(app, { getSupabaseService, getUserIdFromRequest }) {
  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async function requireAdmin(req, res) {
    const userId = await getUserIdFromRequest(req)
    if (!userId) {
      res.status(401).json({ error: '인증 필요' })
      return null
    }

    const userSupabase = createUserSupabaseFromRequest(req)
    if (!userSupabase) {
      res.status(401).json({ error: '토큰 없음' })
      return null
    }

    const { data: isAdmin, error } = await userSupabase.rpc('is_admin')
    if (error || !isAdmin) {
      console.log('[admin-pro] is_admin 결과:', isAdmin, 'error:', error?.message)
      res.status(403).json({ error: '관리자 권한 필요' })
      return null
    }

    return userId
  }

  function sevenDaysAgoIso() {
    return new Date(Date.now() - SEVEN_DAYS_MS).toISOString()
  }

  /**
   * @param {import('@supabase/supabase-js').SupabaseClient} supabaseService
   * @param {string[]} userIds
   */
  async function emailMapForUserIds(supabaseService, userIds) {
    if (!userIds.length) return {}
    const { data: listData } = await supabaseService.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const users = listData?.users ?? []
    const want = new Set(userIds)
    return Object.fromEntries(
      users.filter((u) => want.has(u.id)).map((u) => [u.id, u.email ?? '?']),
    )
  }

  app.post('/api/admin-pro-toggle', async (req, res) => {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    if (!(await requireAdmin(req, res))) return

    const targetUserId = String(req.body?.userId ?? '').trim()
    const enabled = Boolean(req.body?.enabled)
    if (!targetUserId) {
      res.status(400).json({ error: 'userId 필요' })
      return
    }

    const { error } = await supabaseService.from('user_settings').upsert(
      {
        user_id: targetUserId,
        pro_enabled: enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.json({ ok: true })
  })

  app.get('/api/admin-pro-stats-users', async (req, res) => {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }
    if (!(await requireAdmin(req, res))) return

    try {
      const since = sevenDaysAgoIso()
      const { data: logs, error } = await supabaseService
        .from('activity_logs')
        .select('user_id')
        .eq('is_pro', true)
        .eq('action', 'view_stock')
        .gte('created_at', since)

      if (error) {
        res.status(500).json({ error: error.message })
        return
      }

      /** @type {Record<string, number>} */
      const counts = {}
      for (const log of logs || []) {
        if (!log.user_id) continue
        counts[log.user_id] = (counts[log.user_id] || 0) + 1
      }

      const userIds = Object.keys(counts)
      const userMap = await emailMapForUserIds(supabaseService, userIds)

      const result = Object.entries(counts)
        .map(([userId, count]) => ({
          user_id: userId,
          email: userMap[userId] || '?',
          count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20)

      res.json({ users: result })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[admin-pro-stats-users]', e)
      res.status(500).json({ error: message })
    }
  })

  /** 관리 탭 사용자 목록 — 사용자별 그룹/보유종목 수 */
  app.get('/api/admin-user-portfolio-counts', async (req, res) => {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }
    if (!(await requireAdmin(req, res))) return

    try {
      const [holdingsRes, groupsRes] = await Promise.all([
        supabaseService.from('pro_holdings').select('user_id'),
        supabaseService.from('pro_groups').select('user_id'),
      ])
      if (holdingsRes.error) {
        res.status(500).json({ error: holdingsRes.error.message })
        return
      }
      if (groupsRes.error) {
        res.status(500).json({ error: groupsRes.error.message })
        return
      }

      /** @type {Record<string, { groups: number, holdings: number }>} */
      const counts = {}
      const bucket = (uid) => (counts[uid] ??= { groups: 0, holdings: 0 })
      for (const row of holdingsRes.data || []) {
        if (row.user_id) bucket(row.user_id).holdings += 1
      }
      for (const row of groupsRes.data || []) {
        if (row.user_id) bucket(row.user_id).groups += 1
      }

      res.json({ counts })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[admin-user-portfolio-counts]', e)
      res.status(500).json({ error: message })
    }
  })

  /**
   * 관리 탭 비용 섹션 — Anthropic Cost Report Admin API 실제 청구액(USD).
   * Anthropic은 잔여 크레딧 조회 API를 제공하지 않아 청구 비용만 연동한다.
   */
  app.get('/api/admin-anthropic-cost', async (req, res) => {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }
    if (!(await requireAdmin(req, res))) return

    const adminKey = (process.env.ANTHROPIC_ADMIN_API_KEY ?? '').trim()
    if (!adminKey) {
      res.status(503).json({
        error: 'ANTHROPIC_ADMIN_API_KEY 미설정',
        hint: 'Anthropic 콘솔에서 Admin API 키(sk-ant-admin…)를 발급해 Vercel 환경변수로 추가하세요.',
      })
      return
    }

    const days = Math.min(Math.max(Number(req.query?.days) || 30, 1), 90)
    const cacheKey = `anthropic-cost:${days}`

    try {
      const { data: cachedRow } = await supabaseService
        .from('market_cache')
        .select('data')
        .eq('cache_key', cacheKey)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()
      if (cachedRow?.data) {
        res.json(cachedRow.data)
        return
      }

      const endingAt = new Date()
      const startingAt = new Date(endingAt.getTime() - days * DAY_MS)

      /** @type {Record<string, number>} 일자(YYYY-MM-DD) → USD */
      const byDay = {}
      let page = null
      for (let i = 0; i < 10; i++) {
        const url = new URL('https://api.anthropic.com/v1/organizations/cost_report')
        url.searchParams.set('starting_at', startingAt.toISOString())
        url.searchParams.set('ending_at', endingAt.toISOString())
        url.searchParams.set('bucket_width', '1d')
        if (page) url.searchParams.set('page', page)

        const r = await fetch(url, {
          headers: { 'x-api-key': adminKey, 'anthropic-version': '2023-06-01' },
        })
        if (!r.ok) {
          const text = await r.text()
          throw new Error(`Anthropic cost_report ${r.status}: ${text.slice(0, 200)}`)
        }
        const body = await r.json()
        for (const bucket of body?.data ?? []) {
          const day = String(bucket?.starting_at ?? '').slice(0, 10)
          if (!day) continue
          for (const item of bucket?.results ?? []) {
            const cents = Number(item?.amount)
            if (Number.isFinite(cents)) byDay[day] = (byDay[day] ?? 0) + cents / 100
          }
        }
        if (!body?.has_more || !body?.next_page) break
        page = body.next_page
      }

      const dayRows = Object.entries(byDay)
        .map(([day, usd]) => ({ day, usd: Math.round(usd * 10000) / 10000 }))
        .sort((a, b) => a.day.localeCompare(b.day))
      const totalUsd = Math.round(dayRows.reduce((s, d) => s + d.usd, 0) * 10000) / 10000

      const result = {
        days,
        totalUsd,
        currency: 'USD',
        byDay: dayRows,
        generatedAt: new Date().toISOString(),
      }

      await supabaseService.from('market_cache').upsert(
        {
          cache_key: cacheKey,
          data: result,
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        },
        { onConflict: 'cache_key' },
      )

      res.json(result)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[admin-anthropic-cost]', message)
      res.status(500).json({ error: message })
    }
  })

  app.get('/api/admin-pro-stats-stocks', async (req, res) => {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }
    if (!(await requireAdmin(req, res))) return

    try {
      const since = sevenDaysAgoIso()
      const { data: logs, error } = await supabaseService
        .from('activity_logs')
        .select('metadata, is_pro')
        .eq('action', 'view_stock')
        .gte('created_at', since)

      if (error) {
        res.status(500).json({ error: error.message })
        return
      }

      /** @type {Record<string, { code: string, pro: number, normal: number }>} */
      const stockCounts = {}
      for (const log of logs || []) {
        const code = codeFromMetadata(log.metadata)
        if (!code) continue
        if (!stockCounts[code]) {
          stockCounts[code] = { code, pro: 0, normal: 0 }
        }
        if (log.is_pro) stockCounts[code].pro++
        else stockCounts[code].normal++
      }

      const codes = Object.keys(stockCounts)
      const { data: stocks } = await supabaseService
        .from('stocks_master')
        .select('code, name')
        .in('code', codes)

      const stockMap = Object.fromEntries((stocks || []).map((s) => [s.code, s.name]))

      const result = Object.values(stockCounts)
        .map((s) => ({
          ...s,
          name: stockMap[s.code] || s.code,
          total: s.pro + s.normal,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 20)

      res.json({ stocks: result })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[admin-pro-stats-stocks]', e)
      res.status(500).json({ error: message })
    }
  })

  app.get('/api/admin-pro-stats-hours', async (req, res) => {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }
    if (!(await requireAdmin(req, res))) return

    try {
      const since = sevenDaysAgoIso()
      const { data: logs, error } = await supabaseService
        .from('activity_logs')
        .select('created_at, is_pro')
        .eq('action', 'view_stock')
        .gte('created_at', since)

      if (error) {
        res.status(500).json({ error: error.message })
        return
      }

      const hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, pro: 0, normal: 0 }))

      for (const log of logs || []) {
        if (!log.created_at) continue
        const date = new Date(log.created_at)
        const kstHour = (date.getUTCHours() + 9) % 24
        if (log.is_pro) hours[kstHour].pro++
        else hours[kstHour].normal++
      }

      res.json({ hours })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[admin-pro-stats-hours]', e)
      res.status(500).json({ error: message })
    }
  })

  app.get('/api/admin-pro-watchlist-stats', async (req, res) => {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }
    if (!(await requireAdmin(req, res))) return

    try {
      const { data: rows, error } = await supabaseService.from('pro_watchlist').select('code')

      if (error) {
        res.status(500).json({ error: error.message })
        return
      }

      /** @type {Record<string, number>} */
      const counts = {}
      for (const row of rows || []) {
        const code = String(row.code ?? '')
          .replace(/\D/g, '')
          .padStart(6, '0')
        if (!code || code === '000000') continue
        counts[code] = (counts[code] || 0) + 1
      }

      const codes = Object.keys(counts)
      const { data: stocks } = await supabaseService
        .from('stocks_master')
        .select('code, name')
        .in('code', codes)

      const stockMap = Object.fromEntries((stocks || []).map((s) => [s.code, s.name]))

      const result = Object.entries(counts)
        .map(([code, count]) => ({
          code,
          name: stockMap[code] || code,
          count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20)

      res.json({ watchlist: result })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[admin-pro-watchlist-stats]', e)
      res.status(500).json({ error: message })
    }
  })

  app.get('/api/admin-logs', async (req, res) => {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }
    if (!(await requireAdmin(req, res))) return

    try {
      const limit = Math.min(Math.max(Number(req.query?.limit) || 50, 1), 200)
      const { data: logs, error } = await supabaseService
        .from('activity_logs')
        .select('id, user_id, metadata, created_at, is_pro, action')
        .eq('action', 'view_stock')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        res.status(500).json({ error: error.message })
        return
      }

      const userIds = [...new Set((logs || []).map((l) => l.user_id).filter(Boolean))]
      const userMap = await emailMapForUserIds(supabaseService, userIds)

      const codes = [
        ...new Set(
          (logs || []).map((l) => codeFromMetadata(l.metadata)).filter((c) => c != null),
        ),
      ]
      const { data: stocks } = codes.length
        ? await supabaseService.from('stocks_master').select('code, name').in('code', codes)
        : { data: [] }

      const stockMap = Object.fromEntries((stocks || []).map((s) => [s.code, s.name]))

      res.json({
        logs: (logs || []).map((l) => {
          const code = codeFromMetadata(l.metadata)
          return {
            id: l.id,
            user_id: l.user_id,
            user_email: userMap[l.user_id] || '?',
            code,
            stock_name: code ? stockMap[code] || code : '—',
            created_at: l.created_at,
            is_pro: !!l.is_pro,
          }
        }),
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[admin-logs]', e)
      res.status(500).json({ error: message })
    }
  })

  app.get('/api/admin-usage-stats', async (req, res) => {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }
    if (!(await requireAdmin(req, res))) return

    try {
      const days = Math.min(Math.max(Number(req.query?.days) || 7, 1), 90)
      const chartDays = 14
      const fetchDays = Math.max(days, chartDays)
      const sinceFetch = new Date(Date.now() - fetchDays * DAY_MS).toISOString()
      const sinceSummary = new Date(Date.now() - days * DAY_MS).toISOString()

      const { data: rows, error } = await supabaseService
        .from('pro_api_usage')
        .select('user_id, endpoint, model, input_tokens, output_tokens, created_at')
        .gte('created_at', sinceFetch)
        .order('created_at', { ascending: false })
        .limit(5000)

      if (error) {
        res.status(500).json({ error: error.message })
        return
      }

      const list = rows || []
      let totalInput = 0
      let totalOutput = 0
      let totalCostUsd = 0
      let summaryCalls = 0

      /** @type {Record<string, { endpoint: string, calls: number, inputTokens: number, outputTokens: number, costUsd: number }>} */
      const byEndpoint = {}
      /** @type {Record<string, { calls: number, inputTokens: number, outputTokens: number, costUsd: number }>} */
      const byUser = {}
      /** @type {Record<string, { analysis: number, chat: number, diagnosis: number }>} */
      const byDayCost = {}

      for (const row of list) {
        const input = Number(row.input_tokens) || 0
        const output = Number(row.output_tokens) || 0
        const rowCost = calcCost(row.model, input, output)
        const inSummary = row.created_at && row.created_at >= sinceSummary

        if (inSummary) {
          summaryCalls += 1
          totalInput += input
          totalOutput += output
          totalCostUsd += rowCost

          const ep = String(row.endpoint || 'unknown')
          if (!byEndpoint[ep]) {
            byEndpoint[ep] = { endpoint: ep, calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 }
          }
          byEndpoint[ep].calls += 1
          byEndpoint[ep].inputTokens += input
          byEndpoint[ep].outputTokens += output
          byEndpoint[ep].costUsd += rowCost

          const uid = String(row.user_id || '')
          if (uid) {
            if (!byUser[uid]) {
              byUser[uid] = { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 }
            }
            byUser[uid].calls += 1
            byUser[uid].inputTokens += input
            byUser[uid].outputTokens += output
            byUser[uid].costUsd += rowCost
          }
        }

        if (row.created_at) {
          const day = row.created_at.slice(0, 10)
          const cat = usageCostCategory(row.endpoint)
          if (cat !== 'other') {
            if (!byDayCost[day]) byDayCost[day] = { analysis: 0, chat: 0, diagnosis: 0 }
            byDayCost[day][cat] += rowCost
          }
        }
      }

      /** @type {string[]} */
      const chartDayKeys = []
      for (let i = chartDays - 1; i >= 0; i -= 1) {
        chartDayKeys.push(new Date(Date.now() - i * DAY_MS).toISOString().slice(0, 10))
      }
      const byDayCostFull = chartDayKeys.map((day) => {
        const row = byDayCost[day]
        const analysis = row?.analysis || 0
        const chat = row?.chat || 0
        const diagnosis = row?.diagnosis || 0
        return {
          day,
          analysis,
          chat,
          diagnosis,
          total: analysis + chat + diagnosis,
        }
      })

      const userIds = Object.keys(byUser)
      const emailMap = await emailMapForUserIds(supabaseService, userIds)

      const endpointStats = Object.values(byEndpoint)
        .sort((a, b) => b.costUsd - a.costUsd)

      const topUsers = userIds
        .map((uid) => ({
          userId: uid,
          email: emailMap[uid] || '?',
          calls: byUser[uid].calls,
          inputTokens: byUser[uid].inputTokens,
          outputTokens: byUser[uid].outputTokens,
          costUsd: byUser[uid].costUsd,
        }))
        .sort((a, b) => b.costUsd - a.costUsd)
        .slice(0, 15)

      res.json({
        days,
        summary: {
          totalCalls: summaryCalls,
          inputTokens: totalInput,
          outputTokens: totalOutput,
          costUsd: totalCostUsd,
        },
        byEndpoint: endpointStats,
        topUsers,
        byDayCost: byDayCostFull,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[admin-usage-stats]', e)
      res.status(500).json({ error: message })
    }
  })

  app.get('/api/admin-user-summary', async (req, res) => {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }
    if (!(await requireAdmin(req, res))) return

    try {
      const { data: listData } = await supabaseService.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const users = listData?.users ?? []

      const { data: settings } = await supabaseService
        .from('user_settings')
        .select('user_id, pro_enabled')

      /** @type {Record<string, boolean>} */
      const proMap = {}
      for (const s of settings || []) {
        if (s.user_id) proMap[s.user_id] = Boolean(s.pro_enabled)
      }

      const { data: activities, error: actErr } = await supabaseService
        .from('activity_logs')
        .select('user_id, action, created_at')
        .limit(ACTIVITY_FETCH_LIMIT)

      if (actErr) {
        res.status(500).json({ error: actErr.message })
        return
      }

      /** @type {Record<string, ReturnType<typeof emptyActivityBucket>>} */
      const actByUser = {}
      for (const a of activities || []) {
        if (!a.user_id) continue
        if (!actByUser[a.user_id]) actByUser[a.user_id] = emptyActivityBucket()
        const bucket = actByUser[a.user_id]
        if (
          a.action === 'view_stock' ||
          a.action === 'chat' ||
          a.action === 'diagnosis' ||
          a.action === 'add_holding'
        ) {
          bucket[a.action] += 1
        }
        if (a.created_at && (!bucket.lastSeen || a.created_at > bucket.lastSeen)) {
          bucket.lastSeen = a.created_at
        }
      }

      const { data: usage, error: usageErr } = await supabaseService
        .from('pro_api_usage')
        .select('user_id, model, input_tokens, output_tokens')
        .limit(USAGE_FETCH_LIMIT)

      if (usageErr) {
        res.status(500).json({ error: usageErr.message })
        return
      }

      /** @type {Record<string, number>} */
      const costByUser = {}
      for (const u of usage || []) {
        if (!u.user_id) continue
        const input = Number(u.input_tokens) || 0
        const output = Number(u.output_tokens) || 0
        costByUser[u.user_id] = (costByUser[u.user_id] || 0) + calcCost(u.model, input, output)
      }

      const result = users
        .map((u) => ({
          id: u.id,
          email: u.email ?? '?',
          full_name:
            String(
              (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || '',
            ).trim() || null,
          avatar_url:
            String(
              (u.user_metadata &&
                (u.user_metadata.avatar_url || u.user_metadata.picture || u.user_metadata.avatar)) ||
                '',
            ).trim() || null,
          isPro: Boolean(proMap[u.id]),
          lastSeen: actByUser[u.id]?.lastSeen || u.last_sign_in_at || null,
          activity: {
            view_stock: actByUser[u.id]?.view_stock || 0,
            chat: actByUser[u.id]?.chat || 0,
            diagnosis: actByUser[u.id]?.diagnosis || 0,
          },
          cost: costByUser[u.id] || 0,
        }))
        .sort((a, b) => {
          if (!a.lastSeen) return 1
          if (!b.lastSeen) return -1
          return String(b.lastSeen).localeCompare(String(a.lastSeen))
        })

      res.json({
        users: result,
        total: users.length,
        proCount: result.filter((u) => u.isPro).length,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[admin-user-summary]', e)
      res.status(500).json({ error: message })
    }
  })

  app.get('/api/admin-user-detail', async (req, res) => {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }
    if (!(await requireAdmin(req, res))) return

    const userId = String(req.query?.userId ?? '').trim()
    if (!userId) {
      res.status(400).json({ error: 'userId 필요' })
      return
    }

    try {
      const { data: views, error: viewErr } = await supabaseService
        .from('activity_logs')
        .select('metadata, created_at')
        .eq('user_id', userId)
        .eq('action', 'view_stock')
        .order('created_at', { ascending: false })
        .limit(100)

      if (viewErr) {
        res.status(500).json({ error: viewErr.message })
        return
      }

      /** @type {Record<string, number>} */
      const stockCount = {}
      for (const v of views || []) {
        const code = codeFromMetadata(v.metadata)
        if (code) stockCount[code] = (stockCount[code] || 0) + 1
      }

      const topStocks = Object.entries(stockCount)
        .map(([code, count]) => ({ code, count, name: code }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      const codes = topStocks.map((s) => s.code)
      const nameMap = await stockNameMap(supabaseService, codes)
      for (const s of topStocks) {
        s.name = nameMap[s.code] || s.code
      }

      const since14 = new Date(Date.now() - 14 * DAY_MS).toISOString()
      const { data: acts, error: actErr } = await supabaseService
        .from('activity_logs')
        .select('action, created_at')
        .eq('user_id', userId)
        .gte('created_at', since14)

      if (actErr) {
        res.status(500).json({ error: actErr.message })
        return
      }

      /** @type {Record<string, number>} */
      const byDay = {}
      for (const a of acts || []) {
        if (!a.created_at) continue
        const d = a.created_at.slice(0, 10)
        byDay[d] = (byDay[d] || 0) + 1
      }

      res.json({ topStocks, byDay })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[admin-user-detail]', e)
      res.status(500).json({ error: message })
    }
  })

  app.get('/api/admin-metrics', async (req, res) => {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }
    if (!(await requireAdmin(req, res))) return

    try {
      const day14 = new Date(Date.now() - FOURTEEN_DAYS_MS).toISOString()
      const day1 = seoulTodayStartIso()

      const { data: acts, error } = await supabaseService
        .from('activity_logs')
        .select('user_id, action, metadata, created_at')
        .gte('created_at', day14)
        .limit(ACTIVITY_FETCH_LIMIT)

      if (error) {
        res.status(500).json({ error: error.message })
        return
      }

      const dauSet = new Set()
      const wauSet = new Set()
      /** @type {Record<string, number>} */
      const stockCount = {}
      /** @type {Record<string, Record<string, number>>} */
      const chatByUser = {}
      /** @type {Record<string, Record<string, number>>} */
      const viewByUser = {}
      const day7 = sevenDaysAgoIso()
      /** @type {Record<string, { view_card: number; view_chat: number; diagnosis: number }>} */
      const byDay = {}

      for (const a of acts || []) {
        if (!a.user_id) continue
        wauSet.add(a.user_id)
        if (a.created_at && a.created_at >= day1) dauSet.add(a.user_id)

        if (a.action === 'view_stock') {
          const meta =
            a.metadata && typeof a.metadata === 'object' && !Array.isArray(a.metadata)
              ? /** @type {Record<string, unknown>} */ (a.metadata)
              : {}
          const code = codeFromMetadata(a.metadata)
          if (code) {
            stockCount[code] = (stockCount[code] || 0) + 1
            const uid = a.user_id
            if (String(meta.source ?? '') === 'chat') {
              if (!chatByUser[uid]) chatByUser[uid] = {}
              chatByUser[uid][code] = (chatByUser[uid][code] || 0) + 1
            }
            if (a.created_at && a.created_at >= day7) {
              if (!viewByUser[uid]) viewByUser[uid] = {}
              viewByUser[uid][code] = (viewByUser[uid][code] || 0) + 1
            }
          }
        }

        if (a.created_at) {
          const d = a.created_at.slice(0, 10)
          if (!byDay[d]) byDay[d] = { view_card: 0, view_chat: 0, diagnosis: 0 }
          if (a.action === 'view_stock') {
            const meta =
              a.metadata && typeof a.metadata === 'object' && !Array.isArray(a.metadata)
                ? /** @type {Record<string, unknown>} */ (a.metadata)
                : {}
            const src = String(meta.source ?? 'card')
            if (src === 'chat') byDay[d].view_chat += 1
            else byDay[d].view_card += 1
          } else if (a.action === 'diagnosis') {
            byDay[d].diagnosis += 1
          }
        }
      }

      const topCodes = Object.entries(stockCount)
        .map(([code, count]) => ({ code, count, name: code }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      const nameMap = await stockNameMap(
        supabaseService,
        topCodes.map((s) => s.code),
      )
      for (const s of topCodes) {
        s.name = nameMap[s.code] || s.code
      }

      const { data: listData } = await supabaseService.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const authUsers = listData?.users ?? []
      const totalUsers = authUsers.length
      const userMap = buildUserMap(authUsers)

      const allUserStockCodes = new Set()
      for (const codes of [...Object.values(chatByUser), ...Object.values(viewByUser)]) {
        for (const code of Object.keys(codes)) allUserStockCodes.add(code)
      }
      const userStockNameMap = await stockNameMap(supabaseService, [...allUserStockCodes])

      const chatByUserList = buildUserStockList(chatByUser, userMap, userStockNameMap)
      const viewByUserList = buildUserStockList(viewByUser, userMap, userStockNameMap)

      const { count: totalHoldings, error: holdingsErr } = await supabaseService
        .from('pro_holdings')
        .select('*', { count: 'exact', head: true })

      if (holdingsErr) {
        res.status(500).json({ error: holdingsErr.message })
        return
      }

      /** @type {string[]} */
      const dayKeys = []
      for (let i = 13; i >= 0; i -= 1) {
        dayKeys.push(new Date(Date.now() - i * DAY_MS).toISOString().slice(0, 10))
      }
      const byDayFull = dayKeys.map((day) => {
        const row = byDay[day]
        const view_card = row?.view_card || 0
        const view_chat = row?.view_chat || 0
        const diagnosis = row?.diagnosis || 0
        return {
          day,
          view_card,
          view_chat,
          diagnosis,
          total: view_card + view_chat + diagnosis,
        }
      })

      res.json({
        dau: dauSet.size,
        wau: wauSet.size,
        totalUsers,
        totalHoldings: totalHoldings ?? 0,
        topStocks: topCodes,
        chatByUser: chatByUserList,
        viewByUser: viewByUserList,
        byDay: byDayFull,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[admin-metrics]', e)
      res.status(500).json({ error: message })
    }
  })

  app.post('/api/admin-sync-stocks-fetch', handleAdminSyncStocksFetch)
  app.post('/api/admin-sync-stocks-batch', handleAdminSyncStocksBatch)

  /** @deprecated 청크 API 사용 (타임아웃 방지) */
  app.post('/api/admin-sync-stocks-master', (_req, res) => {
    res.status(410).json({
      error:
        '이 API는 비활성화되었습니다. admin-sync-stocks-fetch → admin-sync-stocks-batch 순서로 호출하세요.',
    })
  })
}
