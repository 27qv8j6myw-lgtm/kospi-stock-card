/**
 * 월초 선정 기준과 매매 규칙을 과거 한 달에 적용해 보는 조회 — "대기 명단" 규칙 검증용.
 *
 * 종목마다 (1) 그 달 직전 거래일 종가 기준 선정 지표와 (2) 그 달에 규칙대로 샀을 때의 결과를 낸다.
 * 규칙: 첫 N거래일 안에 종가가 이틀 연속 하락한 날 그 종가에 매수 → 다음 날부터 목표가 도달 시 익절,
 * 종가가 손절선 아래면 다음 거래일 시가에 정리, 둘 다 아니면 월말 종가. 비교용으로 첫 거래일 종가 매수(day1)와
 * 매수 창 마지막 날 종가 매수(forced)도 같이 계산한다. 가격은 수정주가, 수급은 KRX 일별 확정치다.
 *
 * KIS 호출은 종목당 2번(일봉 1 + 과거 수급 1)이고 초당 한도를 넘지 않게 간격을 두고 보낸다.
 */
import { inquireDailyBarsRange, inquireInvestorTradeDailyRange, inquireIndexDailyBarsRange } from '../kisClient.mjs'
import { normalizeInvestorRows, isPendingFlowRow } from './marketHistory.mjs'
import { resolveKisEnv } from '../lib/kisEnv.mjs'

const MAX_CODES = 80
/** KIS 실전 한도(초당 20건)보다 낮게: 호출 시작 간격(ms) */
const KIS_CALL_GAP_MS = 80
/** 지표 계산에 필요한 직전 봉을 넉넉히 받기 위한 달력 일수 (20거래일 + 연휴) */
const LOOKBACK_DAYS = 50
/** 월말 손절이 다음 거래일 시가에 체결되므로 월말 뒤 봉도 조금 받는다 */
const LOOKAHEAD_DAYS = 10
const AMOUNT_UNIT_KRW = 100_000_000

const round = (v, digits = 2) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** digits) / 10 ** digits)
const pct = (ratio) => round(ratio * 100, 2)

/** 서울 기준 오늘 YYYYMMDD */
function seoulToday(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(now).replace(/-/g, '')
}

/** YYYYMMDD 에 달력 일수를 더한다 */
export function shiftYmd(ymd, days) {
  const d = new Date(Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(4, 6)) - 1, Number(ymd.slice(6, 8)) + days))
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

/** YYYYMM → 그 달의 첫날·마지막 날 */
export function monthRange(month) {
  if (!/^\d{6}$/.test(String(month ?? ''))) throw new Error('month 는 YYYYMM 형식이어야 합니다')
  const y = Number(month.slice(0, 4))
  const m = Number(month.slice(4, 6))
  if (m < 1 || m > 12 || y < 1990) throw new Error('month 는 YYYYMM 형식이어야 합니다')
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { first: `${month}01`, last: `${month}${String(lastDay).padStart(2, '0')}` }
}

/**
 * a 번째 봉 종가 기준 선정 지표. a 앞에 봉이 20개 이상 있어야 한다.
 * @param {Array<{ date: string, close: number }>} bars 날짜 오름차순
 * @param {number} a 기준 봉 인덱스
 */
export function selectionMetrics(bars, a) {
  if (a < 20) return null
  const closes = bars.slice(a - 20, a + 1).map((b) => b.close)
  const last20 = closes.slice(1)
  const ma20 = last20.reduce((s, v) => s + v, 0) / 20
  const rets = last20.map((c, i) => c / closes[i] - 1)
  const mean = rets.reduce((s, v) => s + v, 0) / rets.length
  const vol = Math.sqrt(rets.reduce((s, v) => s + (v - mean) ** 2, 0) / rets.length)
  return {
    date: bars[a].date,
    close: bars[a].close,
    gapPct: pct(bars[a].close / ma20 - 1),
    ret20Pct: pct(bars[a].close / closes[0] - 1),
    volPct: pct(vol),
    maxDayPct: pct(Math.max(...rets.map(Math.abs))),
  }
}

/**
 * e 번째 봉 종가에 산 뒤의 청산. 같은 날 목표가와 손절이 겹치면 목표가를 먼저 본다(장중 도달).
 * 손절은 종가로 판정하고 다음 거래일 시가에 판다 — 다음 봉이 없으면 그 종가.
 * @returns {{ x: 'TP'|'SL'|'ME'|'OPEN', xd: string, r: number }} r 은 수익률(%)
 */
export function runExit(bars, e, last, { tp, sl, complete }) {
  const entry = bars[e].close
  // 부동소수 오차(100 × 1.1 = 110.00000000000001)로 정확히 닿은 날을 놓치지 않게 아주 작은 여유를 둔다
  const eps = entry * 1e-9
  const target = entry * (1 + tp) - eps
  const stop = entry * (1 - sl) - eps
  for (let j = e + 1; j <= last; j += 1) {
    const b = bars[j]
    if (b.open >= target) return { x: 'TP', xd: b.date, r: pct(b.open / entry - 1) }
    if (b.high >= target) return { x: 'TP', xd: b.date, r: pct(tp) }
    if (b.close < stop) {
      const next = bars[j + 1]
      return next ? { x: 'SL', xd: next.date, r: pct(next.open / entry - 1) } : { x: 'SL', xd: b.date, r: pct(b.close / entry - 1) }
    }
  }
  return { x: complete ? 'ME' : 'OPEN', xd: bars[last].date, r: pct(bars[last].close / entry - 1) }
}

/**
 * 한 종목의 한 달 시뮬레이션.
 * @param {Array<{ date: string, open: number, high: number, low: number, close: number }>} bars 날짜 오름차순
 * @param {string} month YYYYMM
 * @param {{ window: number, tp: number, sl: number, complete: boolean }} opts tp·sl 은 비율(0.10)
 */
export function simulateMonth(bars, month, { window, tp, sl, complete }) {
  const idx = []
  bars.forEach((b, i) => { if (b.date.startsWith(month)) idx.push(i) })
  if (!idx.length) return null
  const i0 = idx[0]
  const last = idx.at(-1)
  const metrics = selectionMetrics(bars, i0 - 1)
  if (!metrics) return null
  const win = idx.slice(0, window)
  const trade = (e) => (e == null ? null
    : e < last ? { d: bars[e].date, p: bars[e].close, ...runExit(bars, e, last, { tp, sl, complete }) }
      : complete ? null : { d: bars[e].date, p: bars[e].close, x: 'OPEN', xd: bars[e].date, r: 0 })
  const dipIndex = win.find((i) => bars[i].close < bars[i - 1].close && bars[i - 1].close < bars[i - 2].close)
  // 매수 창이 아직 다 지나지 않은 달은 '마지막 날 매수'를 계산하지 않는다
  const windowDone = win.length === window || complete
  return {
    metrics,
    firstDay: bars[i0].date,
    lastDay: bars[last].date,
    windowDays: win.map((i) => bars[i].date),
    dip: trade(dipIndex),
    day1: trade(i0),
    forced: windowDone ? trade(win.at(-1)) : null,
  }
}

/**
 * 기준일까지의 외국인·기관 순매수 누계(억원). 값이 빈 날이 섞이면 그 합계는 null.
 * @param {ReturnType<typeof normalizeInvestorRows>} rows 최신순
 */
export function flowAsOf(rows, asOf) {
  const usable = rows.filter((r) => r.date <= asOf && !isPendingFlowRow(r))
  const sum = (n, who) => {
    const part = usable.slice(0, n)
    if (!part.length || part.some((r) => r[who].netAmountKrw == null)) return null
    return Math.round(part.reduce((s, r) => s + r[who].netAmountKrw, 0) / AMOUNT_UNIT_KRW)
  }
  return {
    days: Math.min(20, usable.length),
    lastDate: usable[0]?.date ?? null,
    fo20: sum(20, 'foreign'), in20: sum(20, 'institution'),
    fo5: sum(5, 'foreign'), in5: sum(5, 'institution'),
  }
}

/** 호출 시작 시각을 gapMs 간격으로 벌려 KIS 초당 한도를 넘지 않게 한다 */
function makeThrottle(gapMs) {
  let next = 0
  return async (fn) => {
    const now = Date.now()
    const at = Math.max(now, next)
    next = at + gapMs
    if (at > now) await new Promise((r) => setTimeout(r, at - now))
    return fn()
  }
}

function kisCredentials() {
  const clean = (v) => String(v ?? '').trim().replace(/^(["'])(.*)\1$/, '$2').trim()
  const key = clean(process.env.KIS_APP_KEY)
  const secret = clean(process.env.KIS_APP_SECRET)
  if (!key || !secret) throw new Error('KIS 인증정보가 설정되지 않았습니다')
  return [key, secret, resolveKisEnv()]
}

const toBars = (rows) => rows.map((r) => ({ date: r.ts, open: r.open, high: r.high, low: r.low, close: r.price }))

/**
 * @param {{ codes: string[], month: string, window?: number, take_profit_pct?: number, stop_loss_pct?: number, include?: 'passed'|'all' }} input
 * @param {{ fetchBars?: Function, fetchFlows?: Function, fetchIndex?: Function, today?: string, gapMs?: number }} [deps] 테스트용 주입
 */
export async function getRuleBacktest({ codes, month, window, take_profit_pct, stop_loss_pct, include } = {}, deps = {}) {
  if (!Array.isArray(codes) || !codes.length) throw new Error('codes 에 6자리 종목코드를 1개 이상 넣어 주세요')
  const list = [...new Set(codes.map((c) => String(c)))]
  if (list.length > MAX_CODES) throw new Error(`codes 는 최대 ${MAX_CODES}개입니다`)
  if (list.some((c) => !/^\d{6}$/.test(c))) throw new Error('codes 는 6자리 종목코드여야 합니다')
  const { first, last } = monthRange(month)
  const win = window ?? 5
  if (!Number.isInteger(win) || win < 1 || win > 10) throw new Error('window 는 1~10 정수여야 합니다')
  const tpPct = take_profit_pct ?? 10
  const slPct = stop_loss_pct ?? 15
  if (!(tpPct > 0 && tpPct <= 100)) throw new Error('take_profit_pct 는 0 초과 100 이하여야 합니다')
  if (!(slPct > 0 && slPct < 100)) throw new Error('stop_loss_pct 는 0 초과 100 미만이어야 합니다')
  const mode = include ?? 'passed'
  if (mode !== 'passed' && mode !== 'all') throw new Error('include 는 passed · all 중 하나여야 합니다')
  const today = deps.today ?? seoulToday()
  if (first > today) throw new Error('아직 시작하지 않은 달입니다')

  const needsKis = !(deps.fetchBars && deps.fetchFlows && deps.fetchIndex)
  const [key, secret, env] = needsKis ? kisCredentials() : ['', '', 'prod']
  if (needsKis && env !== 'prod') {
    const err = new Error('규칙 시뮬레이션: 과거 수급 조회가 KIS 실전 계정 전용입니다 (서버의 KIS_ENV 가 prod 가 아닙니다)')
    err.code = 'PROD_ONLY'
    throw err
  }
  const start = shiftYmd(first, -LOOKBACK_DAYS)
  const afterEnd = shiftYmd(last, LOOKAHEAD_DAYS)
  const end = afterEnd < today ? afterEnd : today
  const flowEnd = shiftYmd(first, -1)
  const flowStart = shiftYmd(flowEnd, -LOOKBACK_DAYS)
  const complete = last < today
  const fetchBars = deps.fetchBars ?? ((code) => inquireDailyBarsRange(key, secret, env, code, { start, end, adjusted: true, maxBars: 100 }))
  const fetchFlows = deps.fetchFlows ?? ((code) => inquireInvestorTradeDailyRange(key, secret, env, code, { start: flowStart, end: flowEnd, maxDays: 30 }))
  const fetchIndex = deps.fetchIndex ?? (() => inquireIndexDailyBarsRange(key, secret, env, '0001', { start, end, maxBars: 100 }))
  const throttle = makeThrottle(deps.gapMs ?? KIS_CALL_GAP_MS)
  const opts = { window: win, tp: tpPct / 100, sl: slPct / 100, complete }

  const indexJob = throttle(fetchIndex).then((r) => r.bars ?? [], () => [])
  const errors = []
  const message = (e) => (e instanceof Error ? e.message : String(e))
  const jobs = list.map(async (code) => {
    // 둘 중 하나가 실패해도 나머지 약속이 처리되지 않은 거부로 남지 않게 allSettled 로 받는다
    const [barRes, flowRes] = await Promise.allSettled([throttle(() => fetchBars(code)), throttle(() => fetchFlows(code))])
    if (barRes.status === 'rejected') {
      errors.push({ code, stage: 'bars', message: message(barRes.reason) })
      return { code, sim: null, failed: true }
    }
    const sim = simulateMonth(toBars(barRes.value.bars ?? []), month, opts)
    if (!sim) return { code, sim: null }
    // 수급만 실패하면 가격 지표와 시뮬레이션은 남기고 수급은 비운다 (pass 는 false)
    if (flowRes.status === 'rejected') errors.push({ code, stage: 'flows', message: message(flowRes.reason) })
    const flow = flowAsOf(flowRes.status === 'fulfilled' ? normalizeInvestorRows(flowRes.value.rows ?? []) : [], sim.metrics.date)
    return { code, sim, flow }
  })
  const [indexBars, results] = await Promise.all([indexJob, Promise.all(jobs)])

  // 기준 달력은 지수 봉으로 잡는다 (거래정지 종목이 달력을 흐리지 않게)
  const idxSim = simulateMonth(indexBars.filter((b) => b.close != null).map((b) => ({ ...b, open: b.open ?? b.close, high: b.high ?? b.close })), month, opts)
  const ref = idxSim ?? results.find((r) => r.sim)?.sim ?? null
  const benchmark = idxSim ? {
    index: 'KOSPI', ret20Pct: idxSim.metrics.ret20Pct, ma20GapPct: idxSim.metrics.gapPct,
    monthRetPct: pct(indexBars.find((b) => b.date === idxSim.lastDay).close / idxSim.metrics.close - 1),
  } : null

  const closes = {}
  const rows = []
  let aboveMa20 = 0
  let flowAvailable = 0
  let passed = 0
  const noData = []
  for (const { code, sim, flow, failed } of results) {
    if (!sim) { if (!failed) noData.push(code); continue }
    const m = sim.metrics
    closes[code] = m.close
    const flowSum = flow.fo20 == null || flow.in20 == null ? null : flow.fo20 + flow.in20
    const above = m.gapPct > 0
    const pass = above && flowSum != null && flowSum > 0
    if (above) aboveMa20 += 1
    if (flowSum != null) flowAvailable += 1
    if (pass) passed += 1
    if (mode === 'passed' && !pass) continue
    rows.push({
      code, close: m.close, gapPct: m.gapPct, ret20Pct: m.ret20Pct, volPct: m.volPct, maxDayPct: m.maxDayPct,
      fo20: flow.fo20, in20: flow.in20, fo5: flow.fo5, in5: flow.in5, flowDays: flow.days,
      pass, lead: benchmark ? m.ret20Pct > benchmark.ret20Pct : null,
      ...(ref && m.date !== ref.metrics.date ? { asOf: m.date } : {}),
      dip: sim.dip, day1: sim.day1, forced: sim.forced,
    })
  }
  return {
    retrievedAt: new Date().toISOString(), timezone: 'Asia/Seoul', source: 'KIS', basis: 'KRX', adjusted: true,
    month, asOf: ref?.metrics.date ?? null, firstDay: ref?.firstDay ?? null, lastDay: ref?.lastDay ?? null,
    windowDays: ref?.windowDays ?? [], complete,
    params: { window: win, takeProfitPct: tpPct, stopLossPct: slPct, include: mode },
    benchmark,
    universe: { requested: list.length, withData: results.filter((r) => r.sim).length, aboveMa20, flowAvailable, passed, noData, errors: errors.slice(0, 10), errorCount: errors.length },
    units: { price: '원(수정주가)', flow: '억원', pct: '%' },
    note: 'asOf 는 그 달 직전 거래일이고 선정 지표(gapPct=20일선 대비, ret20Pct=20일 등락, volPct=20일 일간 변동성, maxDayPct=20일 중 하루 최대 변동, fo/in=외국인/기관 순매수 20일·5일 누계)는 그 날 종가 기준입니다. pass 는 20일선 위이면서 외국인+기관 20일 합계가 플러스, lead 는 20일 등락이 KOSPI 보다 높은지입니다. dip 은 규칙대로(첫 N거래일 안 이틀 연속 하락한 날 종가 매수), day1 은 첫 거래일 종가 매수, forced 는 매수 창 마지막 날 종가 매수입니다. 각 값은 d=매수일, p=매수가, x=청산 사유(TP 익절·SL 손절·ME 월말·OPEN 진행 중), xd=청산일, r=수익률(%)이고 비용은 빼지 않았습니다. dip 이 null 이면 그 달은 매수 조건이 안 걸린 것입니다. closes 는 기준일 종가(전 종목)로, 현재 상장주식수를 곱하면 당시 시가총액의 근사값이 됩니다(증자·감자는 반영 안 됨). 수급이 없는 과거 구간은 fo/in 이 null 이고 pass 가 false 입니다.',
    closes,
    rows,
  }
}
