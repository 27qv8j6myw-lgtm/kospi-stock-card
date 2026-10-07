import { inquireDailyBars, inquireDailyBarsRange, inquireMinuteBars, inquireInvestorByStock } from '../kisClient.mjs'
import { getSupabaseService } from '../lib/supabaseService.mjs'

function credentials(code) {
  if (!/^\d{6}$/.test(code)) throw new Error('6자리 종목코드가 필요합니다')
  const clean = (v) => String(v ?? '').trim().replace(/^(["'])(.*)\1$/, '$2').trim()
  const key = clean(process.env.KIS_APP_KEY)
  const secret = clean(process.env.KIS_APP_SECRET)
  if (!key || !secret) throw new Error('KIS 인증정보가 설정되지 않았습니다')
  return [key, secret, process.env.KIS_ENV === 'prod' ? 'prod' : 'vps', code]
}

function metadata(code, basis = 'KRX') {
  return { code, retrievedAt: new Date().toISOString(), timezone: 'Asia/Seoul', currency: 'KRW', basis, source: 'KIS' }
}

function count(value, fallback, max) {
  const n = value ?? fallback
  if (!Number.isInteger(n) || n < 1 || n > max) throw new Error(`limit은 1~${max} 정수여야 합니다`)
  return n
}

const YMD = /^\d{8}$/
/** 기간 조회(페이지 반복)로 받을 수 있는 최대 봉 수 — kisClient 의 KIS_DAILY_RANGE_MAX_BARS 와 같게 유지 */
const DAILY_RANGE_MAX = 1500
/** 기간 지정이 없을 때 "먼 과거"로 쓰는 시작일 — limit 만큼 채우면 거기서 멈춘다 */
const DAILY_RANGE_FLOOR = '19900101'

const toBar = ({ ts, price, open, high, low, volume }) => ({ date: ts, open, high, low, close: price, volume })
const DAILY_NOTE = '조회 시각은 데이터 확정 시각이 아닙니다. 최신 봉은 미완성일 수 있으며 공급자 반환량만 제공합니다.'

/**
 * 일봉 조회.
 * - 기본(limit ≤ 100, 날짜 없음, 원주가): 기존처럼 한 번 호출.
 * - start_date/end_date 지정, limit > 100, 또는 adjusted=true: KIS 가 한 번에 100건만 주므로
 *   100건씩 거슬러 올라가며 이어 붙인다 (최대 1500봉).
 * @param {{code: string, limit?: number, start_date?: string, end_date?: string, adjusted?: boolean}} input
 */
export async function getDailyBars({ code, limit, start_date, end_date, adjusted }) {
  const creds = credentials(code)
  if (start_date != null && !YMD.test(start_date)) throw new Error('start_date는 YYYYMMDD 형식이어야 합니다')
  if (end_date != null && !YMD.test(end_date)) throw new Error('end_date는 YYYYMMDD 형식이어야 합니다')
  if (start_date != null && end_date != null && start_date > end_date) throw new Error('start_date가 end_date보다 늦습니다')
  const adj = adjusted === true
  const hasRange = start_date != null || end_date != null

  if (!hasRange && !adj && (limit ?? 60) <= 100) {
    const requested = count(limit, 60, 100)
    const rows = await inquireDailyBars(...creds, requested)
    const bars = rows.slice(-requested).map(toBar)
    return { ...metadata(code), adjusted: false, requested, count: bars.length, latestDataDate: bars.at(-1)?.date ?? null, note: DAILY_NOTE, bars }
  }

  const requested = count(limit, start_date != null ? DAILY_RANGE_MAX : 60, DAILY_RANGE_MAX)
  const { bars: rows, pages } = await inquireDailyBarsRange(...creds, {
    start: start_date ?? DAILY_RANGE_FLOOR, end: end_date, adjusted: adj, maxBars: requested })
  const bars = rows.map(toBar)
  return { ...metadata(code), adjusted: adj, requested, count: bars.length, pages,
    fromDate: bars[0]?.date ?? null, latestDataDate: bars.at(-1)?.date ?? null,
    note: `${DAILY_NOTE} 100건 단위로 ${pages}번 나눠 받아 이어 붙인 결과입니다.${adj ? ' 수정주가(액면분할·무상증자 반영)라 당시 실제 호가와 다를 수 있습니다.' : ''}`, bars }
}

/** @param {{code: string, end_time?: string, market?: string}} input */
export async function getMinuteBars({ code, end_time, market = 'krx' }) {
  const markets = { krx: 'J', unified: 'UN', nxt: 'NX' }
  if (!Object.hasOwn(markets, market)) throw new Error('지원하지 않는 시장입니다')
  if (end_time != null && !/^(?:[01]\d|2[0-3])[0-5]\d[0-5]\d$/.test(end_time)) throw new Error('end_time은 HHMMSS 형식이어야 합니다')
  const rows = await inquireMinuteBars(...credentials(code), { endHhmmss: end_time, marketDiv: markets[market] })
  const bars = rows.slice(-30).map(({ date, hhmmss, price, open, high, low, volume }) => ({ date: date ?? null, time: hhmmss, open: open ?? null, high: high ?? null, low: low ?? null, close: price, volume }))
  return { ...metadata(code, { krx: 'KRX', unified: 'KRX+NXT', nxt: 'NXT' }[market]), intervalMinutes: 1,
    count: bars.length, latestDataDate: bars.at(-1)?.date ?? null, latestDataTime: bars.at(-1)?.time ?? null,
    note: '당일 조회 API입니다. 과거 거래일 지정은 지원하지 않습니다. 날짜 null은 공급자 미제공이며 당일 데이터로 단정할 수 없습니다. 마지막 봉은 미완성일 수 있습니다.', bars }
}

function numeric(value, multiplier = 1) {
  if (value == null || String(value).trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n * multiplier : null
}

const fields = { foreign: 'frgn', institution: 'orgn', individual: 'prsn' }
export function normalizeInvestorRows(rows) {
  return rows.filter((r) => /^\d{8}$/.test(r.stck_bsop_date ?? '')).map((r) => ({
    date: r.stck_bsop_date,
    ...Object.fromEntries(Object.entries(fields).map(([name, prefix]) => [name, {
      netShares: numeric(r[`${prefix}_ntby_qty`]),
      netAmountKrw: numeric(r[`${prefix}_ntby_tr_pbmn`], 1_000_000),
    }])),
  })).sort((a, b) => b.date.localeCompare(a.date))
}

export function summarizeFlow(rows, requestedDays) {
  const selected = rows.slice(0, requestedDays)
  return { requestedDays, daysUsed: selected.length, fromDate: selected.at(-1)?.date ?? null, toDate: selected[0]?.date ?? null,
    ...Object.fromEntries(Object.keys(fields).map((name) => [name, Object.fromEntries(['netShares', 'netAmountKrw'].map((key) => {
      const values = selected.map((r) => r[name][key])
      return [key, !values.length || values.some((v) => v == null) ? null : values.reduce((a, b) => a + b, 0)]
    }))])) }
}

/** KIS 투자자 API 가 한 번에 주는 최대 일수 */
const FLOW_LIVE_MAX = 30
/** 누적 테이블까지 합쳐 돌려줄 최대 일수 (약 4년) */
const FLOW_RANGE_MAX = 1000
const FLOW_TABLE = 'investor_flow_daily'
const FLOW_NOTE = '일별 수급이며 실시간 순매수가 아닙니다. 최신일 확정 여부는 보장하지 않습니다. null은 결측, 0은 순매수 0입니다. 누계는 반환된 전체 이력 기준이며 daysUsed를 확인하세요.'

/** 'YYYYMMDD' ↔ 'YYYY-MM-DD' */
const toIso = (ymd) => `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`
const fromIso = (iso) => String(iso).replace(/-/g, '').slice(0, 8)

/**
 * investor_flow_daily 행 → normalizeInvestorRows 와 같은 모양
 * @param {Array<Record<string, unknown>>} rows
 */
export function dbRowsToFlow(rows) {
  const n = (v) => (v == null ? null : Number(v))
  return rows.map((r) => ({
    date: fromIso(r.trade_date),
    foreign: { netShares: n(r.foreign_net_qty), netAmountKrw: n(r.foreign_net_amt) },
    institution: { netShares: n(r.institution_net_qty), netAmountKrw: n(r.institution_net_amt) },
    individual: { netShares: n(r.individual_net_qty), netAmountKrw: n(r.individual_net_amt) },
  }))
}

/**
 * KIS 라이브 행이 같은 날짜의 저장 행을 덮는다 (라이브가 더 최신 확정치). 최신순.
 * @param {ReturnType<typeof normalizeInvestorRows>} liveRows
 * @param {ReturnType<typeof normalizeInvestorRows>} dbRows
 */
export function mergeFlowRows(liveRows, dbRows) {
  const byDate = new Map()
  for (const r of dbRows) byDate.set(r.date, r)
  for (const r of liveRows) byDate.set(r.date, r)
  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date))
}

/**
 * 누적 테이블에서 읽는다. 테이블·서비스 키가 없으면 available=false.
 * @param {string} code
 * @param {{ start?: string, end?: string, limit: number }} opts  start/end = YYYYMMDD
 */
async function readStoredFlow(code, { start, end, limit }) {
  const supabase = getSupabaseService()
  if (!supabase) return { rows: [], available: false }
  let q = supabase.from(FLOW_TABLE)
    .select('trade_date,foreign_net_qty,foreign_net_amt,institution_net_qty,institution_net_amt,individual_net_qty,individual_net_amt')
    .eq('code', code).order('trade_date', { ascending: false }).limit(limit)
  if (start) q = q.gte('trade_date', toIso(start))
  if (end) q = q.lte('trade_date', toIso(end))
  const { data, error } = await q
  if (error) throw new Error(`수급 누적 테이블 조회 실패: ${error.message}`)
  return { rows: dbRowsToFlow(data ?? []), available: true }
}

/**
 * 투자자별 일별 순매수.
 * - 기본(limit ≤ 30, 날짜 없음): KIS 라이브 30일치만.
 * - start_date/end_date 지정 또는 limit > 30: 매일 cron 이 쌓는 investor_flow_daily 와 합쳐
 *   최대 1000일. 과거는 누적을 시작한 날부터만 있다 (KIS 는 과거 조회를 지원하지 않는다).
 * @param {{code: string, limit?: number, start_date?: string, end_date?: string}} input
 * @param {{ readStored?: typeof readStoredFlow }} [deps]
 */
export async function getInvestorFlow({ code, limit, start_date, end_date }, deps = {}) {
  const creds = credentials(code)
  if (start_date != null && !YMD.test(start_date)) throw new Error('start_date는 YYYYMMDD 형식이어야 합니다')
  if (end_date != null && !YMD.test(end_date)) throw new Error('end_date는 YYYYMMDD 형식이어야 합니다')
  if (start_date != null && end_date != null && start_date > end_date) throw new Error('start_date가 end_date보다 늦습니다')
  const hasRange = start_date != null || end_date != null
  const data = await inquireInvestorByStock(...creds)
  const live = normalizeInvestorRows(data.rows ?? [])
  const base = { ...metadata(code), realtime: false, units: { netShares: '주', netAmountKrw: '원' } }

  if (!hasRange && (limit ?? 20) <= FLOW_LIVE_MAX) {
    const requested = count(limit, 20, FLOW_LIVE_MAX)
    return { ...base, latestDataDate: live[0]?.date ?? null, requested, count: Math.min(live.length, requested), note: FLOW_NOTE,
      cumulative3d: summarizeFlow(live, 3), cumulative5d: summarizeFlow(live, 5), cumulative20d: summarizeFlow(live, 20), rows: live.slice(0, requested) }
  }

  const requested = count(limit, start_date != null ? FLOW_RANGE_MAX : 20, FLOW_RANGE_MAX)
  const readStored = deps.readStored ?? readStoredFlow
  const stored = await readStored(code, { start: start_date, end: end_date, limit: requested + FLOW_LIVE_MAX })
  const inRange = (r) => (start_date == null || r.date >= start_date) && (end_date == null || r.date <= end_date)
  const merged = mergeFlowRows(live.filter(inRange), stored.rows).filter(inRange)
  const rows = merged.slice(0, requested)
  const note = `${FLOW_NOTE} ${stored.available
    ? `KIS 최근 30일과 매일 쌓는 누적 테이블(${FLOW_TABLE})을 합친 결과입니다. 누적을 시작한 날 이전 과거는 없습니다.`
    : '누적 테이블(Supabase)을 읽을 수 없어 KIS 최근 30일만 반환했습니다.'}`
  return { ...base, source: stored.available ? 'KIS+DB' : 'KIS', latestDataDate: rows[0]?.date ?? null, fromDate: rows.at(-1)?.date ?? null,
    requested, count: rows.length, storedCount: stored.rows.length, note,
    cumulative3d: summarizeFlow(merged, 3), cumulative5d: summarizeFlow(merged, 5), cumulative20d: summarizeFlow(merged, 20), rows }
}
