/**
 * Pro 매매일지 — 거래 기록/조회/삭제 + 보유종목·그룹 실현손익 자동 갱신
 *
 * - 매수: 평단 = (기존수량×평단 + 수량×가격) / 합계수량, 수량 증가 (보유 없으면 생성)
 * - 매도: 실현손익 = (매도가 − 평단) × 수량 → pro_groups.realized_profit 가산,
 *         수량 차감 (0이면 보유 삭제). 평단은 변하지 않음
 * - 삭제: 기록의 스냅샷(avg_price_at_trade, realized_profit)으로 역방향 보정
 */
import { createUserSupabaseFromRequest } from '../lib/auth.mjs'
import { logActivity } from '../lib/activityLogger.mjs'
import { requireProUser } from '../lib/proAccess.mjs'
import { isValidStockCode, normalizeKisIscd } from '../lib/stockCode.mjs'

/** @param {unknown} raw */
function normalizeCode6(raw) {
  const code = normalizeKisIscd(raw)
  return isValidStockCode(code) && code !== '000000' ? code : ''
}

/** @param {unknown} raw @returns {string | null} YYYY-MM-DD */
function normalizeTradeDate(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const t = new Date(`${s}T00:00:00Z`).getTime()
  return Number.isFinite(t) ? s : null
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} userSupabase
 * @param {string} groupId
 * @param {number} delta
 */
async function addGroupRealizedProfit(userSupabase, groupId, delta) {
  if (!groupId || !Number.isFinite(delta) || delta === 0) return
  const { data: group, error } = await userSupabase
    .from('pro_groups')
    .select('realized_profit')
    .eq('id', groupId)
    .maybeSingle()
  if (error || !group) return
  const next = (Number(group.realized_profit) || 0) + delta
  await userSupabase.from('pro_groups').update({ realized_profit: next }).eq('id', groupId)
}

/**
 * @param {import('express').Application} app
 * @param {{ getSupabaseService: () => import('@supabase/supabase-js').SupabaseClient | null, getUserIdFromRequest: (req: import('express').Request) => Promise<string | null> }} deps
 */
export function registerProTradesRoutes(app, { getSupabaseService, getUserIdFromRequest }) {
  /** 인증 + 사용자 Supabase 클라이언트 — 실패 시 응답까지 처리하고 null 반환 */
  async function authn(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return null
    }
    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return null
    const userSupabase = createUserSupabaseFromRequest(req)
    if (!userSupabase) {
      res.status(401).json({ error: '인증 토큰 필요' })
      return null
    }
    return { userId, userSupabase }
  }

  async function handlePostTrade(req, res) {
    const ctx = await authn(req, res)
    if (!ctx) return
    const { userId, userSupabase } = ctx

    const code = normalizeCode6(req.body?.code)
    const groupId = String(req.body?.groupId ?? '').trim()
    const side = String(req.body?.side ?? '').trim()
    const quantity = Number(req.body?.quantity)
    const price = Number(req.body?.price)
    const name = String(req.body?.name ?? '').trim() || null
    const memo = req.body?.memo != null ? String(req.body.memo).slice(0, 500) : null
    const tradedAt = normalizeTradeDate(req.body?.tradedAt) ?? new Date().toISOString().slice(0, 10)

    if (!code || !groupId || (side !== 'buy' && side !== 'sell')) {
      res.status(400).json({ error: '필수 항목 누락 (code/groupId/side)' })
      return
    }
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0) {
      res.status(400).json({ error: '수량·가격은 0보다 커야 합니다' })
      return
    }

    try {
      const { data: holding, error: holdErr } = await userSupabase
        .from('pro_holdings')
        .select('id, name, quantity, avg_price')
        .eq('code', code)
        .eq('group_id', groupId)
        .maybeSingle()
      if (holdErr) throw holdErr

      const prevQty = Number(holding?.quantity) || 0
      const prevAvg = Number(holding?.avg_price) || 0
      const now = new Date().toISOString()

      /** @type {number | null} */
      let realizedProfit = null

      if (side === 'sell') {
        if (!holding || prevQty <= 0) {
          res.status(400).json({ error: '해당 그룹에 보유 수량이 없습니다' })
          return
        }
        if (quantity > prevQty) {
          res.status(400).json({ error: `보유 수량(${prevQty})보다 많이 매도할 수 없습니다` })
          return
        }
        realizedProfit = (price - prevAvg) * quantity
      }

      const { data: trade, error: tradeErr } = await userSupabase
        .from('pro_trades')
        .insert({
          user_id: userId,
          group_id: groupId,
          code,
          name: name || holding?.name || null,
          side,
          quantity,
          price,
          traded_at: tradedAt,
          memo,
          avg_price_at_trade: holding ? prevAvg : null,
          realized_profit: realizedProfit,
        })
        .select()
        .single()
      if (tradeErr) throw tradeErr

      if (side === 'buy') {
        if (holding) {
          const newQty = prevQty + quantity
          const newAvg = (prevQty * prevAvg + quantity * price) / newQty
          const { error } = await userSupabase
            .from('pro_holdings')
            .update({ quantity: newQty, avg_price: newAvg, updated_at: now })
            .eq('id', holding.id)
          if (error) throw error
        } else {
          const { error } = await userSupabase.from('pro_holdings').insert({
            user_id: userId,
            code,
            name,
            quantity,
            avg_price: price,
            group_id: groupId,
            updated_at: now,
          })
          if (error) throw error
        }
      } else {
        const newQty = prevQty - quantity
        if (newQty <= 0) {
          const { error } = await userSupabase.from('pro_holdings').delete().eq('id', holding.id)
          if (error) throw error
        } else {
          const { error } = await userSupabase
            .from('pro_holdings')
            .update({ quantity: newQty, updated_at: now })
            .eq('id', holding.id)
          if (error) throw error
        }
        await addGroupRealizedProfit(userSupabase, groupId, realizedProfit ?? 0)
      }

      void logActivity(userId, 'trade', { code, side, quantity, price, groupId }, true)
      res.json({ ok: true, trade, realizedProfit })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Pro Trades POST]', e)
      if (/pro_trades.*(does not exist|relation)/i.test(message)) {
        res.status(503).json({
          error: '매매일지 테이블이 없습니다. scripts/supabase-pro-trades.sql 을 실행해주세요.',
        })
        return
      }
      res.status(500).json({ error: message })
    }
  }

  async function handleGetTrades(req, res) {
    const ctx = await authn(req, res)
    if (!ctx) return
    const { userSupabase } = ctx

    const groupId = String(req.query?.groupId ?? '').trim()
    const code = normalizeCode6(req.query?.code)
    const limit = Math.min(Math.max(Number(req.query?.limit) || 100, 1), 500)

    try {
      let q = userSupabase
        .from('pro_trades')
        .select('*')
        .order('traded_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit)
      if (groupId) q = q.eq('group_id', groupId)
      if (code) q = q.eq('code', code)

      const { data, error } = await q
      if (error) throw error
      res.json({ trades: data || [] })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Pro Trades GET]', e)
      if (/pro_trades.*(does not exist|relation)/i.test(message)) {
        res.json({ trades: [], tableMissing: true })
        return
      }
      res.status(500).json({ error: message })
    }
  }

  async function handleDeleteTrade(req, res) {
    const ctx = await authn(req, res)
    if (!ctx) return
    const { userId, userSupabase } = ctx

    const id = String(req.query?.id ?? '').trim()
    if (!id) {
      res.status(400).json({ error: 'id 필요' })
      return
    }

    try {
      const { data: trade, error: tradeErr } = await userSupabase
        .from('pro_trades')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (tradeErr) throw tradeErr
      if (!trade) {
        res.status(404).json({ error: '거래 기록을 찾을 수 없습니다' })
        return
      }

      const code = normalizeCode6(trade.code) || String(trade.code)
      const groupId = trade.group_id ? String(trade.group_id) : ''
      const qty = Number(trade.quantity) || 0
      const price = Number(trade.price) || 0
      const now = new Date().toISOString()

      const { data: holding, error: holdErr } = groupId
        ? await userSupabase
            .from('pro_holdings')
            .select('id, quantity, avg_price')
            .eq('code', code)
            .eq('group_id', groupId)
            .maybeSingle()
        : { data: null, error: null }
      if (holdErr) throw holdErr

      if (trade.side === 'buy') {
        // 매수 취소 — 수량 차감, 평단을 매수 전 상태로 복원
        if (holding) {
          const curQty = Number(holding.quantity) || 0
          const curAvg = Number(holding.avg_price) || 0
          const newQty = curQty - qty
          if (newQty <= 0) {
            const { error } = await userSupabase.from('pro_holdings').delete().eq('id', holding.id)
            if (error) throw error
          } else {
            const restoredAvg = (curQty * curAvg - qty * price) / newQty
            const { error } = await userSupabase
              .from('pro_holdings')
              .update({
                quantity: newQty,
                avg_price: restoredAvg > 0 ? restoredAvg : curAvg,
                updated_at: now,
              })
              .eq('id', holding.id)
            if (error) throw error
          }
        }
      } else {
        // 매도 취소 — 수량 복원(보유 없으면 매도 시점 평단으로 재생성), 실현손익 차감
        const restoreAvg = Number(trade.avg_price_at_trade) || price
        if (holding) {
          const { error } = await userSupabase
            .from('pro_holdings')
            .update({ quantity: (Number(holding.quantity) || 0) + qty, updated_at: now })
            .eq('id', holding.id)
          if (error) throw error
        } else if (groupId) {
          const { error } = await userSupabase.from('pro_holdings').insert({
            user_id: userId,
            code,
            name: trade.name || null,
            quantity: qty,
            avg_price: restoreAvg,
            group_id: groupId,
            updated_at: now,
          })
          if (error) throw error
        }
        const realized = Number(trade.realized_profit)
        if (groupId && Number.isFinite(realized) && realized !== 0) {
          await addGroupRealizedProfit(userSupabase, groupId, -realized)
        }
      }

      const { error: delErr } = await userSupabase.from('pro_trades').delete().eq('id', id)
      if (delErr) throw delErr

      res.json({ ok: true })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Pro Trades DELETE]', e)
      res.status(500).json({ error: message })
    }
  }

  app.post('/api/pro-trades', handlePostTrade)
  app.get('/api/pro-trades', handleGetTrades)
  app.delete('/api/pro-trades', handleDeleteTrade)
}
