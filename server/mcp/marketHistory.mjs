import { inquireDailyBars, inquireDailyBarsRange, inquireMinuteBars, inquireInvestorByStock } from '../kisClient.mjs'

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

/** @param {{code: string, limit?: number}} input */
export async function getInvestorFlow({ code, limit }) {
  const requested = count(limit, 20, 30)
  const data = await inquireInvestorByStock(...credentials(code))
  const rows = normalizeInvestorRows(data.rows ?? [])
  return { ...metadata(code), latestDataDate: rows[0]?.date ?? null, realtime: false,
    units: { netShares: '주', netAmountKrw: '원' }, requested, count: Math.min(rows.length, requested),
    note: '일별 수급이며 실시간 순매수가 아닙니다. 최신일 확정 여부는 보장하지 않습니다. null은 결측, 0은 순매수 0입니다. 누계는 반환된 전체 이력 기준이며 daysUsed를 확인하세요.',
    cumulative3d: summarizeFlow(rows, 3), cumulative5d: summarizeFlow(rows, 5), cumulative20d: summarizeFlow(rows, 20), rows: rows.slice(0, requested) }
}
