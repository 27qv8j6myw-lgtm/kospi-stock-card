import { runGroupOpusDiagnosis } from '../ai/proGroupOpus.mjs'
import { extractHoldingsFromImage } from '../ai/proHoldingsOcr.mjs'
import {
  buildPortfolioAnalysis,
  runPortfolioOpusDiagnosis,
} from '../ai/proPortfolioAnalysis.mjs'
import { mapAnthropicErrorForClient } from '../lib/anthropicRetry.mjs'
import { createUserSupabaseFromRequest } from '../lib/auth.mjs'
import { logActivity } from '../lib/activityLogger.mjs'
import { requireProUser } from '../lib/proAccess.mjs'
import { getKisQuote } from '../lib/toolExecutor.mjs'
import { isValidStockCode, normalizeKisIscd } from '../lib/stockCode.mjs'

/**
 * @param {unknown} raw
 */
function normalizeCode6(raw) {
  const code = normalizeKisIscd(raw)
  return isValidStockCode(code) && code !== '000000' ? code : ''
}

/**
 * 그룹 없으면 기본1 생성, 미분류(group_id null) 종목을 기본 그룹으로 이동
 * @param {import('@supabase/supabase-js').SupabaseClient} userSupabase
 * @param {string} userId
 */
async function ensureGroupsForHoldings(userSupabase, userId) {
  const { data: groupRows, error: groupErr } = await userSupabase
    .from('pro_groups')
    .select('id')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (groupErr) throw groupErr

  let defaultGroupId = groupRows?.[0]?.id ?? null

  if (!defaultGroupId) {
    const { data: newGroup, error: insertErr } = await userSupabase
      .from('pro_groups')
      .insert({ user_id: userId, name: '기본1', sort_order: 0 })
      .select('id')
      .single()

    if (insertErr) throw insertErr
    defaultGroupId = newGroup?.id ?? null
  }

  if (defaultGroupId) {
    const { error: migrateErr } = await userSupabase
      .from('pro_holdings')
      .update({ group_id: defaultGroupId, updated_at: new Date().toISOString() })
      .is('group_id', null)

    if (migrateErr) throw migrateErr
  }

  return defaultGroupId
}

/**
 * @param {import('express').Application} app
 * @param {{ getSupabaseService: () => import('@supabase/supabase-js').SupabaseClient | null, getUserIdFromRequest: (req: import('express').Request) => Promise<string | null> }} deps
 */
export function registerProHoldingsRoutes(app, { getSupabaseService, getUserIdFromRequest }) {
  async function handleGetHoldings(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    const userSupabase = createUserSupabaseFromRequest(req)
    if (!userSupabase) {
      res.status(401).json({ error: '인증 토큰 필요' })
      return
    }

    try {
      await ensureGroupsForHoldings(userSupabase, userId)

      const { data: holdings, error } = await userSupabase
        .from('pro_holdings')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      if (!holdings?.length) {
        res.json({ holdings: [], summary: null })
        return
      }

      const enriched = await Promise.all(
        holdings.map(async (h) => {
          const code = normalizeCode6(h.code) || String(h.code)
          const quantity = Number(h.quantity) || 0
          const avgPrice = Number(h.avg_price) || 0
          const costAmount = avgPrice * quantity

          try {
            const quote = await getKisQuote(code)
            const currentPrice = Number(quote?.currentPrice) || 0
            const evalAmount = currentPrice * quantity
            const profit = evalAmount - costAmount
            const profitPct = costAmount > 0 ? (profit / costAmount) * 100 : 0
            return {
              ...h,
              code,
              name: String(h.name || '').trim() || quote?.name || code,
              currentPrice,
              changePct: Number(quote?.changePct) || 0,
              evalAmount,
              costAmount,
              profit,
              profitPct,
            }
          } catch {
            return {
              ...h,
              code,
              name: String(h.name || '').trim() || code,
              currentPrice: 0,
              changePct: 0,
              evalAmount: 0,
              costAmount,
              profit: 0,
              profitPct: 0,
            }
          }
        }),
      )

      const totalEval = enriched.reduce((s, h) => s + (Number(h.evalAmount) || 0), 0)
      const totalCost = enriched.reduce((s, h) => s + (Number(h.costAmount) || 0), 0)
      const totalProfit = totalEval - totalCost
      enriched.forEach((h) => {
        h.weight = totalEval > 0 ? ((Number(h.evalAmount) || 0) / totalEval) * 100 : 0
      })

      res.json({
        holdings: enriched,
        summary: {
          totalEval,
          totalCost,
          totalProfit,
          totalProfitPct: totalCost > 0 ? (totalProfit / totalCost) * 100 : 0,
          count: enriched.length,
        },
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Holdings GET]', e)
      res.status(500).json({ error: message })
    }
  }

  async function handlePostHolding(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    const code = normalizeCode6(req.body?.code)
    const quantity = Number(req.body?.quantity)
    const avgPrice = Number(req.body?.avg_price)
    const name = String(req.body?.name ?? '').trim() || null
    const memo = req.body?.memo != null ? String(req.body.memo) : null
    const groupId = String(req.body?.group_id ?? '').trim()

    if (!code || !Number.isFinite(quantity) || quantity <= 0) {
      res.status(400).json({ error: '필수 항목 누락' })
      return
    }
    if (!Number.isFinite(avgPrice) || avgPrice <= 0) {
      res.status(400).json({ error: '필수 항목 누락' })
      return
    }
    if (!groupId) {
      res.status(400).json({ error: 'group_id 필요' })
      return
    }

    const userSupabase = createUserSupabaseFromRequest(req)
    if (!userSupabase) {
      res.status(401).json({ error: '인증 토큰 필요' })
      return
    }

    try {
      const now = new Date().toISOString()
      const { data, error } = await userSupabase
        .from('pro_holdings')
        .upsert(
          {
            user_id: userId,
            code,
            name,
            quantity,
            avg_price: avgPrice,
            memo,
            group_id: groupId,
            updated_at: now,
          },
          { onConflict: 'user_id,code,group_id' },
        )
        .select()
        .single()

      if (error) throw error
      void logActivity(userId, 'add_holding', { code, name: name || code, groupId }, true)
      res.json({ ok: true, holding: data })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Holdings POST]', e)
      res.status(500).json({ error: message })
    }
  }

  async function handleDeleteHolding(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    const holdingId = String(req.query?.id ?? '').trim()
    if (!holdingId) {
      res.status(400).json({ error: 'id 필요' })
      return
    }

    const userSupabase = createUserSupabaseFromRequest(req)
    if (!userSupabase) {
      res.status(401).json({ error: '인증 토큰 필요' })
      return
    }

    try {
      const { error } = await userSupabase.from('pro_holdings').delete().eq('id', holdingId)
      if (error) throw error
      res.json({ ok: true })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Holdings DELETE]', e)
      res.status(500).json({ error: message })
    }
  }

  async function handleGetGroups(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    const userSupabase = createUserSupabaseFromRequest(req)
    if (!userSupabase) {
      res.status(401).json({ error: '인증 토큰 필요' })
      return
    }

    try {
      const { data, error } = await userSupabase
        .from('pro_groups')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) throw error
      res.json({ groups: data || [] })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Pro Groups GET]', e)
      res.status(500).json({ error: message })
    }
  }

  async function handlePostGroup(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    const name = String(req.body?.name ?? '').trim()
    if (!name) {
      res.status(400).json({ error: '그룹명 필요' })
      return
    }

    const userSupabase = createUserSupabaseFromRequest(req)
    if (!userSupabase) {
      res.status(401).json({ error: '인증 토큰 필요' })
      return
    }

    try {
      const { data: lastRows } = await userSupabase
        .from('pro_groups')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)

      const sortOrder =
        lastRows?.length && lastRows[0]?.sort_order != null
          ? Number(lastRows[0].sort_order) + 1
          : 0

      const { data, error } = await userSupabase
        .from('pro_groups')
        .insert({ user_id: userId, name, sort_order: sortOrder })
        .select()
        .single()

      if (error) throw error
      res.json({ ok: true, group: data })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Pro Groups POST]', e)
      res.status(500).json({ error: message })
    }
  }

  async function handlePatchGroup(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    const id = String(req.body?.id ?? '').trim()
    if (!id) {
      res.status(400).json({ error: 'id 필요' })
      return
    }

    const userSupabase = createUserSupabaseFromRequest(req)
    if (!userSupabase) {
      res.status(401).json({ error: '인증 토큰 필요' })
      return
    }

    /** @type {Record<string, unknown>} */
    const updates = {}
    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim()
      if (!name) {
        res.status(400).json({ error: '그룹명 필요' })
        return
      }
      updates.name = name
    }
    if (req.body?.initialCapital !== undefined) {
      updates.initial_capital = Number(req.body.initialCapital) || 0
    }
    if (req.body?.cashBalance !== undefined) {
      updates.cash_balance = Number(req.body.cashBalance) || 0
    }
    if (req.body?.realizedProfit !== undefined) {
      updates.realized_profit = Number(req.body.realizedProfit) || 0
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: '변경할 항목 없음' })
      return
    }

    try {
      const { error } = await userSupabase.from('pro_groups').update(updates).eq('id', id)
      if (error) throw error
      res.json({ ok: true })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Pro Groups PATCH]', e)
      res.status(500).json({ error: message })
    }
  }

  async function handleDeleteGroup(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    const id = String(req.query?.id ?? '').trim()
    if (!id) {
      res.status(400).json({ error: 'id 필요' })
      return
    }

    const userSupabase = createUserSupabaseFromRequest(req)
    if (!userSupabase) {
      res.status(401).json({ error: '인증 토큰 필요' })
      return
    }

    try {
      const { error } = await userSupabase.from('pro_groups').delete().eq('id', id)
      if (error) throw error
      res.json({ ok: true })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Pro Groups DELETE]', e)
      res.status(500).json({ error: message })
    }
  }

  async function handlePatchHoldingGroup(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    const holdingId = String(req.body?.holdingId ?? '').trim()
    if (!holdingId) {
      res.status(400).json({ error: 'holdingId 필요' })
      return
    }

    const groupId = String(req.body?.groupId ?? '').trim()
    if (!groupId) {
      res.status(400).json({ error: 'groupId 필요' })
      return
    }

    const userSupabase = createUserSupabaseFromRequest(req)
    if (!userSupabase) {
      res.status(401).json({ error: '인증 토큰 필요' })
      return
    }

    try {
      const { data: holding, error: holdErr } = await userSupabase
        .from('pro_holdings')
        .select('code')
        .eq('id', holdingId)
        .maybeSingle()

      if (holdErr) throw holdErr
      if (!holding) {
        res.status(404).json({ error: '보유 종목을 찾을 수 없습니다' })
        return
      }

      const { data: existing, error: existErr } = await userSupabase
        .from('pro_holdings')
        .select('id')
        .eq('code', holding.code)
        .eq('group_id', groupId)
        .neq('id', holdingId)
        .limit(1)

      if (existErr) throw existErr
      if (existing?.length) {
        res.status(409).json({ error: '대상 그룹에 이미 같은 종목이 있습니다' })
        return
      }

      const { error } = await userSupabase
        .from('pro_holdings')
        .update({ group_id: groupId, updated_at: new Date().toISOString() })
        .eq('id', holdingId)

      if (error) throw error
      res.json({ ok: true })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Holdings Group PATCH]', e)
      res.status(500).json({ error: message })
    }
  }

  async function handleGetHoldingDetail(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    const holdingId = String(req.query?.id ?? '').trim()
    if (!holdingId) {
      res.status(400).json({ error: 'id 필요' })
      return
    }

    const userSupabase = createUserSupabaseFromRequest(req)
    if (!userSupabase) {
      res.status(401).json({ error: '인증 토큰 필요' })
      return
    }

    try {
      const { data: holding, error: holdErr } = await userSupabase
        .from('pro_holdings')
        .select('*')
        .eq('id', holdingId)
        .maybeSingle()

      if (holdErr) throw holdErr
      if (!holding) {
        res.status(404).json({ error: '보유 종목을 찾을 수 없습니다' })
        return
      }

      const code = normalizeCode6(holding.code) || String(holding.code)
      const quantity = Number(holding.quantity) || 0
      const avgPrice = Number(holding.avg_price) || 0
      const costAmount = avgPrice * quantity

      let currentPrice = 0
      let changePct = 0
      let displayName = String(holding.name || '').trim() || code

      try {
        const quote = await getKisQuote(code)
        currentPrice = Number(quote?.currentPrice) || 0
        changePct = Number(quote?.changePct) || 0
        if (quote?.name && quote.name !== code) displayName = quote.name
      } catch {
        // 시세 없어도 보유 row 는 반환
      }

      const evalAmount = currentPrice * quantity
      const profit = evalAmount - costAmount
      const profitPct = costAmount > 0 ? (profit / costAmount) * 100 : 0

      res.json({
        holding: {
          ...holding,
          code,
          name: displayName,
          currentPrice,
          changePct,
          evalAmount,
          costAmount,
          profit,
          profitPct,
        },
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Holding Detail GET]', e)
      res.status(500).json({ error: message })
    }
  }

  async function handleHoldingsOcr(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    const imageBase64 = String(req.body?.imageBase64 ?? '').trim()
    const mediaType = String(req.body?.mediaType ?? 'image/jpeg').trim()

    if (!imageBase64) {
      res.status(400).json({ error: '이미지 필요' })
      return
    }

    try {
      const stocks = await extractHoldingsFromImage(imageBase64, mediaType)
      res.json({ stocks })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Holdings OCR]', e)
      if (/ANTHROPIC_API_KEY|API_KEY/i.test(message)) {
        res.status(503).json({ error: message })
        return
      }
      if (/시간 초과|timeout/i.test(message)) {
        res.status(504).json({ error: message })
        return
      }
      if (/이미지|too large/i.test(message)) {
        res.status(400).json({ error: message })
        return
      }
      res.status(500).json({ error: message })
    }
  }

  async function handlePortfolioAnalysis(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    const userSupabase = createUserSupabaseFromRequest(req)
    if (!userSupabase) {
      res.status(401).json({ error: '인증 토큰 필요' })
      return
    }

    try {
      const payload = await buildPortfolioAnalysis(userSupabase, supabaseService, userId)
      res.json(payload)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Portfolio]', e)
      res.status(500).json({ error: message })
    }
  }

  async function handlePortfolioOpus(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    try {
      const payload = await runPortfolioOpusDiagnosis(req, userId)
      const groupIds = Array.isArray(req.body?.groupIds) ? req.body.groupIds : null
      void logActivity(
        userId,
        'diagnosis',
        { type: 'portfolio', groupIds: groupIds?.length ? groupIds : null },
        true,
      )
      res.json(payload)
    } catch (e) {
      const status = e && typeof e === 'object' && 'status' in e ? Number(e.status) : 500
      const message = mapAnthropicErrorForClient(e)
      console.error('[Portfolio OPUS]', e)
      if (/ANTHROPIC_API_KEY|API_KEY/i.test(message)) {
        res.status(503).json({ error: message })
        return
      }
      if (/시간 초과|timeout/i.test(message)) {
        res.status(504).json({ error: message })
        return
      }
      if (/혼잡/.test(message)) {
        res.status(503).json({ error: message })
        return
      }
      res.status(status >= 400 && status < 600 ? status : 500).json({ error: message })
    }
  }

  async function handleGetGroupSnapshots(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    const userSupabase = createUserSupabaseFromRequest(req)
    if (!userSupabase) {
      res.status(401).json({ error: '인증 토큰 필요' })
      return
    }

    const groupId = String(req.query?.groupId ?? '').trim()

    try {
      const { data: groupRows, error: groupErr } = await userSupabase
        .from('pro_groups')
        .select('id, name, sort_order')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })

      if (groupErr) throw groupErr

      let snapQuery = userSupabase
        .from('pro_group_snapshots')
        .select('group_id, snapshot_date, stock_value, total_value, initial_capital, return_pct')
        .order('snapshot_date', { ascending: true })

      if (groupId) {
        snapQuery = snapQuery.eq('group_id', groupId)
      }

      const { data: snapshots, error: snapErr } = await snapQuery
      if (snapErr) throw snapErr

      res.json({
        groups: (groupRows || []).map((g) => ({ id: g.id, name: g.name })),
        snapshots: snapshots || [],
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Group Snapshots GET]', e)
      res.status(500).json({ error: message })
    }
  }

  async function handleGroupOpus(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    const raw = req.body?.groupId
    const groupId =
      raw === null || raw === undefined || raw === '' || raw === 'ungrouped'
        ? null
        : String(raw).trim()

    try {
      const payload = await runGroupOpusDiagnosis(req, userId, groupId)
      void logActivity(userId, 'diagnosis', { type: 'group', groupId }, true)
      res.json(payload)
    } catch (e) {
      const status = e && typeof e === 'object' && 'status' in e ? Number(e.status) : 500
      const message = mapAnthropicErrorForClient(e)
      console.error('[Group OPUS]', e)
      if (/ANTHROPIC_API_KEY|API_KEY/i.test(message)) {
        res.status(503).json({ error: message })
        return
      }
      if (/시간 초과|timeout/i.test(message)) {
        res.status(504).json({ error: message })
        return
      }
      if (/혼잡/.test(message)) {
        res.status(503).json({ error: message })
        return
      }
      res.status(status >= 400 && status < 600 ? status : 500).json({ error: message })
    }
  }

  app.get('/api/pro-groups', handleGetGroups)
  app.post('/api/pro-groups', handlePostGroup)
  app.patch('/api/pro-groups', handlePatchGroup)
  app.delete('/api/pro-groups', handleDeleteGroup)
  app.patch('/api/pro-holdings-group', handlePatchHoldingGroup)

  app.get('/api/pro-holdings', handleGetHoldings)
  app.get('/api/pro-holding-detail', handleGetHoldingDetail)
  app.post('/api/pro-holdings', handlePostHolding)
  app.delete('/api/pro-holdings', handleDeleteHolding)
  app.post('/api/pro-holdings-ocr', handleHoldingsOcr)
  app.get('/api/pro-group-snapshots', handleGetGroupSnapshots)
  app.get('/api/pro-portfolio-analysis', handlePortfolioAnalysis)
  app.post('/api/pro-portfolio-opus', handlePortfolioOpus)
  app.post('/api/pro-group-opus', handleGroupOpus)
}
