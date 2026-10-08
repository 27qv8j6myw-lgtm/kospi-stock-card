import { inquireDailyBars, inquireDailyBarsRange, inquireMinuteBars, inquireDailyMinuteBars, inquireInvestorByStock, inquireInvestorTradeDailyRange } from '../kisClient.mjs'
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

/** 과거 날짜·긴 구간 분봉 조회의 기본·최대 봉 수 (KRX 하루 1분봉은 391개) */
const MINUTE_RANGE_DEFAULT = 400
const MINUTE_RANGE_MAX = 800
const MINUTE_INTERVALS = [1, 3, 5, 10, 15, 30, 60]

/** 서울 기준 오늘 YYYYMMDD — 서버가 UTC 여도 장 날짜가 어긋나지 않게 */
function seoulToday() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date()).replace(/-/g, '')
}

/**
 * 1분봉을 N분봉으로 묶는다. 구간은 시계 기준(09:00, 09:05 …)이고 time 은 구간 시작 시각.
 * @param {Array<{date: string | null, time: string, open: number | null, high: number | null, low: number | null, close: number, volume: number}>} bars 시각 오름차순
 * @param {number} step 분
 */
export function aggregateMinuteBars(bars, step) {
  if (step <= 1) return bars
  /** @type {Map<number, any>} */
  const buckets = new Map()
  for (const b of bars) {
    const minutes = Number(b.time.slice(0, 2)) * 60 + Number(b.time.slice(2, 4))
    const start = Math.floor(minutes / step) * step
    const hi = b.high ?? b.close
    const lo = b.low ?? b.close
    const cur = buckets.get(start)
    if (!cur) {
      const time = `${String(Math.floor(start / 60)).padStart(2, '0')}${String(start % 60).padStart(2, '0')}00`
      buckets.set(start, { date: b.date, time, open: b.open ?? b.close, high: hi, low: lo, close: b.close, volume: b.volume })
    } else {
      cur.high = Math.max(cur.high, hi)
      cur.low = Math.min(cur.low, lo)
      cur.close = b.close
      cur.volume += b.volume
    }
  }
  return [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v)
}

/**
 * 분봉 조회.
 * - 기본(date 없음, limit ≤ 30, 1분봉): 당일분봉 TR 로 최근 30개 — 모의 환경에서도 된다.
 * - date 지정, limit > 30, 또는 interval > 1: 주식일별분봉조회(실전 전용, 최대 1년 보관)로
 *   그 날짜의 1분봉을 여러 번 나눠 받아 필요하면 N분봉으로 묶는다.
 * @param {{code: string, end_time?: string, market?: string, date?: string, limit?: number, interval?: number}} input
 */
export async function getMinuteBars({ code, end_time, market = 'krx', date, limit, interval }) {
  const markets = { krx: 'J', unified: 'UN', nxt: 'NX' }
  const basis = { krx: 'KRX', unified: 'KRX+NXT', nxt: 'NXT' }
  if (!Object.hasOwn(markets, market)) throw new Error('지원하지 않는 시장입니다')
  if (end_time != null && !/^(?:[01]\d|2[0-3])[0-5]\d[0-5]\d$/.test(end_time)) throw new Error('end_time은 HHMMSS 형식이어야 합니다')
  if (date != null && !YMD.test(date)) throw new Error('date는 YYYYMMDD 형식이어야 합니다')
  const step = interval ?? 1
  if (!MINUTE_INTERVALS.includes(step)) throw new Error(`interval은 ${MINUTE_INTERVALS.join('·')} 중 하나여야 합니다`)
  const toBarRow = ({ date: d, hhmmss, price, open, high, low, volume }) => ({ date: d ?? null, time: hhmmss, open: open ?? null, high: high ?? null, low: low ?? null, close: price, volume })

  if (date == null && step === 1 && (limit ?? 30) <= 30) {
    const requested = count(limit, 30, 30)
    const rows = await inquireMinuteBars(...credentials(code), { endHhmmss: end_time, marketDiv: markets[market] })
    const bars = rows.slice(-requested).map(toBarRow)
    return { ...metadata(code, basis[market]), intervalMinutes: 1,
      count: bars.length, latestDataDate: bars.at(-1)?.date ?? null, latestDataTime: bars.at(-1)?.time ?? null,
      note: '당일 최근 분봉입니다(최대 30개). 과거 날짜·더 긴 구간·N분봉은 date/limit/interval 을 주세요(실전 계정 전용). 날짜 null은 공급자 미제공이며 당일 데이터로 단정할 수 없습니다. 마지막 봉은 미완성일 수 있습니다.', bars }
  }

  const day = date ?? seoulToday()
  const requested = count(limit, MINUTE_RANGE_DEFAULT, MINUTE_RANGE_MAX)
  const { bars: rows, pages } = await inquireDailyMinuteBars(...credentials(code), {
    date: day, endHhmmss: end_time, marketDiv: markets[market], maxBars: Math.min(MINUTE_RANGE_MAX, requested * step) })
  const bars = aggregateMinuteBars(rows.map(toBarRow), step).slice(-requested)
  return { ...metadata(code, basis[market]), intervalMinutes: step, date: day, requested, count: bars.length, pages,
    firstTime: bars[0]?.time ?? null, latestDataDate: bars.length ? day : null, latestDataTime: bars.at(-1)?.time ?? null,
    note: `${day} 분봉입니다. KIS 가 1분봉을 120개씩 주므로 ${pages}번 나눠 받았고${step > 1 ? ` ${step}분 단위로 묶었습니다(time 은 구간 시작 시각)` : ' 묶지 않았습니다'}. 분봉 보관은 최대 1년이라 그보다 오래된 날짜는 비어 있습니다. 당일이면 마지막 봉은 미완성일 수 있습니다.`, bars }
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

/** 세 투자자 값이 전부 비어 있는 날 — 장중 당일처럼 아직 집계가 안 나온 행 */
export function isPendingFlowRow(row) {
  return Object.keys(fields).every((name) => row[name].netShares == null && row[name].netAmountKrw == null)
}

/**
 * 최근 N거래일 누계. 값이 전부 빈 날(isPendingFlowRow)은 건너뛰고 값이 있는 최근 N일을 합산한다 —
 * 미확정인 당일 한 줄 때문에 누계 전체가 null 이 되지 않게. 일부 값만 빈 날은 그대로 두어
 * 해당 항목 합계를 null 로 남긴다 (결측을 0 으로 꾸미지 않는다).
 */
export function summarizeFlow(rows, requestedDays) {
  const selected = rows.filter((r) => !isPendingFlowRow(r)).slice(0, requestedDays)
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
/** 기간 지정이 없을 때 과거 조회의 시작일 — limit 만큼 채우면 거기서 멈춘다 */
const FLOW_HISTORY_FLOOR = '19900101'
/** 과거 조회를 라이브 30일과 겹치게 받는 거래일 수 — 두 TR 의 값·단위가 같은지 매번 대조한다 */
const FLOW_HISTORY_OVERLAP = 5
/** 대금 대조 허용 오차 (원) — 두 TR 모두 백만원 단위로 반올림돼 온다 */
const FLOW_AMOUNT_TOLERANCE_KRW = 1_000_000
const FLOW_NOTE = '일별 수급이며 실시간 순매수가 아닙니다. 최신일 확정 여부는 보장하지 않습니다. null은 결측, 0은 순매수 0입니다. 누계는 값이 전부 빈 날(pendingDates, 장중 당일 등)을 빼고 값이 있는 최근 N거래일을 합산합니다. fromDate·toDate·daysUsed를 확인하세요.'

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
 * 같은 날짜는 라이브(최근 30일) > KIS 과거 조회 > 누적 테이블 순으로 덮는다. 최신순.
 * 단, 값이 전부 빈 행은 값이 있는 행을 덮지 않는다.
 * @param {ReturnType<typeof normalizeInvestorRows>} liveRows
 * @param {ReturnType<typeof normalizeInvestorRows>} dbRows
 * @param {ReturnType<typeof normalizeInvestorRows>} [historyRows]
 */
export function mergeFlowRows(liveRows, dbRows, historyRows = []) {
  const byDate = new Map()
  for (const source of [dbRows, historyRows, liveRows]) {
    for (const r of source) {
      if (byDate.has(r.date) && isPendingFlowRow(r)) continue
      byDate.set(r.date, r)
    }
  }
  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date))
}

/**
 * 라이브 30일과 과거 조회가 겹치는 날짜에서 수량·대금이 같은지 센다 (TR 간 값·단위 검증).
 * @param {ReturnType<typeof normalizeInvestorRows>} liveRows
 * @param {ReturnType<typeof normalizeInvestorRows>} historyRows
 */
export function compareFlowOverlap(liveRows, historyRows) {
  const live = new Map(liveRows.filter((r) => !isPendingFlowRow(r)).map((r) => [r.date, r]))
  let overlapDays = 0
  let mismatchDays = 0
  for (const h of historyRows) {
    const l = live.get(h.date)
    if (!l || isPendingFlowRow(h)) continue
    overlapDays += 1
    const differs = Object.keys(fields).some((name) => {
      const [a, b] = [l[name], h[name]]
      const qty = a.netShares != null && b.netShares != null && a.netShares !== b.netShares
      const amt = a.netAmountKrw != null && b.netAmountKrw != null && Math.abs(a.netAmountKrw - b.netAmountKrw) > FLOW_AMOUNT_TOLERANCE_KRW
      return qty || amt
    })
    if (differs) mismatchDays += 1
  }
  return { overlapDays, mismatchDays }
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
 * - start_date/end_date 지정 또는 limit > 30: 30일보다 오래된 구간은 KIS 종목별 투자자매매동향(일별,
 *   FHPTJ04160001)로 직접 받아 최대 1000일. 과거 조회가 안 되면(모의 환경·KIS 오류) 매일 cron 이
 *   쌓는 investor_flow_daily 로 대체한다. 같은 날짜는 라이브 > 과거 조회 > 누적 테이블 순.
 * @param {{code: string, limit?: number, start_date?: string, end_date?: string}} input
 * @param {{ readStored?: typeof readStoredFlow, fetchHistory?: (opts: { start: string, end?: string, maxDays: number }) => Promise<{ rows: Array<Record<string, unknown>>, pages: number, supported: boolean, error?: string | null }> }} [deps]
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
  const pendingDates = (rows) => rows.filter(isPendingFlowRow).map((r) => r.date)

  if (!hasRange && (limit ?? 20) <= FLOW_LIVE_MAX) {
    const requested = count(limit, 20, FLOW_LIVE_MAX)
    const rows = live.slice(0, requested)
    return { ...base, latestDataDate: live[0]?.date ?? null, requested, count: rows.length, pendingDates: pendingDates(rows), note: FLOW_NOTE,
      cumulative3d: summarizeFlow(live, 3), cumulative5d: summarizeFlow(live, 5), cumulative20d: summarizeFlow(live, 20), rows }
  }

  const requested = count(limit, start_date != null ? FLOW_RANGE_MAX : 20, FLOW_RANGE_MAX)
  const inRange = (r) => (start_date == null || r.date >= start_date) && (end_date == null || r.date <= end_date)
  const liveInRange = live.filter(inRange)

  // 30일보다 오래된 구간이 필요할 때만 과거 TR 을 부른다. 라이브의 가장 오래된 며칠과 겹치게 받아 값·단위를 대조한다.
  const oldestLive = live.at(-1)?.date ?? null
  const needHistory = oldestLive == null || ((start_date ?? FLOW_HISTORY_FLOOR) < oldestLive && requested > liveInRange.length)
  const history = { used: false, supported: null, pages: 0, days: 0, fromDate: null, overlapDays: 0, mismatchDays: 0, error: null }
  let past = []
  if (needHistory) {
    const overlapFrom = live.at(-FLOW_HISTORY_OVERLAP)?.date ?? oldestLive
    const historyEnd = [end_date, overlapFrom].filter((d) => d != null).sort()[0]
    const fetchHistory = deps.fetchHistory ?? ((opts) => inquireInvestorTradeDailyRange(...creds, opts))
    try {
      const got = await fetchHistory({ start: start_date ?? FLOW_HISTORY_FLOOR, end: historyEnd, maxDays: requested })
      past = normalizeInvestorRows(got.rows ?? [])
      Object.assign(history, { used: past.length > 0, supported: got.supported !== false, pages: got.pages ?? 0, days: past.length,
        fromDate: past.at(-1)?.date ?? null, error: got.error ?? null, ...compareFlowOverlap(live, past) })
    } catch (e) {
      history.error = e instanceof Error ? e.message : String(e)
    }
  }

  const readStored = deps.readStored ?? readStoredFlow
  const stored = await readStored(code, { start: start_date, end: end_date, limit: requested + FLOW_LIVE_MAX })
  const merged = mergeFlowRows(liveInRange, stored.rows, past).filter(inRange)
  const rows = merged.slice(0, requested)
  const historyNote = history.used
    ? `30일보다 오래된 구간은 KIS 종목별 투자자매매동향(일별)로 받았습니다(${history.fromDate}부터 ${history.days}일, ${history.pages}번 호출).${history.error ? ` 중간에 멈췄습니다: ${history.error}` : ''}`
    : !needHistory ? '요청 구간이 KIS 최근 30일 안에 있습니다.'
      : history.supported === false ? '과거 조회 TR 은 실전 계정 전용이라 이 환경에서는 쓰지 못했습니다.'
        : history.error ? `KIS 과거 조회에 실패했습니다: ${history.error}` : 'KIS 과거 조회가 빈 결과를 돌려줬습니다.'
  const storedNote = stored.available
    ? `누적 테이블(${FLOW_TABLE})은 과거 조회가 비는 날짜만 채웁니다.`
    : '누적 테이블(Supabase)은 읽을 수 없었습니다.'
  const source = ['KIS', history.used ? 'KIS-HIST' : null, stored.available ? 'DB' : null].filter(Boolean).join('+')
  return { ...base, source, latestDataDate: rows[0]?.date ?? null, fromDate: rows.at(-1)?.date ?? null,
    requested, count: rows.length, storedCount: stored.rows.length, history, pendingDates: pendingDates(rows),
    note: `${FLOW_NOTE} ${historyNote} ${storedNote}`,
    cumulative3d: summarizeFlow(merged, 3), cumulative5d: summarizeFlow(merged, 5), cumulative20d: summarizeFlow(merged, 20), rows }
}
