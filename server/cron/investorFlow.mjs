/**
 * Vercel Cron — 종목별 투자자 일별 순매수 누적
 *
 * KIS 투자자 API 는 최근 30거래일만 주고 과거 조회가 없다. 매일 장 마감 후 추적 종목의
 * 30일치를 받아 `investor_flow_daily` 에 upsert 한다. 같은 날짜를 매일 다시 쓰므로
 * 당일 잠정치는 다음 실행에서 확정치로 덮인다.
 *
 * 추적 종목 = 기본 목록 ∪ pro_holdings ∪ pro_watchlist ∪ INVESTOR_FLOW_CODES(쉼표 구분).
 */
import { inquireInvestorByStock } from '../kisClient.mjs'
import { normalizeInvestorRows } from '../mcp/marketHistory.mjs'
import { verifyCronSecret } from '../lib/snapshotProGroups.mjs'
import { getSupabaseService } from '../lib/supabaseService.mjs'

export const INVESTOR_FLOW_TABLE = 'investor_flow_daily'

/** 보유·관심 종목이 없어도 쌓아 두는 기본 추적 종목 (대형주·전력기기·반도체 소부장) */
export const DEFAULT_TRACKED_CODES = [
  '005930', '000660', '373220', '207940', '005380', '000270', '105560', '068270', '035420', '012450',
  '329180', '034020', '055550', '009150', '062040', '042700', '403870', '058470', '267260', '010120',
  '011070', '007660', '036930', '034730', '402340',
]

/** 한 번 실행에 조회할 최대 종목 수 — KIS 호출 수와 실행 시간 상한 */
const MAX_CODES = 80

/** @param {unknown} v */
function clean(v) {
  return String(v ?? '').trim().replace(/^(["'])(.*)\1$/, '$2').trim()
}

function kisCredentials() {
  const key = clean(process.env.KIS_APP_KEY)
  const secret = clean(process.env.KIS_APP_SECRET)
  if (!key || !secret) throw new Error('KIS 인증정보가 설정되지 않았습니다')
  const env = process.env.KIS_ENV === 'prod' ? 'prod' : 'vps'
  return { key, secret, env }
}

/** 실전 초당 20건, 모의 초당 2건 — 종목 사이 대기 (ms) */
function delayMs(env) {
  return env === 'prod' ? 150 : 600
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<string[]>}
 */
export async function resolveTrackedCodes(supabase) {
  const set = new Set(DEFAULT_TRACKED_CODES)
  for (const raw of clean(process.env.INVESTOR_FLOW_CODES).split(',')) {
    const c = raw.trim()
    if (/^\d{6}$/.test(c)) set.add(c)
  }
  for (const table of ['pro_holdings', 'pro_watchlist']) {
    const { data, error } = await supabase.from(table).select('code')
    if (error) {
      console.warn(`[cron-investor-flow] ${table} 조회 실패: ${error.message}`)
      continue
    }
    for (const row of data ?? []) {
      const c = String(row.code ?? '').trim()
      if (/^\d{6}$/.test(c)) set.add(c)
    }
  }
  return [...set].sort().slice(0, MAX_CODES)
}

/**
 * normalizeInvestorRows 결과 → 테이블 행
 * @param {string} code
 * @param {ReturnType<typeof normalizeInvestorRows>} rows
 * @param {string} fetchedAt ISO
 */
export function toDbRows(code, rows, fetchedAt) {
  const toInt = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v))
  return rows.map((r) => ({
    code,
    trade_date: `${r.date.slice(0, 4)}-${r.date.slice(4, 6)}-${r.date.slice(6, 8)}`,
    foreign_net_qty: toInt(r.foreign.netShares),
    foreign_net_amt: toInt(r.foreign.netAmountKrw),
    institution_net_qty: toInt(r.institution.netShares),
    institution_net_amt: toInt(r.institution.netAmountKrw),
    individual_net_qty: toInt(r.individual.netShares),
    individual_net_amt: toInt(r.individual.netAmountKrw),
    fetched_at: fetchedAt,
  }))
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ codes?: string[] }} [opts]
 */
export async function runInvestorFlowCollect(supabase, opts = {}) {
  const { key, secret, env } = kisCredentials()
  const codes = opts.codes?.length ? opts.codes : await resolveTrackedCodes(supabase)
  const fetchedAt = new Date().toISOString()
  const results = []
  let upserted = 0
  for (const [i, code] of codes.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, delayMs(env)))
    try {
      const data = await inquireInvestorByStock(key, secret, env, code)
      const rows = toDbRows(code, normalizeInvestorRows(data.rows ?? []), fetchedAt)
      if (!rows.length) {
        results.push({ code, rows: 0, note: '데이터 없음' })
        continue
      }
      const { error } = await supabase.from(INVESTOR_FLOW_TABLE).upsert(rows, { onConflict: 'code,trade_date' })
      if (error) throw new Error(error.message)
      upserted += rows.length
      results.push({ code, rows: rows.length, from: rows.at(-1)?.trade_date, to: rows[0]?.trade_date })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error(`[cron-investor-flow] ${code}: ${message}`)
      results.push({ code, error: message })
    }
  }
  return { ok: true, fetchedAt, codes: codes.length, upserted, failed: results.filter((r) => r.error).length, results }
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export async function handleCronInvestorFlow(req, res) {
  if (req.method && req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'GET or POST only' })
    return
  }
  if (!verifyCronSecret(req)) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }
  const supabase = getSupabaseService()
  if (!supabase) {
    res.status(503).json({ error: 'Supabase 미설정' })
    return
  }
  try {
    res.json(await runInvestorFlowCollect(supabase))
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[cron-investor-flow]', message)
    res.status(500).json({ error: message })
  }
}
