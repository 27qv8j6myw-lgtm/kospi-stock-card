/**
 * Pro 스크리너 — 기존 스크리닝 엔진(runScreening)의 룰 점수 + AI TOP5 분석을 노출
 *
 * - 접근: 관리자 또는 screener_enabled 권한 사용자 (requireScreenerAccess)
 * - AI(Claude) TOP5 선정 활성(skipTopFiveAi=false): 헤드라인·요약·핵심동인·리스크·분할매수가·컨센서스
 * - 결과는 runScreening 내부 캐시(1시간)로 공유. force=1 시 KIS + AI 재호출
 */
import { requireScreenerAccess } from '../lib/proAccess.mjs'
import { runScreening } from '../screening/runScreening.mjs'
import { archiveScreenerSnapshot } from '../lib/screenerArchive.mjs'

/**
 * TOP5 항목에 `allStocks`(code→currentPrice) 조인으로 추천 시점 주가를 채워 아카이브용 items 구성.
 * @param {Array<Record<string, unknown>>} topFive
 * @param {Array<Record<string, unknown>>} allStocks
 * @returns {Array<Record<string, unknown>>}
 */
function buildArchiveItems(topFive, allStocks) {
  const priceByCode = new Map()
  for (const s of Array.isArray(allStocks) ? allStocks : []) {
    const code = String(s?.code ?? '')
    const px = Number(s?.currentPrice)
    if (code && Number.isFinite(px) && px > 0) priceByCode.set(code, px)
  }
  return (Array.isArray(topFive) ? topFive : []).map((t) => ({
    rank: Number(t?.rank) || 0,
    code: String(t?.code ?? ''),
    name: String(t?.name ?? ''),
    sectorLabel: t?.sectorLabel ?? null,
    score: Number.isFinite(Number(t?.score)) ? Number(t?.score) : null,
    currentPrice: priceByCode.get(String(t?.code ?? '')) ?? null,
    per: Number.isFinite(Number(t?.per)) ? Number(t?.per) : null,
    consensusUpside: Number.isFinite(Number(t?.consensusUpside)) ? Number(t?.consensusUpside) : null,
    expected1MPct: Number.isFinite(Number(t?.expected1MPct)) ? Number(t?.expected1MPct) : null,
    aiCandidateLabel: t?.aiCandidateLabel ?? null,
    aiHeadline: t?.aiHeadline ?? null,
    aiSummary: t?.aiSummary ?? null,
    aiKeyDriver: t?.aiKeyDriver ?? null,
    aiRisk: t?.aiRisk ?? null,
  }))
}

/**
 * @param {import('express').Application} app
 * @param {{ getSupabaseService: () => import('@supabase/supabase-js').SupabaseClient | null, getUserIdFromRequest: (req: import('express').Request) => Promise<string | null> }} deps
 */
export function registerProScreenerRoutes(app, { getSupabaseService, getUserIdFromRequest }) {
  async function handleScreener(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    const userId = await requireScreenerAccess(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    const appKey = process.env.KIS_APP_KEY?.trim()
    const appSecret = process.env.KIS_APP_SECRET?.trim()
    if (!appKey || !appSecret) {
      res.status(503).json({ error: '서버에 KIS_APP_KEY, KIS_APP_SECRET 이 설정되지 않았습니다.' })
      return
    }

    const env = process.env.KIS_ENV === 'prod' ? 'prod' : 'vps'
    const force = req.query.force === '1'

    try {
      const bundle = await runScreening(appKey, appSecret, env, userId, {
        skipTopFiveAi: false,
        force,
      })
      res.json({
        generatedAt: bundle.generatedAt ?? null,
        sectors: bundle.sectors ?? [],
        allStocks: bundle.allStocks ?? [],
        topFive: bundle.topFive ?? [],
        source: bundle.source ?? null,
        cached: Boolean(bundle.cached),
      })

      // 사용자별 당일 1건 스냅샷 보관 (best-effort, unique 제약으로 첫 조회만 저장)
      void archiveScreenerSnapshot(supabaseService, {
        userId,
        generatedAt: bundle.generatedAt ?? null,
        model: bundle.screeningUserModel ?? null,
        items: buildArchiveItems(bundle.topFive ?? [], bundle.allStocks ?? []),
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Pro Screener]', message)
      res.status(502).json({ error: message })
    }
  }

  app.get('/api/pro-screener', handleScreener)
}
