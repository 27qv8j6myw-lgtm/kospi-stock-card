/**
 * MCP 커넥터 확장 조회 — 장중 추정 수급, 호가·예상체결가, 개장일, 지수 일봉, 투자의견, 추정실적,
 * 시가총액 상위, 외국인·기관 순매수 상위(장중 가집계).
 *
 * KIS 호출은 kisClient 가 하고, 여기서는 입력 검증과 대화에서 바로 읽을 수 있는 모양으로의
 * 정리만 한다. 실전 계정 전용 TR 은 모의(vps) 환경에서 kisClient 가 PROD_ONLY 오류를 던진다.
 */
import {
  inquireInvestorTrendEstimate,
  inquireAskingPriceExpCcn,
  inquireMarketHolidays,
  inquireIndexDailyBarsRange,
  inquireInvestOpinions,
  inquireEstimatePerform,
  inquireMarketCapRank,
  inquireForeignInstitutionRank,
} from '../kisClient.mjs'
import { getCachedOrFetch } from '../lib/cacheHelper.mjs'

const YMD = /^\d{8}$/

/** @returns {[string, string, 'prod' | 'vps']} */
function kisCredentials() {
  const clean = (v) => String(v ?? '').trim().replace(/^(["'])(.*)\1$/, '$2').trim()
  const key = clean(process.env.KIS_APP_KEY)
  const secret = clean(process.env.KIS_APP_SECRET)
  if (!key || !secret) throw new Error('KIS 인증정보가 설정되지 않았습니다')
  return [key, secret, process.env.KIS_ENV === 'prod' ? 'prod' : 'vps']
}

function requireCode(code) {
  if (!/^\d{6}$/.test(String(code ?? ''))) throw new Error('6자리 종목코드가 필요합니다')
  return String(code)
}

function meta(extra = {}) {
  return { retrievedAt: new Date().toISOString(), timezone: 'Asia/Seoul', source: 'KIS', ...extra }
}

function intInRange(value, fallback, min, max, name) {
  const n = value ?? fallback
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${name}은 ${min}~${max} 정수여야 합니다`)
  return n
}

function numeric(value) {
  if (value == null || String(value).trim() === '') return null
  const n = Number(String(value).replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

/** 서울 기준 오늘 YYYYMMDD */
export function seoulToday(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(now).replace(/-/g, '')
}

/** YYYYMMDD 에 일수를 더한다 (달력 계산이라 시간대와 무관하게 UTC 로 처리) */
export function addDays(ymd, days) {
  const d = new Date(Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(4, 6)) - 1, Number(ymd.slice(6, 8)) + days))
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
function weekdayOf(ymd) {
  return WEEKDAYS[new Date(Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(4, 6)) - 1, Number(ymd.slice(6, 8)))).getUTCDay()]
}

const hhmmLabel = (hhmm) => (hhmm ? `${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}` : null)

/**
 * 장중 외국인·기관 추정 순매수 (당일, 주 단위 누계).
 * @param {{ code: string }} input
 */
export async function getFlowEstimate({ code }) {
  const rows = await inquireInvestorTrendEstimate(...kisCredentials(), requireCode(code))
  const slots = rows.map((r) => ({
    time: hhmmLabel(r.hhmm),
    foreignNetShares: r.foreignNetShares,
    institutionNetShares: r.institutionNetShares,
    sumNetShares: r.sumNetShares,
  }))
  const entered = slots.filter((s) => (s.foreignNetShares ?? 0) !== 0 || (s.institutionNetShares ?? 0) !== 0)
  return {
    code, ...meta(), estimated: true, units: { netShares: '주' },
    count: slots.length, latest: entered.at(-1) ?? null, slots,
    note: '증권사 직원이 장중에 집계·입력한 추정치의 누계이며 확정 수급이 아닙니다. 입력 시각은 외국인 09:30·11:20·13:20·14:30, 기관 10:00·11:20·13:20·14:30 이고 사정에 따라 달라질 수 있습니다. 응답에 날짜가 없어 장 시작 전에는 전 거래일 값일 수 있습니다. 0 은 아직 입력 전일 수 있습니다. 금액은 제공되지 않습니다. 확정치는 장 마감 후(15:40 이후) get_investor_flow 로 확인하세요.',
  }
}

const MARKET_DIVS = { krx: 'J', unified: 'UN', nxt: 'NX' }
const BASIS = { krx: 'KRX', unified: 'KRX+NXT', nxt: 'NXT' }

/**
 * 호가 잔량과 예상체결가.
 * @param {{ code: string, market?: string, depth?: number }} input
 */
export async function getOrderbook({ code, market = 'krx', depth }) {
  if (!Object.hasOwn(MARKET_DIVS, market)) throw new Error('지원하지 않는 시장입니다')
  const levels = intInRange(depth, 5, 1, 10, 'depth')
  const ob = await inquireAskingPriceExpCcn(...kisCredentials(), requireCode(code), { marketDiv: MARKET_DIVS[market] })
  const bestAsk = ob.asks[0]?.price ?? null
  const bestBid = ob.bids[0]?.price ?? null
  return {
    code, ...meta({ currency: 'KRW', basis: BASIS[market] }),
    acceptedTime: ob.acceptedAt, sessionCode: ob.sessionCode, expectedSessionCode: ob.expectedSessionCode,
    price: ob.price, basePrice: ob.basePrice, open: ob.open, high: ob.high, low: ob.low,
    expected: ob.expected,
    bestAsk, bestBid, spread: bestAsk != null && bestBid != null ? bestAsk - bestBid : null,
    totalAskQty: ob.totalAskQty, totalBidQty: ob.totalBidQty,
    asks: ob.asks.slice(0, levels), bids: ob.bids.slice(0, levels), viCode: ob.viCode,
    note: '예상체결가(expected.price)는 동시호가(08:30~09:00, 15:20~15:30)와 장 종료 후에만 의미가 있습니다. 15:20~15:30 에는 당일 종가의 예상값으로 볼 수 있고, 실제 종가는 15:30 에 확정됩니다. 장중에는 null 이거나 현재가와 같을 수 있습니다. basePrice 는 기준가(전일 종가), 호가는 최우선부터의 순서입니다.',
  }
}

/** 휴장일 TR 은 "가급적 1일 1회" 권고라 기준일별로 하루 동안 Supabase 에 캐시한다 */
const HOLIDAY_CACHE_HOURS = 24
/** 한 번의 도구 호출에서 이어 부를 최대 횟수 (한 번에 3~4주치가 온다) */
const HOLIDAY_MAX_CALLS = 3

/** Supabase 캐시가 없거나 못 읽을 때를 위한 인스턴스 내 캐시 — key → { value, expiresAt } */
const holidayMemo = new Map()

async function fetchHolidaysCached(baseDate) {
  const creds = kisCredentials()
  const key = `kis-holiday:${creds[2]}:${baseDate}`
  const memo = holidayMemo.get(key)
  if (memo && memo.expiresAt > Date.now()) return memo.value
  // getCachedOrFetch 는 실패하면 fetcher 를 한 번 더 부른다 — 같은 시도를 돌려줘 KIS 를 두 번 치지 않게 한다
  let attempt = null
  const once = () => (attempt ??= inquireMarketHolidays(...creds, baseDate))
  const value = await getCachedOrFetch(key, once, HOLIDAY_CACHE_HOURS, (v) => Array.isArray(v) && v.length > 0)
  if (Array.isArray(value) && value.length > 0) holidayMemo.set(key, { value, expiresAt: Date.now() + HOLIDAY_CACHE_HOURS * 3_600_000 })
  return value
}

/**
 * 개장일·휴장일 달력.
 * @param {{ start_date?: string, days?: number }} input
 * @param {{ fetchHolidays?: (baseDate: string) => Promise<Array<{ date: string, marketOpen: boolean }>>, today?: string }} [deps]
 */
export async function getMarketCalendar({ start_date, days }, deps = {}) {
  if (start_date != null && !YMD.test(start_date)) throw new Error('start_date는 YYYYMMDD 형식이어야 합니다')
  const today = deps.today ?? seoulToday()
  const start = start_date ?? today
  const span = intInRange(days, 21, 1, 62, 'days')
  const end = addDays(start, span - 1)
  const fetchHolidays = deps.fetchHolidays ?? fetchHolidaysCached
  /** @type {Map<string, { date: string, marketOpen: boolean }>} */
  const byDate = new Map()
  let base = start
  let calls = 0
  while (calls < HOLIDAY_MAX_CALLS) {
    const rows = (await fetchHolidays(base)) ?? []
    calls += 1
    for (const r of rows) byDate.set(r.date, r)
    const last = rows.at(-1)?.date
    if (!last || last >= end || last < base) break
    base = addDays(last, 1)
  }
  const list = [...byDate.values()].filter((d) => d.date >= start && d.date <= end).sort((a, b) => a.date.localeCompare(b.date))
  const openDays = list.filter((d) => d.marketOpen).map((d) => d.date)
  const isWeekend = (ymd) => ['토', '일'].includes(weekdayOf(ymd))
  const holidays = list.filter((d) => !d.marketOpen && !isWeekend(d.date)).map((d) => ({ date: d.date, weekday: weekdayOf(d.date) }))
  // 조회 창이 내일 이후에서 시작하면 그 사이의 개장일을 모르므로 "다음 개장일"을 말하지 않는다
  const coversTomorrow = start <= addDays(today, 1)
  return {
    ...meta(), from: list[0]?.date ?? null, to: list.at(-1)?.date ?? null, requestedFrom: start, requestedDays: span, complete: list.length === span, calls,
    openDayCount: openDays.length, openDays, holidays,
    todayOpen: byDate.has(today) ? byDate.get(today).marketOpen : null,
    nextOpenDay: coversTomorrow ? openDays.find((d) => d > today) ?? null : null,
    note: 'openDays 는 주식시장이 열리는 날(KIS 개장일여부), holidays 는 평일인데 쉬는 날입니다. 주말은 목록에서 뺐습니다. KIS 권고에 따라 기준일별로 하루 동안 캐시하므로 당일 갑자기 바뀐 휴장은 늦게 반영될 수 있습니다. complete 가 false 면 요청한 기간 중 받지 못한 날이 있는 것이니 from·to 를 확인하세요. nextOpenDay 는 조회 기간이 내일을 포함할 때만 채웁니다.',
  }
}

/** 이름으로 고를 수 있는 대표 지수 — 그 밖의 업종은 4자리 업종코드를 직접 준다 */
const INDEX_CODES = { KOSPI: '0001', KOSDAQ: '1001', KOSPI200: '2001' }
const INDEX_RANGE_MAX = 1500
const INDEX_RANGE_FLOOR = '19900101'

/**
 * 지수(업종) 일봉.
 * @param {{ index?: string, limit?: number, start_date?: string, end_date?: string }} input
 */
export async function getIndexBars({ index = 'KOSPI', limit, start_date, end_date }) {
  const key = String(index).trim().toUpperCase()
  const indexCode = INDEX_CODES[key] ?? (/^\d{4}$/.test(key) ? key : null)
  if (!indexCode) throw new Error(`index 는 ${Object.keys(INDEX_CODES).join('·')} 또는 4자리 업종코드여야 합니다`)
  if (start_date != null && !YMD.test(start_date)) throw new Error('start_date는 YYYYMMDD 형식이어야 합니다')
  if (end_date != null && !YMD.test(end_date)) throw new Error('end_date는 YYYYMMDD 형식이어야 합니다')
  if (start_date != null && end_date != null && start_date > end_date) throw new Error('start_date가 end_date보다 늦습니다')
  const requested = intInRange(limit, start_date != null ? INDEX_RANGE_MAX : 60, 1, INDEX_RANGE_MAX, 'limit')
  const { name, bars, pages } = await inquireIndexDailyBarsRange(...kisCredentials(), indexCode, {
    start: start_date ?? INDEX_RANGE_FLOOR, end: end_date, maxBars: requested })
  return {
    index: INDEX_CODES[key] ? key : null, indexCode, name, ...meta({ basis: 'KRX' }),
    requested, count: bars.length, pages, fromDate: bars[0]?.date ?? null, latestDataDate: bars.at(-1)?.date ?? null,
    note: `지수 일봉이며 오래된 순입니다. 50건 단위로 ${pages}번 나눠 받았습니다. 지수는 포인트, volume 은 주, tradingValueKrw 는 원(KIS 의 천주·백만원 단위를 환산)입니다. 당일 봉은 미완성일 수 있습니다.`,
    bars,
  }
}

const median = (values) => {
  const v = [...values].sort((a, b) => a - b)
  const mid = Math.floor(v.length / 2)
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2
}

/**
 * 증권사 투자의견·목표가 이력과 증권사별 최신 목표가 요약.
 * @param {{ code: string, start_date?: string, end_date?: string, limit?: number }} input
 * @param {{ today?: string }} [deps]
 */
export async function getAnalystOpinions({ code, start_date, end_date, limit }, deps = {}) {
  if (start_date != null && !YMD.test(start_date)) throw new Error('start_date는 YYYYMMDD 형식이어야 합니다')
  if (end_date != null && !YMD.test(end_date)) throw new Error('end_date는 YYYYMMDD 형식이어야 합니다')
  const end = end_date ?? deps.today ?? seoulToday()
  const start = start_date ?? addDays(end, -180)
  if (start > end) throw new Error('start_date가 end_date보다 늦습니다')
  const requested = intInRange(limit, 100, 1, 300, 'limit')
  const { rows, pages } = await inquireInvestOpinions(...kisCredentials(), requireCode(code), { start, end, maxRows: requested })

  // rows 는 최신순 — 증권사별로 목표가가 있는 가장 최근 보고서와 그 직전 보고서를 잡는다
  /** @type {Map<string, { latest: any, previous: any }>} */
  const perBroker = new Map()
  for (const r of rows) {
    if (r.targetPrice == null || !r.broker) continue
    const cur = perBroker.get(r.broker)
    if (!cur) perBroker.set(r.broker, { latest: r, previous: null })
    else if (!cur.previous) cur.previous = r
  }
  const byBroker = [...perBroker.entries()].map(([broker, { latest, previous }]) => ({
    broker, date: latest.date, opinion: latest.opinion, targetPrice: latest.targetPrice,
    prevDate: previous?.date ?? null, prevTargetPrice: previous?.targetPrice ?? null,
    change: !previous ? null : latest.targetPrice > previous.targetPrice ? 'raised' : latest.targetPrice < previous.targetPrice ? 'lowered' : 'unchanged',
  }))
  const targets = byBroker.map((b) => b.targetPrice)
  const lastClose = rows.find((r) => r.prevClose != null)?.prevClose ?? null
  const mean = targets.length ? Math.round(targets.reduce((a, b) => a + b, 0) / targets.length) : null
  const summary = {
    brokers: targets.length,
    meanTargetPrice: mean,
    medianTargetPrice: targets.length ? Math.round(median(targets)) : null,
    highTargetPrice: targets.length ? Math.max(...targets) : null,
    lowTargetPrice: targets.length ? Math.min(...targets) : null,
    referenceClose: lastClose,
    upsidePctToMean: mean != null && lastClose ? Math.round((mean / lastClose - 1) * 1000) / 10 : null,
    raised: byBroker.filter((b) => b.change === 'raised').length,
    lowered: byBroker.filter((b) => b.change === 'lowered').length,
    unchanged: byBroker.filter((b) => b.change === 'unchanged').length,
  }
  return {
    code, ...meta({ currency: 'KRW' }), fromDate: start, toDate: end, requested, count: rows.length, pages,
    truncated: rows.length >= requested, summary, byBroker, rows,
    note: '증권사별 투자의견·목표가 이력(최신순)입니다. summary 는 조회 기간 안에서 증권사마다 가장 최근 목표가만 모아 계산했고, raised·lowered 는 같은 증권사의 직전 보고서와 비교한 것입니다(기간 안에 보고서가 2건 이상일 때만). referenceClose 는 가장 최근 보고서 기준 전일 종가라 현재가와 다를 수 있습니다. 실적 추정치(영업이익 컨센서스)는 이 도구에 없습니다.',
  }
}

/** 추정 손익(output2) 6행과 투자지표(output3) 8행의 뜻. scale 은 원자료에 곱하는 값 */
const ESTIMATE_INCOME_ROWS = [
  ['revenue', 1], ['revenueGrowthPct', 0.1], ['operatingProfit', 1], ['operatingProfitGrowthPct', 0.1], ['netIncome', 1], ['netIncomeGrowthPct', 0.1],
]
const ESTIMATE_INDICATOR_ROWS = [
  ['ebitda', 1], ['eps', 0.1], ['epsGrowthPct', 0.1], ['per', 0.1], ['evEbitda', 0.1], ['roePct', 0.1], ['debtRatioPct', 0.1], ['interestCoverage', 0.1],
]

/**
 * 한국투자증권 리서치의 종목 추정실적.
 * @param {{ code: string }} input
 */
export async function getEarningsEstimates({ code }) {
  const raw = await inquireEstimatePerform(...kisCredentials(), requireCode(code))
  const note = '한국투자증권 리서치가 매월 초 내는 추정치(약 160개 기업)이며 여러 증권사를 모은 시장 컨센서스가 아닙니다. 월중에 바뀐 의견은 반영되지 않을 수 있습니다. 결산기에 E 가 붙으면 추정, 없으면 실적입니다. 매출·영업이익·순이익·EBITDA 는 억원, EPS 는 원, 증감률·ROE·부채비율은 %, PER·EV/EBITDA·이자보상배율은 배입니다(원자료가 0.1 단위라 10으로 나눈 값).'
  // 빈 결산기 칸이 있어도 data1~5 열 번호가 밀리지 않게 원래 위치를 들고 간다
  const periods = (raw?.periods ?? []).map((period, column) => ({ period, column })).filter((p) => p.period)
  if (!periods.length || !(raw?.income ?? []).length) {
    return { code, ...meta(), covered: false, periods: [], note: `이 종목은 추정실적 대상이 아니거나 자료가 없습니다. ${note}` }
  }
  const cell = (row, i, scale) => {
    const v = numeric(row?.[`data${i + 1}`])
    if (v == null) return null
    return scale === 1 ? v : Math.round(v) / 10
  }
  const table = periods.map(({ period, column: i }) => ({
    period, estimate: /E$/i.test(period),
    ...Object.fromEntries(ESTIMATE_INCOME_ROWS.map(([name, scale], row) => [name, cell(raw.income[row], i, scale)])),
    ...Object.fromEntries(ESTIMATE_INDICATOR_ROWS.map(([name, scale], row) => [name, cell(raw.indicators?.[row], i, scale)])),
  }))
  const h = raw.header ?? {}
  const text = (v) => String(v ?? '').trim() || null
  return {
    code, ...meta(), covered: true, name: text(h.item_kor_nm), analyst: text(h.name1), estimateDate: text(h.estdate), recommendation: text(h.rcmd_name),
    units: { revenue: '억원', operatingProfit: '억원', netIncome: '억원', ebitda: '억원', eps: '원', growth: '%', per: '배' },
    periods: table, note,
  }
}

const oneOf = (value, fallback, allowed, name) => {
  const v = value ?? fallback
  if (!allowed.includes(v)) throw new Error(`${name}은 ${allowed.join(' · ')} 중 하나여야 합니다`)
  return v
}

/** KIS 시가총액 상위는 한 번에 30건이 끝이다 */
const MARKET_CAP_RANK_MAX = 30

/**
 * 시가총액 상위 종목 — 대형주 후보군을 만들 때 쓴다.
 * @param {{ market?: string, share_class?: string, limit?: number }} [input]
 */
export async function getMarketCapRanking({ market, share_class, limit } = {}) {
  const mk = oneOf(market == null ? market : String(market).toUpperCase(), 'ALL', ['ALL', 'KOSPI', 'KOSDAQ', 'KOSPI200'], 'market')
  const shareClass = oneOf(share_class, 'all', ['all', 'common', 'preferred'], 'share_class')
  const take = intInRange(limit, MARKET_CAP_RANK_MAX, 1, MARKET_CAP_RANK_MAX, 'limit')
  const all = await inquireMarketCapRank(...kisCredentials(), { market: mk, shareClass })
  const rows = all.slice(0, take)
  return {
    ...meta({ basis: 'KRX', currency: 'KRW' }), market: mk, shareClass, count: rows.length, maxRows: MARKET_CAP_RANK_MAX,
    note: '시가총액(marketCapKrw)은 원 단위이고 KRX 현재가 기준입니다. KIS 가 한 번에 30종목까지만 주므로 더 넓게 보려면 market 을 KOSPI·KOSDAQ 로 나눠 부르세요. 우선주를 빼려면 share_class=common 입니다.',
    rows,
  }
}

/**
 * 당일 장중 외국인·기관 순매수(순매도) 상위 — 증권사 가집계.
 * 기관만 따로 부르면 KIS 가 빈 목록을 주는 경우가 있어, 그때는 전체 목록을 기관 값으로 다시 정렬한다.
 * @param {{ investor?: string, side?: string, market?: string, sort?: string, limit?: number, detail?: boolean }} [input]
 */
export async function getFlowRanking({ investor, side, market, sort, limit, detail } = {}) {
  const inv = oneOf(investor, 'all', ['all', 'foreign', 'institution'], 'investor')
  const sd = oneOf(side, 'buy', ['buy', 'sell'], 'side')
  const mk = oneOf(market == null ? market : String(market).toUpperCase(), 'ALL', ['ALL', 'KOSPI', 'KOSDAQ'], 'market')
  const sortBy = oneOf(sort, 'amount', ['amount', 'shares'], 'sort')
  const take = intInRange(limit, 30, 1, 100, 'limit')
  const creds = kisCredentials()
  let list = await inquireForeignInstitutionRank(...creds, { market: mk, investor: inv, side: sd, sortBy })
  let resortedFromAll = false
  if (inv === 'institution' && list.length === 0) {
    const all = await inquireForeignInstitutionRank(...creds, { market: mk, investor: 'all', side: sd, sortBy })
    const key = sortBy === 'shares' ? 'institutionNetShares' : 'institutionNetAmountKrw'
    list = all
      .filter((r) => r[key] != null && (sd === 'sell' ? r[key] < 0 : r[key] > 0))
      .sort((a, b) => (sd === 'sell' ? a[key] - b[key] : b[key] - a[key]))
    resortedFromAll = true
  }
  const rows = list.slice(0, take).map(({ parts, ...core }, i) => ({
    rank: i + 1,
    ...core,
    sumNetAmountKrw: core.foreignNetAmountKrw == null && core.institutionNetAmountKrw == null
      ? null : (core.foreignNetAmountKrw ?? 0) + (core.institutionNetAmountKrw ?? 0),
    ...(detail ? { parts } : {}),
  }))
  return {
    ...meta({ basis: 'KRX', currency: 'KRW' }), estimated: true, market: mk, investor: inv, side: sd, sort: sortBy,
    count: rows.length, resortedFromAll,
    note: `증권사 직원이 장중에 집계·입력한 당일 가집계 누계입니다(외국인 09:30·11:20·13:20·14:30, 기관 10:00·11:20·13:20·14:30, ±10분). 확정 수급이 아니고 과거 날짜는 조회되지 않으며, 입력 전 시각에는 비어 있을 수 있습니다. 금액은 수량×현재가로 환산한 원 단위입니다. 확정치와 20일 누계는 종목별 get_investor_flow 로 확인하세요.${resortedFromAll ? ' 기관 단독 조회가 비어 있어 전체(외국인+기관) 상위 목록을 기관 값으로 다시 정렬했습니다 — 그 목록 밖의 종목은 빠져 있을 수 있습니다.' : ''}`,
    rows,
  }
}
