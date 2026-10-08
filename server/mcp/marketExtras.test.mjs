import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('../kisClient.mjs', () => ({
  inquireInvestorTrendEstimate: vi.fn(), inquireAskingPriceExpCcn: vi.fn(), inquireMarketHolidays: vi.fn(),
  inquireIndexDailyBarsRange: vi.fn(), inquireInvestOpinions: vi.fn(), inquireEstimatePerform: vi.fn(),
  inquireMarketCapRank: vi.fn(), inquireForeignInstitutionRank: vi.fn(),
}))
vi.mock('../lib/cacheHelper.mjs', () => ({ getCachedOrFetch: vi.fn(async (_key, fetcher) => fetcher()) }))
import { inquireInvestorTrendEstimate, inquireAskingPriceExpCcn, inquireMarketHolidays, inquireIndexDailyBarsRange, inquireInvestOpinions, inquireEstimatePerform, inquireMarketCapRank, inquireForeignInstitutionRank } from '../kisClient.mjs'
import { getCachedOrFetch } from '../lib/cacheHelper.mjs'
import { getFlowEstimate, getOrderbook, getMarketCalendar, getIndexBars, getAnalystOpinions, getEarningsEstimates, getMarketCapRanking, getFlowRanking, addDays } from './marketExtras.mjs'

beforeEach(() => { vi.clearAllMocks(); process.env.KIS_APP_KEY = 'k'; process.env.KIS_APP_SECRET = 's'; process.env.KIS_ENV = 'prod' })

describe('MCP market extras', () => {
  it('reports intraday flow estimates by input time and picks the latest entered slot', async () => {
    inquireInvestorTrendEstimate.mockResolvedValue([
      { slot: '1', hhmm: '0930', foreignNetShares: -23000, institutionNetShares: 0, sumNetShares: -23000 },
      { slot: '2', hhmm: '1000', foreignNetShares: -38000, institutionNetShares: 22000, sumNetShares: -16000 },
      { slot: '3', hhmm: '1120', foreignNetShares: 0, institutionNetShares: 0, sumNetShares: 0 },
    ])
    const out = await getFlowEstimate({ code: '000660' })
    expect(inquireInvestorTrendEstimate.mock.calls[0]).toEqual(['k', 's', 'prod', '000660'])
    expect(out.estimated).toBe(true); expect(out.slots.map((s) => s.time)).toEqual(['09:30', '10:00', '11:20'])
    expect(out.latest).toEqual({ time: '10:00', foreignNetShares: -38000, institutionNetShares: 22000, sumNetShares: -16000 })
    await expect(getFlowEstimate({ code: 'bad' })).rejects.toThrow('6자리')
  })
  it('trims the order book to the requested depth and exposes the expected price', async () => {
    const level = (p, q) => ({ price: p, qty: q })
    inquireAskingPriceExpCcn.mockResolvedValue({
      marketDiv: 'J', acceptedAt: '152500', sessionCode: '00', expectedSessionCode: '112',
      asks: [level(128000, 10), level(128500, 20), level(129000, 30)], bids: [level(127500, 5), level(127000, 6)],
      totalAskQty: 830005, totalBidQty: 250849, price: 128000, open: 125500, high: 128500, low: 124500, basePrice: 124500,
      expected: { price: 127500, change: 3000, changePct: 2.41, volume: 220006 }, viCode: 'N' })
    const out = await getOrderbook({ code: '000660', depth: 2 })
    expect(inquireAskingPriceExpCcn.mock.calls[0][4]).toEqual({ marketDiv: 'J' })
    expect(out.basis).toBe('KRX'); expect(out.asks).toHaveLength(2); expect(out.bestAsk).toBe(128000); expect(out.bestBid).toBe(127500); expect(out.spread).toBe(500)
    expect(out.expected.price).toBe(127500); expect(out.acceptedTime).toBe('152500')
    await getOrderbook({ code: '000660', market: 'unified' })
    expect(inquireAskingPriceExpCcn.mock.calls[1][4]).toEqual({ marketDiv: 'UN' })
    await expect(getOrderbook({ code: '000660', depth: 11 })).rejects.toThrow('depth')
    await expect(getOrderbook({ code: '000660', market: 'nyse' })).rejects.toThrow()
  })
  it('builds a trading calendar across follow-up calls and separates weekday holidays from weekends', async () => {
    const day = (date, open) => ({ date, marketOpen: open })
    const fetchHolidays = vi.fn(async (base) => base === '20261006'
      ? [day('20261006', true), day('20261007', true), day('20261008', true), day('20261009', false), day('20261010', false), day('20261011', false), day('20261012', true)]
      : [day('20261013', true), day('20261014', true)])
    const out = await getMarketCalendar({ start_date: '20261006', days: 8 }, { fetchHolidays, today: '20261007' })
    expect(fetchHolidays.mock.calls.map((c) => c[0])).toEqual(['20261006', '20261013'])
    expect(out).toMatchObject({ from: '20261006', to: '20261013', complete: true, calls: 2, openDayCount: 5, todayOpen: true, nextOpenDay: '20261008' })
    expect(out.openDays).toEqual(['20261006', '20261007', '20261008', '20261012', '20261013'])
    expect(out.holidays).toEqual([{ date: '20261009', weekday: '금' }])
    expect(addDays('20261231', 1)).toBe('20270101'); expect(addDays('20260301', -1)).toBe('20260228')
  })
  it('caches the holiday call per base date for a day and stops when KIS returns nothing new', async () => {
    inquireMarketHolidays.mockResolvedValue([{ date: '20261007', marketOpen: true }, { date: '20261008', marketOpen: true }])
    const out = await getMarketCalendar({ start_date: '20261007', days: 30 }, { today: '20261007' })
    expect(getCachedOrFetch.mock.calls[0][0]).toBe('kis-holiday:prod:20261007'); expect(getCachedOrFetch.mock.calls[0][2]).toBe(24)
    expect(getCachedOrFetch.mock.calls[0][3]([])).toBe(false); expect(getCachedOrFetch.mock.calls[0][3]([{}])).toBe(true)
    expect(inquireMarketHolidays.mock.calls.map((c) => c[3])).toEqual(['20261007', '20261009'])
    expect(out.complete).toBe(false); expect(out.to).toBe('20261008'); expect(out.calls).toBe(2)
    await expect(getMarketCalendar({ days: 63 })).rejects.toThrow('days')
  })
  it('resolves index names and passes the bar cap through', async () => {
    inquireIndexDailyBarsRange.mockResolvedValue({ name: '종합', pages: 2, bars: [
      { date: '20261006', open: 6900.1, high: 6950.2, low: 6880.3, close: 6941.39, volume: 500000000, tradingValueKrw: 2.1e13 },
      { date: '20261007', open: 6911.35, high: 6920, low: 6810, close: 6818.54, volume: 600000000, tradingValueKrw: 2.5e13 }] })
    const out = await getIndexBars({})
    expect(inquireIndexDailyBarsRange.mock.calls[0].slice(3)).toEqual(['0001', { start: '19900101', end: undefined, maxBars: 60 }])
    expect(out).toMatchObject({ index: 'KOSPI', indexCode: '0001', name: '종합', count: 2, fromDate: '20261006', latestDataDate: '20261007' })
    await getIndexBars({ index: 'kospi200', start_date: '20250101' })
    expect(inquireIndexDailyBarsRange.mock.calls[1].slice(3)).toEqual(['2001', { start: '20250101', end: undefined, maxBars: 1500 }])
    const sector = await getIndexBars({ index: '0013', limit: 10 })
    expect(sector.index).toBeNull(); expect(sector.indexCode).toBe('0013')
    await expect(getIndexBars({ index: 'NASDAQ' })).rejects.toThrow('index')
    await expect(getIndexBars({ start_date: '20260201', end_date: '20260101' })).rejects.toThrow()
  })
  it('summarises the latest target price per broker and counts raises and cuts', async () => {
    const row = (date, broker, targetPrice, prevClose = 1600000) => ({ date, broker, opinion: '매수', prevOpinion: '매수', targetPrice, prevClose })
    inquireInvestOpinions.mockResolvedValue({ pages: 1, rows: [
      row('20261005', 'KB', 2000000, 1581000), row('20260928', '미래에셋', 1800000), row('20260918', 'KB', 1700000),
      row('20260910', '미래에셋', 1900000), row('20260901', 'NH', 1600000), row('20260820', 'NH', 1600000), row('20260801', '하나', null)] })
    const out = await getAnalystOpinions({ code: '009150', end_date: '20261007' })
    expect(inquireInvestOpinions.mock.calls[0][4]).toEqual({ start: '20260410', end: '20261007', maxRows: 100 })
    expect(out.summary).toEqual({ brokers: 3, meanTargetPrice: 1800000, medianTargetPrice: 1800000, highTargetPrice: 2000000, lowTargetPrice: 1600000,
      referenceClose: 1581000, upsidePctToMean: 13.9, raised: 1, lowered: 1, unchanged: 1 })
    expect(out.byBroker[0]).toEqual({ broker: 'KB', date: '20261005', opinion: '매수', targetPrice: 2000000, prevDate: '20260918', prevTargetPrice: 1700000, change: 'raised' })
    expect(out.count).toBe(7); expect(out.truncated).toBe(false)
    inquireInvestOpinions.mockResolvedValue({ pages: 1, rows: [] })
    const empty = await getAnalystOpinions({ code: '009150' }, { today: '20261007' })
    expect(empty.summary.brokers).toBe(0); expect(empty.summary.meanTargetPrice).toBeNull(); expect(empty.summary.upsidePctToMean).toBeNull()
  })
  it('reads the KIS estimate table with the units of the documented Samsung example', async () => {
    const r = (...v) => Object.fromEntries(v.map((x, i) => [`data${i + 1}`, x]))
    inquireEstimatePerform.mockResolvedValue({
      header: { sht_cd: 'A005930', item_kor_nm: '삼성전자', name1: '김한국', name2: '', estdate: '20240109', rcmd_name: '매수', capital: '8975.0' },
      income: [r('2796048.0', '3022314.0', '2581509.0', '3048945.0', '3295675.0'), r('181.0', '81.0', '-146.0', '181.0', '81.0'),
        r('516339.0', '433766.0', '65405.0', '330172.0', '555410.0'), r('435.0', '-160.0', '-849.0', '4048.0', '682.0'),
        r('392438.0', '547300.0', '106144.0', '253332.0', '422055.0'), r('504.0', '395.0', '-806.0', '1387.0', '666.0')],
      indicators: [r('858812.0', '824843.0', '483199.0', '792602.0', '1043367.0'), r('57770.0', '80570.0', '15609.0', '36983.0', '61483.0'),
        r('504.0', '395.0', '-806.0', '1369.0', '662.0'), r('136.0', '69.0', '503.0', '207.0', '124.0'), r('50.0', '34.0', '95.0', '53.0', '39.0'),
        r('139.0', '171.0', '31.0', '70.0', '109.0'), r('399.0', '264.0', '255.0', '226.0', '163.0'), r('1197.0', '568.0', '58.0', '232.0', '655.0')],
      periods: ['2021.12', '2022.12', '2023.12E', '2024.12E', '2025.12E'] })
    const out = await getEarningsEstimates({ code: '005930' })
    expect(out).toMatchObject({ covered: true, name: '삼성전자', analyst: '김한국', estimateDate: '20240109', recommendation: '매수' })
    expect(out.periods[0]).toEqual({ period: '2021.12', estimate: false, revenue: 2796048, revenueGrowthPct: 18.1, operatingProfit: 516339, operatingProfitGrowthPct: 43.5,
      netIncome: 392438, netIncomeGrowthPct: 50.4, ebitda: 858812, eps: 5777, epsGrowthPct: 50.4, per: 13.6, evEbitda: 5, roePct: 13.9, debtRatioPct: 39.9, interestCoverage: 119.7 })
    expect(out.periods[2]).toMatchObject({ period: '2023.12E', estimate: true, operatingProfit: 65405, operatingProfitGrowthPct: -84.9, eps: 1560.9 })
    inquireEstimatePerform.mockResolvedValue({ header: null, income: [], indicators: [], periods: [] })
    const none = await getEarningsEstimates({ code: '009150' })
    expect(none.covered).toBe(false); expect(none.note).toContain('대상이 아니거나')
  })
  it('does not guess the next open day for a later window and reports gaps at the start', async () => {
    const day = (date, open = true) => ({ date, marketOpen: open })
    const later = await getMarketCalendar({ start_date: '20261201', days: 3 }, { today: '20261007', fetchHolidays: async () => [day('20261201'), day('20261202'), day('20261203')] })
    expect(later.nextOpenDay).toBeNull(); expect(later.todayOpen).toBeNull(); expect(later.complete).toBe(true); expect(later.openDayCount).toBe(3)
    const tomorrow = await getMarketCalendar({ start_date: '20261008', days: 2 }, { today: '20261007', fetchHolidays: async () => [day('20261008'), day('20261009', false)] })
    expect(tomorrow.nextOpenDay).toBe('20261008')
    const gap = await getMarketCalendar({ start_date: '20261005', days: 4 }, { today: '20261007', fetchHolidays: async () => [day('20261007'), day('20261008')] })
    expect(gap).toMatchObject({ requestedFrom: '20261005', from: '20261007', to: '20261008', complete: false })
  })
  it('keeps estimate columns aligned when a period label is blank', async () => {
    const r = (...v) => Object.fromEntries(v.map((x, i) => [`data${i + 1}`, x]))
    inquireEstimatePerform.mockResolvedValue({ header: {}, periods: ['', '2022.12', '2023.12E'],
      income: [r('111.0', '222.0', '333.0'), r('10.0', '20.0', '30.0'), r('1', '2', '3'), r('1', '2', '3'), r('1', '2', '3'), r('1', '2', '3')], indicators: [] })
    const out = await getEarningsEstimates({ code: '005930' })
    expect(out.periods.map((p) => [p.period, p.revenue, p.revenueGrowthPct, p.eps])).toEqual([['2022.12', 222, 2, null], ['2023.12E', 333, 3, null]])
  })
  it('passes a production-only failure through as an error', async () => {
    inquireInvestorTrendEstimate.mockRejectedValue(Object.assign(new Error('종목별 외인기관 추정가집계: KIS 실전 계정 전용 API입니다'), { code: 'PROD_ONLY' }))
    await expect(getFlowEstimate({ code: '009150' })).rejects.toThrow('실전 계정 전용')
  })
})

describe('MCP ranking tools', () => {
  const capRow = (rank, code, name, cap) => ({ rank, code, name, price: 1000, change: -10, changePct: -0.99, volume: 5, listedShares: 100, marketCapKrw: cap, marketWeightPct: 1.5 })
  it('returns the market-cap ranking for the requested market and trims to limit', async () => {
    inquireMarketCapRank.mockResolvedValue([capRow(1, '005930', '삼성전자', 1596e12), capRow(2, '000660', 'SK하이닉스', 1273e12), capRow(3, '402340', 'SK스퀘어', 152e12)])
    const out = await getMarketCapRanking({ market: 'kospi', share_class: 'common', limit: 2 })
    expect(inquireMarketCapRank.mock.calls[0]).toEqual(['k', 's', 'prod', { market: 'KOSPI', shareClass: 'common' }])
    expect(out).toMatchObject({ market: 'KOSPI', shareClass: 'common', count: 2, maxRows: 30, basis: 'KRX', currency: 'KRW' })
    expect(out.rows.map((r) => r.code)).toEqual(['005930', '000660']); expect(out.rows[0].marketCapKrw).toBe(1596e12)
    await getMarketCapRanking()
    expect(inquireMarketCapRank.mock.calls[1][3]).toEqual({ market: 'ALL', shareClass: 'all' })
    await expect(getMarketCapRanking({ market: 'NYSE' })).rejects.toThrow('market')
    await expect(getMarketCapRanking({ limit: 31 })).rejects.toThrow('limit')
  })
  const flowRow = (code, frgn, orgn) => ({ code, name: code, price: 100, change: 1, changePct: 1, volume: 9, netShares: 3,
    foreignNetShares: frgn == null ? null : frgn / 100, foreignNetAmountKrw: frgn, institutionNetShares: orgn == null ? null : orgn / 100, institutionNetAmountKrw: orgn,
    parts: { investmentTrust: { netShares: 1, netAmountKrw: 100 } } })
  it('adds foreign and institution amounts, keeps the KIS order and hides parts unless asked', async () => {
    inquireForeignInstitutionRank.mockResolvedValue([flowRow('009150', 3e9, 2e9), flowRow('402340', 5e9, null), flowRow('373220', null, null)])
    const out = await getFlowRanking({ limit: 3 })
    expect(inquireForeignInstitutionRank.mock.calls[0][3]).toEqual({ market: 'ALL', investor: 'all', side: 'buy', sortBy: 'amount' })
    expect(out).toMatchObject({ estimated: true, investor: 'all', side: 'buy', sort: 'amount', count: 3, resortedFromAll: false })
    expect(out.rows.map((r) => [r.rank, r.code, r.sumNetAmountKrw])).toEqual([[1, '009150', 5e9], [2, '402340', 5e9], [3, '373220', null]])
    expect(out.rows[0].parts).toBeUndefined()
    expect((await getFlowRanking({ detail: true })).rows[0].parts).toEqual({ investmentTrust: { netShares: 1, netAmountKrw: 100 } })
    await expect(getFlowRanking({ investor: 'individual' })).rejects.toThrow('investor')
  })
  it('re-sorts the combined list by institution when the institution-only query comes back empty', async () => {
    inquireForeignInstitutionRank.mockImplementation(async (_k, _s, _e, opts) => (opts.investor === 'institution' ? []
      : [flowRow('A00001', 9e9, -1e9), flowRow('A00002', 1e9, 4e9), flowRow('A00003', 2e9, 7e9), flowRow('A00004', 3e9, null)]))
    const buy = await getFlowRanking({ investor: 'institution' })
    expect(inquireForeignInstitutionRank.mock.calls.map((c) => c[3].investor)).toEqual(['institution', 'all'])
    expect(buy.resortedFromAll).toBe(true); expect(buy.rows.map((r) => r.code)).toEqual(['A00003', 'A00002'])
    expect(buy.note).toContain('다시 정렬')
    const sell = await getFlowRanking({ investor: 'institution', side: 'sell' })
    expect(sell.rows.map((r) => r.code)).toEqual(['A00001'])
  })
})
