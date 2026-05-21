/**
 * 관리자 — Pro 권한·Pro 활동 통계 API
 */
import { createUserSupabaseFromRequest } from '../lib/auth.mjs'
import {
  handleAdminSyncStocksBatch,
  handleAdminSyncStocksFetch,
} from './adminSyncStocksHandlers.mjs'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

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
