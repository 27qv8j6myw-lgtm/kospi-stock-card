import { requireProUser } from '../lib/proAccess.mjs'
import { getKisQuote } from '../lib/toolExecutor.mjs'

/** verdict + 진단 이후 수익률로 적중 여부 추정 (참고용) */
function judgeOutcome(verdict, returnPct) {
  if (!verdict || !Number.isFinite(returnPct)) return 'neutral'
  if (Math.abs(returnPct) < 1) return 'neutral'
  const bullish = ['홀딩', '추가매수', '매수'].includes(verdict)
  const bearish = ['익절', '일부익절', '손절', '매도'].includes(verdict)
  if (bullish) return returnPct >= 0 ? 'hit' : 'miss'
  if (bearish) return returnPct <= 0 ? 'hit' : 'miss'
  return 'neutral'
}

/**
 * Pro AI 진단 아카이브 조회/삭제/핀 라우트.
 * @param {import('express').Application} app
 * @param {{ getSupabaseService: () => import('@supabase/supabase-js').SupabaseClient | null, getUserIdFromRequest: (req: import('express').Request) => Promise<string | null> }} deps
 */
export function registerProDiagnosisArchiveRoutes(app, { getSupabaseService, getUserIdFromRequest }) {
  const VALID_KINDS = new Set(['holding', 'portfolio', 'group'])

  async function handleGet(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    const id = String(req.query?.id ?? '').trim()

    // 단건 전문 조회
    if (id) {
      const { data, error } = await supabaseService
        .from('pro_diagnosis_archive')
        .select('id, kind, ref_id, code, title, analysis, profit_pct, current_price, model, meta, pinned, created_at')
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

    // 성과 스코어보드 집계 (보유종목 진단 한정, 10분 캐시)
    if (String(req.query?.stats ?? '') === '1') {
      const statsCacheKey = `diag-stats:${userId}`
      const { data: cachedStats } = await supabaseService
        .from('market_cache')
        .select('data')
        .eq('cache_key', statsCacheKey)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()
      if (cachedStats?.data) {
        res.json(cachedStats.data)
        return
      }

      const { data: rows, error: statsErr } = await supabaseService
        .from('pro_diagnosis_archive')
        .select('code, current_price, meta, created_at')
        .eq('user_id', userId)
        .eq('kind', 'holding')
        .not('code', 'is', null)
        .gt('current_price', 0)
        .order('created_at', { ascending: false })
        .limit(200)
      if (statsErr) {
        res.status(500).json({ error: statsErr.message })
        return
      }

      const archiveRows = rows ?? []
      const codes = [...new Set(archiveRows.map((r) => String(r.code)))]
      /** @type {Map<string, number>} */
      const priceMap = new Map()
      await Promise.all(
        codes.map(async (c) => {
          try {
            const q = await getKisQuote(c)
            const p = Number(q?.currentPrice) || 0
            if (p > 0) priceMap.set(c, p)
          } catch {
            // 개별 실패 무시
          }
        }),
      )

      let hit = 0
      let miss = 0
      let neutral = 0
      let returnSum = 0
      let returnCount = 0
      /** @type {Record<string, number>} */
      const verdictDist = {}
      for (const r of archiveRows) {
        const verdict = r.meta?.verdict
        if (verdict) verdictDist[verdict] = (verdictDist[verdict] || 0) + 1
        const live = priceMap.get(String(r.code))
        const diag = Number(r.current_price) || 0
        if (live && diag > 0) {
          const ret = ((live - diag) / diag) * 100
          returnSum += ret
          returnCount += 1
          const o = judgeOutcome(verdict, ret)
          if (o === 'hit') hit += 1
          else if (o === 'miss') miss += 1
          else neutral += 1
        }
      }

      const payload = {
        stats: {
          total: archiveRows.length,
          scored: returnCount,
          hit,
          miss,
          neutral,
          hitRate: hit + miss > 0 ? (hit / (hit + miss)) * 100 : null,
          avgReturnPct: returnCount > 0 ? returnSum / returnCount : null,
          verdictDist,
        },
      }
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
      await supabaseService
        .from('market_cache')
        .upsert(
          { cache_key: statsCacheKey, data: payload, expires_at: expiresAt },
          { onConflict: 'cache_key' },
        )
      res.json(payload)
      return
    }

    // 목록 (분석 본문 제외 경량)
    const kind = String(req.query?.kind ?? '').trim()
    const code = String(req.query?.code ?? '').trim()
    const pinnedOnly = String(req.query?.pinned ?? '') === '1'
    const withOutcome = String(req.query?.withOutcome ?? '') === '1'
    const limit = Math.min(Math.max(Number(req.query?.limit) || 30, 1), 100)

    let query = supabaseService
      .from('pro_diagnosis_archive')
      .select('id, kind, ref_id, code, title, profit_pct, current_price, model, meta, pinned, created_at')
      .eq('user_id', userId)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (kind && VALID_KINDS.has(kind)) query = query.eq('kind', kind)
    if (code) query = query.eq('code', code)
    if (pinnedOnly) query = query.eq('pinned', true)

    const { data, error } = await query
    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    let items = data ?? []

    // 진단 이후 성과: code + 진단가가 있는 항목에 한해 현재가 배치 조회
    if (withOutcome && items.length) {
      const codes = [
        ...new Set(
          items
            .filter((it) => it.code && Number(it.current_price) > 0)
            .map((it) => String(it.code)),
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
        items = items.map((it) => {
          const live = it.code ? priceMap.get(String(it.code)) : undefined
          const diagPrice = Number(it.current_price) || 0
          if (live && diagPrice > 0) {
            const returnSincePct = ((live - diagPrice) / diagPrice) * 100
            return {
              ...it,
              livePrice: live,
              returnSincePct,
              outcome: judgeOutcome(it.meta?.verdict, returnSincePct),
            }
          }
          return it
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
      .from('pro_diagnosis_archive')
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
      .from('pro_diagnosis_archive')
      .delete()
      .eq('user_id', userId)
      .eq('id', id)
    if (error) {
      res.status(500).json({ error: error.message })
      return
    }
    res.json({ ok: true })
  }

  app.get('/api/pro-diagnosis-archive', handleGet)
  app.patch('/api/pro-diagnosis-archive', handlePatch)
  app.delete('/api/pro-diagnosis-archive', handleDelete)
}
