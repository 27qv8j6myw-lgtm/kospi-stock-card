/**
 * Pro 매매일지 — 거래 기록/조회/삭제 + 보유종목·그룹 실현손익 자동 갱신
 *
 * - 매수: 평단 = (기존수량×평단 + 수량×가격) / 합계수량, 수량 증가 (보유 없으면 생성)
 * - 매도: 실현손익 = (매도가 − 평단) × 수량 → pro_groups.realized_profit 가산,
 *         수량 차감 (0이면 보유 삭제). 평단은 변하지 않음
 * - 삭제: 기록의 스냅샷(avg_price_at_trade, realized_profit)으로 역방향 보정
 */
import Anthropic from '@anthropic-ai/sdk'
import { createUserSupabaseFromRequest } from '../lib/auth.mjs'
import { logActivity } from '../lib/activityLogger.mjs'
import { requireProUser } from '../lib/proAccess.mjs'
import { isValidStockCode, normalizeKisIscd } from '../lib/stockCode.mjs'
import { createAnthropicMessage } from '../lib/anthropicTimed.mjs'
import { logApiUsage } from '../lib/usageLogger.mjs'
import { resolveLightTaskModelId } from '../lib/userModel.mjs'
import { mapAnthropicErrorForClient } from '../lib/anthropicRetry.mjs'
import { seoulSnapshotDateKey } from '../lib/snapshotProGroups.mjs'
import { fetchProChartBars } from '../lib/proStockChart.mjs'
import { calcCost } from '../lib/pricing.mjs'
import { fetchRecentDiagnoses } from '../lib/diagnosisArchive.mjs'

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
 * @typedef {Object} TradeInsightStats
 * @property {number} totalCount 전체 거래 건수
 * @property {number} buyCount 매수 건수
 * @property {number} sellCount 매도 건수
 * @property {number} stockCount 거래 종목 수
 * @property {number} totalRealized 총 실현손익(원)
 * @property {number} winCount 익절 매도 건수
 * @property {number} lossCount 손절 매도 건수
 * @property {number | null} winRate 승률(%)
 * @property {number | null} avgWinPct 평균 익절률(%)
 * @property {number | null} avgLossPct 평균 손절률(%)
 * @property {{ name: string, code: string, realized: number, sellCount: number } | null} best
 * @property {{ name: string, code: string, realized: number, sellCount: number } | null} worst
 */

/**
 * 거래 목록에서 인사이트용 통계를 계산한다.
 * @param {Array<Record<string, unknown>>} trades
 * @returns {TradeInsightStats}
 */
function computeTradeInsightStats(trades) {
  let buyCount = 0
  let sellCount = 0
  let totalRealized = 0
  let winCount = 0
  let lossCount = 0
  const winPcts = []
  const lossPcts = []
  /** @type {Map<string, { name: string, code: string, realized: number, sellCount: number }>} */
  const byStock = new Map()

  for (const t of trades) {
    const side = String(t.side ?? '')
    const code = normalizeCode6(t.code) || String(t.code ?? '')
    const name = String(t.name ?? '').trim() || code
    if (!byStock.has(code)) byStock.set(code, { name, code, realized: 0, sellCount: 0 })
    const sg = byStock.get(code)
    if (name && (sg.name === code || !sg.name)) sg.name = name

    if (side === 'buy') {
      buyCount += 1
      continue
    }
    if (side !== 'sell') continue

    sellCount += 1
    sg.sellCount += 1
    const realized = Number(t.realized_profit)
    if (Number.isFinite(realized)) {
      totalRealized += realized
      sg.realized += realized
      if (realized > 0) winCount += 1
      else if (realized < 0) lossCount += 1

      const avgAt = Number(t.avg_price_at_trade)
      const qty = Number(t.quantity)
      if (Number.isFinite(avgAt) && avgAt > 0 && qty > 0) {
        const pct = (realized / (avgAt * qty)) * 100
        if (realized > 0) winPcts.push(pct)
        else if (realized < 0) lossPcts.push(pct)
      }
    }
  }

  const avg = (arr) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null)
  const stocks = [...byStock.values()].filter((s) => s.sellCount > 0)
  const sortedByRealized = [...stocks].sort((a, b) => b.realized - a.realized)
  const best = sortedByRealized.length ? sortedByRealized[0] : null
  const worst = sortedByRealized.length ? sortedByRealized[sortedByRealized.length - 1] : null

  return {
    totalCount: trades.length,
    buyCount,
    sellCount,
    stockCount: byStock.size,
    totalRealized,
    winCount,
    lossCount,
    winRate: winCount + lossCount > 0 ? (winCount / (winCount + lossCount)) * 100 : null,
    avgWinPct: avg(winPcts),
    avgLossPct: avg(lossPcts),
    best: best && best.realized !== 0 ? best : null,
    worst: worst && worst !== best && worst.realized < 0 ? worst : null,
  }
}

/**
 * 통계를 프롬프트용 한국어 라인으로 변환한다.
 * @param {TradeInsightStats} s
 * @returns {string[]}
 */
function buildInsightStatLines(s) {
  const won = (n) => `${n >= 0 ? '+' : ''}${Math.round(n).toLocaleString('ko-KR')}원`
  const pct = (n) => (n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`)
  const lines = [
    `총 실현손익: ${won(s.totalRealized)} (매도 ${s.sellCount}건, 매수 ${s.buyCount}건, 거래 종목 ${s.stockCount}개)`,
    s.winRate != null
      ? `승률: ${s.winRate.toFixed(0)}% (익절 ${s.winCount}건 / 손절 ${s.lossCount}건)`
      : null,
    s.avgWinPct != null ? `평균 익절률: ${pct(s.avgWinPct)}` : null,
    s.avgLossPct != null ? `평균 손절률: ${pct(s.avgLossPct)}` : null,
    s.best
      ? `최고 성과 종목: ${s.best.name}(${s.best.code}) ${won(s.best.realized)} (매도 ${s.best.sellCount}건)`
      : null,
    s.worst
      ? `최저 성과 종목: ${s.worst.name}(${s.worst.code}) ${won(s.worst.realized)} (매도 ${s.worst.sellCount}건)`
      : null,
  ]
  return lines.filter(Boolean)
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

  async function handleTradesInsight(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }
    const ctx = await authn(req, res)
    if (!ctx) return
    const { userId, userSupabase } = ctx

    const apiKey = (process.env.ANTHROPIC_API_KEY ?? '').trim()
    if (!apiKey) {
      res.status(503).json({ error: 'ANTHROPIC_API_KEY 미설정' })
      return
    }

    const start = normalizeTradeDate(req.body?.start)
    const end = normalizeTradeDate(req.body?.end)
    const rawGroupIds = Array.isArray(req.body?.groupIds) ? req.body.groupIds : null
    const groupIds = rawGroupIds
      ? rawGroupIds.map((g) => String(g ?? '').trim()).filter(Boolean)
      : null
    /** 복귀 조회 — 캐시만 확인하고 미스면 즉시 pending (재생성하지 않음) */
    const cachedOnly = req.body?.cachedOnly === true
    const force = req.body?.force === true && !cachedOnly

    if (!start || !end || start > end) {
      res.status(400).json({ error: '기간(start/end)이 올바르지 않습니다' })
      return
    }

    try {
      let q = userSupabase
        .from('pro_trades')
        .select('*')
        .gte('traded_at', start)
        .lte('traded_at', end)
        .order('traded_at', { ascending: true })
        .limit(2000)
      if (groupIds && groupIds.length > 0) q = q.in('group_id', groupIds)

      const { data: trades, error } = await q
      if (error) throw error

      const stats = computeTradeInsightStats(trades || [])
      if (stats.sellCount === 0) {
        res.json({ insight: null, message: '선택한 범위에 매도 거래가 없어 인사이트를 생성할 수 없습니다.' })
        return
      }

      const groupKey = groupIds && groupIds.length > 0 ? [...groupIds].sort().join(',') : 'all'
      const fp = `${stats.totalCount}:${Math.round(stats.totalRealized)}:${stats.sellCount}`
      const cacheKey = `trade-insight:${userId}:${start}:${end}:${groupKey}:${fp}`

      if (!force) {
        const { data: cached } = await supabaseService
          .from('market_cache')
          .select('data')
          .eq('cache_key', cacheKey)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle()
        if (cached?.data) {
          res.json(cached.data)
          return
        }
      }

      if (cachedOnly) {
        res.json({ insight: null, pending: true })
        return
      }

      const lines = buildInsightStatLines(stats)
      // 경량 작업: 비관리자(sonnet 기본)는 haiku, opus 부여 사용자는 opus
      const insightModel = await resolveLightTaskModelId(userId)
      const anthropic = new Anthropic({ apiKey })
      const resp = await createAnthropicMessage(
        anthropic,
        {
          model: insightModel,
          max_tokens: 500,
          messages: [
            {
              role: 'user',
              content: `투자자 본인의 매매일지를 분석해 3~5문장의 인사이트 브리핑을 작성해 주세요.

규칙:
- 정중한 존댓말, 이모지·인사말 금지, 바로 본문부터
- 아래 순서로 자연스럽게 이어서 작성: (1) 기간 성과 요약 (2) 우수·부진 종목 (3) 매매 습관 피드백
- 매매 습관 피드백은 익절률/손절률·승률 같은 수치 근거를 들어 객관적이고 조심스럽게, 단정·과장 금지
- 제공된 수치만 사용하고 새로운 종목명·수치를 지어내지 말 것
- 투자 권유나 매수/매도 지시는 하지 말 것
- 반드시 완성된 문장으로 마무리

매매 통계:
${lines.join('\n')}

인사이트:`,
            },
          ],
        },
        30_000,
      )

      const block = resp.content?.find((b) => b.type === 'text')
      const content = block && 'text' in block ? String(block.text).trim() : ''
      if (resp.usage) {
        await logApiUsage(userId, 'trade-insight', insightModel, resp.usage)
      }

      const payload = { insight: content, generatedAt: new Date().toISOString() }
      const seoulDate = seoulSnapshotDateKey()
      const expiresAt = new Date(`${seoulDate}T23:59:59+09:00`).toISOString()
      await supabaseService
        .from('market_cache')
        .upsert(
          { cache_key: cacheKey, data: payload, expires_at: expiresAt },
          { onConflict: 'cache_key' },
        )

      void logActivity(
        userId,
        'diagnosis',
        { type: 'trade-insight', start, end, groupIds: groupIds?.length ? groupIds : null },
        true,
      )

      res.json(payload)
    } catch (e) {
      const message = mapAnthropicErrorForClient(e)
      console.error('[Trade Insight]', e)
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
      res.status(500).json({ error: message })
    }
  }

  async function handleTradeReview(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }
    const ctx = await authn(req, res)
    if (!ctx) return
    const { userId, userSupabase } = ctx

    const apiKey = (process.env.ANTHROPIC_API_KEY ?? '').trim()
    if (!apiKey) {
      res.status(503).json({ error: 'ANTHROPIC_API_KEY 미설정' })
      return
    }

    const tradeId = String(req.body?.tradeId ?? '').trim()
    if (!tradeId) {
      res.status(400).json({ error: 'tradeId 필요' })
      return
    }

    try {
      const { data: trade, error } = await userSupabase
        .from('pro_trades')
        .select('*')
        .eq('id', tradeId)
        .maybeSingle()
      if (error) throw error
      if (!trade) {
        res.status(404).json({ error: '거래 기록을 찾을 수 없습니다' })
        return
      }
      if (trade.side !== 'sell') {
        res.status(400).json({ error: '매도 거래만 복기할 수 있습니다' })
        return
      }

      const code = normalizeCode6(trade.code) || String(trade.code)
      const sellDate = String(trade.traded_at || '').slice(0, 10)
      const sellPrice = Number(trade.price) || 0
      const name = String(trade.name || '').trim() || code

      // 매도일 ~ 오늘 경과일 + 여유, 상한 120 거래일
      const elapsedDays = sellDate
        ? Math.max(0, Math.round((Date.now() - new Date(`${sellDate}T00:00:00Z`).getTime()) / 86_400_000))
        : 0
      const fetchDays = Math.min(120, Math.max(10, elapsedDays + 5))

      const bars = await fetchProChartBars(code, fetchDays).catch(() => [])
      // 일봉 date는 'YYYYMMDD' 형식 → 매도일 이후(당일 포함)만 사용
      const sellDigits = sellDate.replace(/\D/g, '')
      const afterBars = bars.filter((b) => String(b.date || '').replace(/\D/g, '') >= sellDigits)

      const summaryBase = {
        sellPrice,
        currentPrice: null,
        maxPrice: null,
        changeToCurrentPct: null,
        changeToMaxPct: null,
        barsAfter: afterBars.length,
      }

      if (sellPrice <= 0 || afterBars.length < 2) {
        res.json({
          review: null,
          summary: summaryBase,
          message: '매도 후 주가 데이터가 충분하지 않아 복기를 생성할 수 없습니다.',
        })
        return
      }

      const closes = afterBars.map((b) => Number(b.close) || 0).filter((n) => n > 0)
      const highs = afterBars.map((b) => Number(b.high) || Number(b.close) || 0).filter((n) => n > 0)
      const currentPrice = closes.length ? closes[closes.length - 1] : 0
      const maxPrice = highs.length ? Math.max(...highs) : 0
      const pct = (to) => (sellPrice > 0 && to > 0 ? ((to - sellPrice) / sellPrice) * 100 : null)
      const changeToCurrentPct = pct(currentPrice)
      const changeToMaxPct = pct(maxPrice)

      // +5/+20 거래일 종가 (매도 다음 거래일부터)
      const closeAt = (n) => {
        const idx = n // afterBars[0] = 매도일(또는 직후), n거래일 후
        return idx < afterBars.length ? Number(afterBars[idx].close) || 0 : 0
      }
      const change5 = pct(closeAt(5))
      const change20 = pct(closeAt(20))

      const summary = {
        sellPrice,
        currentPrice,
        maxPrice,
        changeToCurrentPct,
        changeToMaxPct,
        barsAfter: afterBars.length,
      }

      const cacheKey = `trade-review:${tradeId}:${seoulSnapshotDateKey()}`
      const { data: cached } = await supabaseService
        .from('market_cache')
        .select('data')
        .eq('cache_key', cacheKey)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()
      if (cached?.data) {
        res.json(cached.data)
        return
      }

      const realized = Number(trade.realized_profit)
      const avgAt = Number(trade.avg_price_at_trade)
      const qty = Number(trade.quantity) || 0
      const realizedPct =
        Number.isFinite(realized) && Number.isFinite(avgAt) && avgAt > 0 && qty > 0
          ? (realized / (avgAt * qty)) * 100
          : null
      const fmtPct = (n) => (n == null ? '데이터 없음' : `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`)

      // 매도 시점 이전 이 종목의 AI 진단(아카이브) — 예측 vs 실제 매도 비교용
      const archived = await fetchRecentDiagnoses(supabaseService, {
        userId,
        kind: 'holding',
        code,
        before: `${sellDate}T23:59:59+09:00`,
        limit: 3,
      }).catch(() => [])
      const diagnoses = archived.map((d) => ({
        date: String(d.created_at || '').slice(0, 10),
        verdict: d.meta?.verdict ?? null,
        summary: d.meta?.summary ?? null,
        diagPrice: Number(d.current_price) > 0 ? Number(d.current_price) : null,
      }))
      const diagLines = diagnoses.map((d) => {
        const price = d.diagPrice ? `, 진단가 ${d.diagPrice.toLocaleString('ko-KR')}원` : ''
        const verdict = d.verdict ? `의견 "${d.verdict}"` : '의견 기록 없음'
        const summary = d.summary ? ` — ${d.summary}` : ''
        return `- ${d.date}: ${verdict}${price}${summary}`
      })

      const lines = [
        `종목: ${name}(${code})`,
        `매도일: ${sellDate}, 매도가: ${sellPrice.toLocaleString('ko-KR')}원`,
        realizedPct != null ? `이 매도의 실현 수익률: ${fmtPct(realizedPct)}` : null,
        `매도 후 현재가: ${currentPrice.toLocaleString('ko-KR')}원 (${fmtPct(changeToCurrentPct)})`,
        `매도 후 최고가: ${maxPrice.toLocaleString('ko-KR')}원 (${fmtPct(changeToMaxPct)})`,
        change5 != null ? `매도 +5거래일 종가 변화: ${fmtPct(change5)}` : null,
        change20 != null ? `매도 +20거래일 종가 변화: ${fmtPct(change20)}` : null,
        `분석 구간: 매도 후 ${afterBars.length}거래일`,
      ].filter(Boolean)

      // 경량 작업: 비관리자(sonnet 기본)는 haiku, opus 부여 사용자는 opus
      const reviewModel = await resolveLightTaskModelId(userId)
      const anthropic = new Anthropic({ apiKey })
      const resp = await createAnthropicMessage(
        anthropic,
        {
          model: reviewModel,
          max_tokens: 550,
          messages: [
            {
              role: 'user',
              content: `투자자의 과거 '매도' 거래를 사후 복기해 3~4문장으로 작성해 주세요.

규칙:
- 정중한 존댓말, 이모지·인사말 금지, 바로 본문부터
- 매도 후 실제 주가 흐름과 비교해 그 매도가 결과적으로 어땠는지 객관적으로 평가
- 이는 사후 '결과론적' 해석임을 한 번 명시하고, 당시 결정을 비난하지 말 것
${
  diagLines.length
    ? "- 아래 'AI 진단 기록'이 있으면, 그 의견과 실제 매도 결정·이후 결과를 1줄로 비교(진단대로/반대로 행동했는지, 결과적으로 유효했는지)\n"
    : ''
}- 향후 매수/매도 권유나 가격 예측은 하지 말 것
- 제공된 수치만 사용하고 새 수치를 지어내지 말 것
- 반드시 완성된 문장으로 마무리

매도 후 데이터:
${lines.join('\n')}
${diagLines.length ? `\n매도 시점 이전 이 종목에 대한 AI 진단 기록:\n${diagLines.join('\n')}\n` : ''}
복기:`,
            },
          ],
        },
        30_000,
      )

      const block = resp.content?.find((b) => b.type === 'text')
      const reviewText = block && 'text' in block ? String(block.text).trim() : ''
      if (resp.usage) {
        await logApiUsage(userId, 'trade-review', reviewModel, resp.usage)
      }

      const payload = { review: reviewText, summary, diagnoses, generatedAt: new Date().toISOString() }
      const expiresAt = new Date(`${seoulSnapshotDateKey()}T23:59:59+09:00`).toISOString()
      await supabaseService
        .from('market_cache')
        .upsert(
          { cache_key: cacheKey, data: payload, expires_at: expiresAt },
          { onConflict: 'cache_key' },
        )

      void logActivity(userId, 'diagnosis', { type: 'trade-review', tradeId }, true)

      res.json(payload)
    } catch (e) {
      const message = mapAnthropicErrorForClient(e)
      console.error('[Trade Review]', e)
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
      res.status(500).json({ error: message })
    }
  }

  /** 로그인한 본인의 누적 AI 사용금액(USD)을 반환 (상단 배지용) */
  async function handleUsageCost(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }
    const ctx = await authn(req, res)
    if (!ctx) return
    const { userId } = ctx

    try {
      // 관리자가 켠 사용자에게만 노출 (개인별 토글)
      const { data: setting } = await supabaseService
        .from('user_settings')
        .select('show_usage_cost')
        .eq('user_id', userId)
        .maybeSingle()
      if (!setting?.show_usage_cost) {
        res.json({ costUsd: null })
        return
      }

      const cacheKey = `usage-cost:${userId}`
      const { data: cached } = await supabaseService
        .from('market_cache')
        .select('data')
        .eq('cache_key', cacheKey)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()
      if (cached?.data) {
        res.json(cached.data)
        return
      }

      // 개인 단위라 행 수가 많지 않으나, 극단적 케이스 대비 상한(누락 가능성은 캡 방식 한계)
      const { data: rows, error } = await supabaseService
        .from('pro_api_usage')
        .select('model, input_tokens, output_tokens')
        .eq('user_id', userId)
        .limit(20000)
      if (error) throw error

      let costUsd = 0
      for (const r of rows || []) {
        costUsd += calcCost(r.model, r.input_tokens, r.output_tokens)
      }

      const payload = { costUsd, calls: (rows || []).length }
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
      await supabaseService
        .from('market_cache')
        .upsert(
          { cache_key: cacheKey, data: payload, expires_at: expiresAt },
          { onConflict: 'cache_key' },
        )

      res.json(payload)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Usage Cost]', message)
      res.status(500).json({ error: message })
    }
  }

  app.post('/api/pro-trades', handlePostTrade)
  app.get('/api/pro-trades', handleGetTrades)
  app.delete('/api/pro-trades', handleDeleteTrade)
  app.post('/api/pro-trades-insight', handleTradesInsight)
  app.post('/api/pro-trade-review', handleTradeReview)
  app.get('/api/pro-usage-cost', handleUsageCost)
}
