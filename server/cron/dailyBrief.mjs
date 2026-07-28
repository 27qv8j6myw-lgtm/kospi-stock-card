/**
 * Vercel Cron — Pro 장 마감 데일리 브리핑 (평일 15:50 KST, 스냅샷 10분 후)
 *
 * 보유종목이 있는 Pro 사용자별로:
 * - 당일 vs 전일 스냅샷 변화, 지수(market-summary), 보유종목 등락 상위/하위 수집
 * - Opus 4.8 로 2~3문장 요약 생성 → pro_daily_briefings upsert
 */
import Anthropic from '@anthropic-ai/sdk'
import { createAnthropicMessage } from '../lib/anthropicTimed.mjs'
import { getSupabaseService } from '../lib/supabaseService.mjs'
import { logApiUsage } from '../lib/usageLogger.mjs'
import { getKisQuote } from '../lib/toolExecutor.mjs'
import { isValidStockCode, normalizeKisIscd } from '../lib/stockCode.mjs'
import { seoulSnapshotDateKey, verifyCronSecret } from '../lib/snapshotProGroups.mjs'
import { getMarketSummary } from '../marketSummary.mjs'

const BRIEF_MODEL = 'claude-opus-5'
const BRIEF_TIMEOUT_MS = 30_000
const QUOTE_DELAY_MS = 120

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/** @param {number | null | undefined} n */
function fmtPct(n) {
  if (n == null || !Number.isFinite(n)) return null
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`
}

/** @param {number} n */
function fmtKrw(n) {
  return `${Math.round(n).toLocaleString('ko-KR')}원`
}

/** 지수 요약 한 줄 (KOSPI·KOSDAQ만) */
async function buildIndexLine() {
  const appKey = (process.env.KIS_APP_KEY ?? '').trim()
  const appSecret = (process.env.KIS_APP_SECRET ?? '').trim()
  if (!appKey || !appSecret) return null
  const env = process.env.KIS_ENV === 'prod' ? 'prod' : 'vps'
  try {
    const summary = await getMarketSummary(appKey, appSecret, env)
    const parts = []
    for (const key of ['kospi', 'kosdaq']) {
      const row = summary.indices.find((i) => i.key === key)
      if (row?.value != null && Number.isFinite(row.value)) {
        const ch = fmtPct(row.change)
        parts.push(`${row.label} ${row.value.toLocaleString('ko-KR')}${ch ? ` (${ch})` : ''}`)
      }
    }
    return parts.length ? parts.join(', ') : null
  } catch {
    return null
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {string} briefDate YYYY-MM-DD
 * @returns {Promise<Map<string, { today: number | null, prev: number | null }>>} userId → 합산 total_value
 */
async function loadSnapshotTotals(sb, briefDate) {
  /** @type {Map<string, { today: number | null, prev: number | null }>} */
  const totals = new Map()

  const { data: rows } = await sb
    .from('pro_group_snapshots')
    .select('user_id, snapshot_date, total_value')
    .lte('snapshot_date', briefDate)
    .order('snapshot_date', { ascending: false })
    .limit(5000)

  /** userId → date → sum */
  const byUserDate = new Map()
  for (const r of rows || []) {
    const uid = String(r.user_id)
    const date = String(r.snapshot_date)
    if (!byUserDate.has(uid)) byUserDate.set(uid, new Map())
    const m = byUserDate.get(uid)
    m.set(date, (m.get(date) || 0) + (Number(r.total_value) || 0))
  }

  for (const [uid, m] of byUserDate) {
    const dates = [...m.keys()].sort().reverse()
    const today = m.has(briefDate) ? m.get(briefDate) : null
    const prevDate = dates.find((d) => d < briefDate) ?? null
    totals.set(uid, { today, prev: prevDate ? m.get(prevDate) : null })
  }
  return totals
}

/**
 * @param {import('http').IncomingMessage & { query?: Record<string, unknown> }} req
 * @param {import('http').ServerResponse & { status: (n: number) => any, json: (b: unknown) => void }} res
 */
export async function handleCronDailyBrief(req, res) {
  if (req.method && req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'GET or POST only' })
    return
  }
  if (!verifyCronSecret(req)) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }

  const sb = getSupabaseService()
  if (!sb) {
    res.status(503).json({ error: 'Supabase 미설정' })
    return
  }

  const apiKey = (process.env.ANTHROPIC_API_KEY ?? '').trim()
  if (!apiKey) {
    res.status(503).json({ error: 'ANTHROPIC_API_KEY 미설정' })
    return
  }

  try {
    const briefDate = seoulSnapshotDateKey()

    // Pro 사용자 + 보유종목
    const [{ data: settings }, { data: holdings }] = await Promise.all([
      sb.from('user_settings').select('user_id, pro_enabled').eq('pro_enabled', true),
      sb.from('pro_holdings').select('user_id, code, name, quantity, avg_price'),
    ])

    const proUserIds = new Set((settings || []).map((s) => String(s.user_id)))

    /** @type {Map<string, Array<{ code: string, name: string, quantity: number, avgPrice: number }>>} */
    const holdingsByUser = new Map()
    for (const h of holdings || []) {
      const uid = String(h.user_id || '')
      if (!uid || !proUserIds.has(uid)) continue
      const code = normalizeKisIscd(h.code)
      if (!isValidStockCode(code)) continue
      if (!holdingsByUser.has(uid)) holdingsByUser.set(uid, [])
      holdingsByUser.get(uid).push({
        code,
        name: String(h.name || '').trim() || code,
        quantity: Number(h.quantity) || 0,
        avgPrice: Number(h.avg_price) || 0,
      })
    }

    if (holdingsByUser.size === 0) {
      res.json({ ok: true, date: briefDate, users: 0, saved: 0 })
      return
    }

    const [indexLine, snapshotTotals] = await Promise.all([
      buildIndexLine(),
      loadSnapshotTotals(sb, briefDate),
    ])

    // 종목 시세 (사용자 간 중복 코드 1회만 조회)
    /** @type {Map<string, { price: number, changePct: number }>} */
    const quoteCache = new Map()
    const allCodes = [...new Set([...holdingsByUser.values()].flat().map((h) => h.code))]
    for (const code of allCodes) {
      try {
        const q = await getKisQuote(code)
        quoteCache.set(code, {
          price: Number(q?.currentPrice) || 0,
          changePct: Number(q?.changePct) || 0,
        })
      } catch {
        quoteCache.set(code, { price: 0, changePct: 0 })
      }
      await sleep(QUOTE_DELAY_MS)
    }

    const anthropic = new Anthropic({ apiKey })
    let saved = 0
    const errors = []

    for (const [userId, userHoldings] of holdingsByUser) {
      try {
        const enriched = userHoldings
          .map((h) => {
            const q = quoteCache.get(h.code)
            return { ...h, price: q?.price || 0, changePct: q?.changePct || 0 }
          })
          .filter((h) => h.price > 0)

        if (enriched.length === 0) continue

        const sorted = [...enriched].sort((a, b) => b.changePct - a.changePct)
        const top = sorted.slice(0, 2)
        const bottom = sorted.slice(-2).reverse()
        const totals = snapshotTotals.get(userId)
        const dayChangeKrw =
          totals?.today != null && totals?.prev != null ? totals.today - totals.prev : null
        const dayChangePct =
          dayChangeKrw != null && totals?.prev ? (dayChangeKrw / totals.prev) * 100 : null

        const lines = [
          indexLine ? `지수: ${indexLine}` : null,
          dayChangeKrw != null
            ? `포트폴리오 전일 대비: ${dayChangeKrw >= 0 ? '+' : ''}${fmtKrw(dayChangeKrw)}${dayChangePct != null ? ` (${fmtPct(dayChangePct)})` : ''}`
            : null,
          `상승 상위: ${top.map((h) => `${h.name} ${fmtPct(h.changePct)}`).join(', ')}`,
          `하락 상위: ${bottom.map((h) => `${h.name} ${fmtPct(h.changePct)}`).join(', ')}`,
          `보유 종목 수: ${enriched.length}`,
        ].filter(Boolean)

        const resp = await createAnthropicMessage(
          anthropic,
          {
            model: BRIEF_MODEL,
            max_tokens: 400,
            messages: [
              {
                role: 'user',
                content: `한국 주식 보유자의 장 마감 데일리 브리핑을 2~3문장으로 작성해 주세요.

규칙:
- 정중한 존댓말, 이모지·인사말 금지, 바로 본문부터
- 오늘 포트폴리오에 영향이 컸던 요소(지수 흐름, 등락 상위 종목)를 중심으로
- 투자 권유 표현 금지, 사실 요약 위주
- 반드시 완성된 문장으로 마무리

오늘 데이터:
${lines.join('\n')}

브리핑:`,
              },
            ],
          },
          BRIEF_TIMEOUT_MS,
        )

        const block = resp.content?.find((b) => b.type === 'text')
        const content = block && 'text' in block ? String(block.text).trim() : ''
        if (!content) continue

        if (resp.usage) {
          await logApiUsage(userId, 'daily-briefing', BRIEF_MODEL, resp.usage)
        }

        const stats = {
          indexLine,
          dayChangeKrw,
          dayChangePct,
          top: top.map((h) => ({ name: h.name, code: h.code, changePct: h.changePct })),
          bottom: bottom.map((h) => ({ name: h.name, code: h.code, changePct: h.changePct })),
          holdingsCount: enriched.length,
        }

        const { error: upsertErr } = await sb.from('pro_daily_briefings').upsert(
          { user_id: userId, brief_date: briefDate, content, stats },
          { onConflict: 'user_id,brief_date' },
        )
        if (upsertErr) throw new Error(upsertErr.message)
        saved += 1
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        console.error('[cron-daily-brief] user', userId, message)
        errors.push({ userId, error: message.slice(0, 200) })
      }
    }

    res.json({
      ok: true,
      date: briefDate,
      users: holdingsByUser.size,
      saved,
      uniqueQuotes: quoteCache.size,
      errors: errors.length ? errors : undefined,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[cron-daily-brief]', message)
    res.status(500).json({ error: message })
  }
}
