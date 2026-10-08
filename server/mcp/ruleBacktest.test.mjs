import { describe, it, expect, vi } from 'vitest'
vi.mock('../kisClient.mjs', () => ({ inquireDailyBarsRange: vi.fn(), inquireInvestorTradeDailyRange: vi.fn(), inquireIndexDailyBarsRange: vi.fn() }))
import { monthRange, shiftYmd, selectionMetrics, runExit, simulateMonth, flowAsOf, getRuleBacktest } from './ruleBacktest.mjs'

/** 평일만 이어 붙인 봉. closes 로 종가를 주고 시가=전일 종가, 고가·저가는 종가·시가 범위 */
function makeBars(startYmd, closes, overrides = {}) {
  const bars = []
  let d = new Date(Date.UTC(+startYmd.slice(0, 4), +startYmd.slice(4, 6) - 1, +startYmd.slice(6, 8)))
  let prev = closes[0]
  for (const close of closes) {
    while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1)
    const date = d.toISOString().slice(0, 10).replace(/-/g, '')
    const bar = { date, open: prev, high: Math.max(prev, close), low: Math.min(prev, close), close, ...(overrides[date] ?? {}) }
    bars.push(bar); prev = close
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return bars
}
const flat = (n, v = 100) => Array.from({ length: n }, () => v)
const OPTS = { window: 5, tp: 0.10, sl: 0.15, complete: true }

describe('rule backtest helpers', () => {
  it('finds month bounds and shifts dates across months', () => {
    expect(monthRange('202602')).toEqual({ first: '20260201', last: '20260228' })
    expect(monthRange('202412')).toEqual({ first: '20241201', last: '20241231' })
    expect(() => monthRange('202613')).toThrow('YYYYMM')
    expect(shiftYmd('20260301', -1)).toBe('20260228'); expect(shiftYmd('20261231', 10)).toBe('20270110')
  })
  it('computes selection metrics on the as-of close', () => {
    const closes = [...flat(20, 100), 110]
    const m = selectionMetrics(makeBars('20260101', closes), 20)
    expect(m.close).toBe(110); expect(m.ret20Pct).toBe(10); expect(m.gapPct).toBe(9.45); expect(m.maxDayPct).toBe(10)
    expect(selectionMetrics(makeBars('20260101', closes), 19)).toBeNull()
  })
  it('takes profit on an intraday touch, at the open on a gap, and before a same-day stop', () => {
    const bars = [{ date: 'a', open: 100, high: 100, low: 100, close: 100 }, { date: 'b', open: 101, high: 110, low: 80, close: 80 }, { date: 'c', open: 70, high: 70, low: 70, close: 70 }]
    expect(runExit(bars, 0, 2, OPTS)).toEqual({ x: 'TP', xd: 'b', r: 10 })
    bars[1] = { date: 'b', open: 113, high: 115, low: 111, close: 112 }
    expect(runExit(bars, 0, 2, OPTS)).toEqual({ x: 'TP', xd: 'b', r: 13 })
  })
  it('stops on a close below the line and sells at the next open, else marks month end', () => {
    const bars = [{ date: 'a', open: 100, high: 100, low: 100, close: 100 }, { date: 'b', open: 99, high: 99, low: 80, close: 84 }, { date: 'c', open: 78, high: 90, low: 78, close: 88 }]
    expect(runExit(bars, 0, 1, OPTS)).toEqual({ x: 'SL', xd: 'c', r: -22 })
    expect(runExit(bars.slice(0, 2), 0, 1, OPTS)).toEqual({ x: 'SL', xd: 'b', r: -16 })
    bars[1].close = 86 // 장중 80 까지 밀려도 종가가 선 위면 손절 아님
    expect(runExit(bars, 0, 1, OPTS)).toEqual({ x: 'ME', xd: 'b', r: -14 })
    expect(runExit(bars, 0, 1, { ...OPTS, complete: false }).x).toBe('OPEN')
  })
  it('buys on the first two-day decline inside the window, counting days before the month', () => {
    // 2026-08-03(월)부터 평일 21개 = 8/31 까지, 9월은 9/1 부터
    const aug = [...flat(19, 100), 99, 98]            // 8/28·8/31 연속 하락은 9월 이전이라 매수 아님
    const sep = [97, 99, 98, 97, 96, 104, 108, 107, 107, 107, 107, 107, 107, 107, 107, 107, 107, 107, 107, 107, 107, 107]
    const bars = makeBars('20260803', [...aug, ...sep, 106, 105])
    const sim = simulateMonth(bars, '202609', OPTS)
    expect(sim.metrics.date).toBe('20260831'); expect(sim.firstDay).toBe('20260901'); expect(sim.windowDays).toHaveLength(5)
    // 9/1: 97 < 98 < 99 → 직전 달 이틀을 포함해 조건 충족, 9/1 종가 매수
    expect(sim.dip).toMatchObject({ d: '20260901', p: 97, x: 'TP', xd: '20260909', r: 10 })
    expect(sim.day1.d).toBe('20260901'); expect(sim.forced).toMatchObject({ d: '20260907', p: 96 })
  })
  it('returns no dip trade when the window has no two-day decline and skips months without history', () => {
    const bars = makeBars('20260803', [...flat(21, 100), 101, 100, 101, 100, 101, 99, 98, ...flat(15, 98)])
    const sim = simulateMonth(bars, '202609', OPTS)
    expect(sim.dip).toBeNull()                         // 6·7번째 날의 연속 하락은 창(5일) 밖
    expect(sim.forced.d).toBe(sim.windowDays[4])
    expect(simulateMonth(bars, '202608', OPTS)).toBeNull()
    expect(simulateMonth(bars, '202611', OPTS)).toBeNull()
  })
  it('sums flows as of the date in 억원 and refuses to paper over blanks', () => {
    const row = (date, f, i) => ({ date, foreign: { netShares: 1, netAmountKrw: f }, institution: { netShares: 1, netAmountKrw: i }, individual: { netShares: 1, netAmountKrw: 0 } })
    const rows = [row('20260902', 9e11, 9e11), ...Array.from({ length: 22 }, (_, k) => row(String(20260831 - k), 1e9, -2e9))]
    const f = flowAsOf(rows, '20260831')
    expect(f).toMatchObject({ days: 20, lastDate: '20260831', fo20: 200, in20: -400, fo5: 50, in5: -100 })
    rows[3].institution.netAmountKrw = null
    expect(flowAsOf(rows, '20260831')).toMatchObject({ fo20: 200, in20: null, in5: null })
    expect(flowAsOf([], '20260831')).toMatchObject({ days: 0, fo20: null })
  })
})

describe('getRuleBacktest', () => {
  const aug = [...flat(19, 100), 101, 104]
  const sep = [103, 102, 104, 108, 113, ...flat(17, 113)]
  const bars = makeBars('20260803', [...aug, ...sep, 113, 113]).map((b) => ({ ts: b.date, open: b.open, high: b.high, low: b.low, price: b.close }))
  const flowRows = (f, i) => Array.from({ length: 21 }, (_, k) => ({ stck_bsop_date: String(20260831 - k), frgn_ntby_qty: '1', frgn_ntby_tr_pbmn: String(f), orgn_ntby_qty: '1', orgn_ntby_tr_pbmn: String(i), prsn_ntby_qty: '0', prsn_ntby_tr_pbmn: '0' }))
  const deps = (over = {}) => ({
    today: '20261008', gapMs: 0,
    fetchBars: vi.fn(async (code) => { if (code === '000003') throw new Error('KIS 오류'); return { bars: code === '000004' ? [] : bars } }),
    fetchFlows: vi.fn(async (code) => { if (code === '000005') throw new Error('수급 오류'); return { rows: code === '000002' ? flowRows(-300, 100) : flowRows(100, 50) } }),
    fetchIndex: vi.fn(async () => ({ bars: bars.map((b) => ({ date: b.ts, open: b.open, high: b.high, low: b.low, close: b.price })) })),
    ...over,
  })
  it('returns only stocks that pass, with counts for the rest', async () => {
    const out = await getRuleBacktest({ codes: ['000001', '000002', '000003', '000004', '000001'], month: '202609' }, deps())
    expect(out).toMatchObject({ month: '202609', asOf: '20260831', firstDay: '20260901', complete: true, params: { window: 5, takeProfitPct: 10, stopLossPct: 15, include: 'passed' } })
    expect(out.universe).toMatchObject({ requested: 4, withData: 2, aboveMa20: 2, flowAvailable: 2, passed: 1, noData: ['000004'], errorCount: 1 })
    expect(out.rows).toHaveLength(1)
    expect(out.rows[0]).toMatchObject({ code: '000001', close: 104, fo20: 20, in20: 10, fo5: 5, in5: 3, flowDays: 20, pass: true, lead: false })
    expect(out.rows[0].dip).toMatchObject({ d: '20260902', p: 102, x: 'TP', r: 10 })
    expect(out.closes).toEqual({ '000001': 104, '000002': 104 })
    expect(out.benchmark).toMatchObject({ index: 'KOSPI', ret20Pct: 4 })
  })
  it('includes failing stocks when asked and validates input', async () => {
    const out = await getRuleBacktest({ codes: ['000001', '000002'], month: '202609', include: 'all', window: 2, take_profit_pct: 5, stop_loss_pct: 10 }, deps())
    expect(out.rows.map((r) => [r.code, r.pass])).toEqual([['000001', true], ['000002', false]])
    expect(out.rows[0].dip).toMatchObject({ d: '20260902', x: 'TP', r: 5 }); expect(out.windowDays).toHaveLength(2)
    // 수급 조회만 실패하면 가격 지표와 시뮬레이션은 남고 수급은 비어 통과하지 못한다
    const soft = await getRuleBacktest({ codes: ['000005'], month: '202609', include: 'all' }, deps())
    expect(soft.rows[0]).toMatchObject({ code: '000005', fo20: null, in20: null, flowDays: 0, pass: false }); expect(soft.rows[0].dip.x).toBe('TP')
    expect(soft.universe).toMatchObject({ withData: 1, flowAvailable: 0, errorCount: 1 }); expect(soft.universe.errors[0]).toMatchObject({ code: '000005', stage: 'flows' })
    await expect(getRuleBacktest({ codes: [], month: '202609' }, deps())).rejects.toThrow('codes')
    await expect(getRuleBacktest({ codes: ['12345'], month: '202609' }, deps())).rejects.toThrow('6자리')
    await expect(getRuleBacktest({ codes: ['000001'], month: '202611' }, deps())).rejects.toThrow('시작하지 않은')
    await expect(getRuleBacktest({ codes: ['000001'], month: '202609', window: 11 }, deps())).rejects.toThrow('window')
    await expect(getRuleBacktest({ codes: Array.from({ length: 81 }, (_, i) => String(100000 + i)), month: '202609' }, deps())).rejects.toThrow('최대 80')
  })
  it('marks an unfinished month as in progress and skips the forced entry until the window closes', async () => {
    const partial = bars.filter((b) => b.ts <= '20260903')
    const out = await getRuleBacktest({ codes: ['000001'], month: '202609' }, deps({ today: '20260903', fetchBars: vi.fn(async () => ({ bars: partial })), fetchIndex: vi.fn(async () => ({ bars: [] })) }))
    expect(out.complete).toBe(false); expect(out.benchmark).toBeNull(); expect(out.rows[0].lead).toBeNull()
    expect(out.rows[0].dip).toMatchObject({ d: '20260902', x: 'OPEN' }); expect(out.rows[0].forced).toBeNull()
  })
})
