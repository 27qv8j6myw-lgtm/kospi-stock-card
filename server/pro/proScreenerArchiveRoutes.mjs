import { requireProUser } from '../lib/proAccess.mjs'
import { getKisQuote } from '../lib/toolExecutor.mjs'

/**
 * 추천 종목 items 에 현재가/수익률을 부여하고 레코드 집계를 계산.
 * @param {Array<Record<string, any>>} items
 * @param {Map<string, number>} priceMap
 * @returns {{ items: Array<Record<string, any>>, avgReturnPct: number|null, positiveCount: number, scored: number }}
 */
function enrichItemsWithOutcome(items, priceMap) {
  let returnSum = 0
  let scored = 0
  let positiveCount = 0
  const enriched = (Array.isArray(items) ? items : []).map((it) => {
    const code = String(it?.code ?? '')
    const live = code ? priceMap.get(code) : undefined
    const recPrice = Number(it?.currentPrice) || 0
    if (live && recPrice > 0) {
      const returnSincePct = ((live - recPrice) / recPrice) * 100
      returnSum += returnSincePct
      scored += 1
      if (returnSincePct >= 0) positiveCount += 1
      return { ...it, livePrice: live, returnSincePct }
    }
    return it
  })
  return {
    items: enriched,
    avgReturnPct: scored > 0 ? returnSum / scored : null,
    positiveCount,
    scored,
  }
}

/**
 * Pro 스크리너 아카이브 조회/삭제/핀 라우트.
 * @param {import('express').Application} app
 * @param {{ getSupabaseService: () => import('@supabase/supabase-js').SupabaseClient | null, getUserIdFromRequest: (req: import('express').Request) => Promise<string | null> }} deps
 */
export function registerProScreenerArchiveRoutes(app, { getSupabaseService, getUserIdFromRequest }) {
  async function handleGet(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    const id = String(req.query?.id ?? '').trim()

    // 단건 조회 (items 전체 포함)
    if (id) {
      const { data, error } = await supabaseService
        .from('pro_screener_archive')
        .select('id, archive_date, generated_at, model, items, pinned, created_at')
        .eq('user_id', userId)
        .eq('id', id)
        .maybeSingle()
      if (error) {
        res.status(500).json({ error: error.message })
        return
      }
      if (!data) {
        res.status(404).json({ error: '항목을 찾을 수 없습니다' })
        return
      }
      res.json({ item: data })
      return
    }

    const pinnedOnly = String(req.query?.pinned ?? '') === '1'
    const withOutcome = String(req.query?.withOutcome ?? '') === '1'
    const limit = Math.min(Math.max(Number(req.query?.limit) || 60, 1), 100)

    let query = supabaseService
      .from('pro_screener_archive')
      .select('id, archive_date, generated_at, model, items, pinned, created_at')
      .eq('user_id', userId)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (pinnedOnly) query = query.eq('pinned', true)

    const { data, error } = await query
    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    let items = data ?? []

    // 추천 시점 대비 현재가 성과: 전체 레코드의 고유 code 를 모아 배치 조회
    if (withOutcome && items.length) {
      const codes = [
        ...new Set(
          items.flatMap((rec) =>
            (Array.isArray(rec.items) ? rec.items : [])
              .filter((it) => it?.code && Number(it.currentPrice) > 0)
              .map((it) => String(it.code)),
          ),
        ),
      ]
      if (codes.length) {
        /** @type {Map<string, number>} */
        const priceMap = new Map()
        await Promise.all(
          codes.map(async (c) => {
            try {
              const q = await getKisQuote(c)
              const p = Number(q?.currentPrice) || 0
              if (p > 0) priceMap.set(c, p)
            } catch {
              // 개별 실패는 무시
            }
          }),
        )
        items = items.map((rec) => {
          const { items: enriched, avgReturnPct, positiveCount, scored } = enrichItemsWithOutcome(
            rec.items,
            priceMap,
          )
          return { ...rec, items: enriched, avgReturnPct, positiveCount, scored }
        })
      }
    }

    res.json({ items })
  }

  async function handlePatch(req, res) {
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
    const pinned = req.body?.pinned === true

    const { error } = await supabaseService
      .from('pro_screener_archive')
      .update({ pinned })
      .eq('user_id', userId)
      .eq('id', id)
    if (error) {
      res.status(500).json({ error: error.message })
      return
    }
    res.json({ ok: true, pinned })
  }

  async function handleDelete(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    const id = String(req.query?.id ?? req.body?.id ?? '').trim()
    if (!id) {
      res.status(400).json({ error: 'id 필요' })
      return
    }

    const { error } = await supabaseService
      .from('pro_screener_archive')
      .delete()
      .eq('user_id', userId)
      .eq('id', id)
    if (error) {
      res.status(500).json({ error: error.message })
      return
    }
    res.json({ ok: true })
  }

  app.get('/api/pro-screener-archive', handleGet)
  app.patch('/api/pro-screener-archive', handlePatch)
  app.delete('/api/pro-screener-archive', handleDelete)
}
