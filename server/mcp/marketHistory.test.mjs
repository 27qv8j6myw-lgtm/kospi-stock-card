import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('../kisClient.mjs', () => ({ inquireDailyBars: vi.fn(), inquireDailyBarsRange: vi.fn(), inquireMinuteBars: vi.fn(), inquireDailyMinuteBars: vi.fn(), inquireInvestorByStock: vi.fn(), inquireInvestorTradeDailyRange: vi.fn() }))
import { inquireDailyBars, inquireDailyBarsRange, inquireMinuteBars, inquireDailyMinuteBars, inquireInvestorByStock, inquireInvestorTradeDailyRange } from '../kisClient.mjs'
vi.mock('../lib/supabaseService.mjs', () => ({ getSupabaseService: vi.fn(() => null) }))
import { getDailyBars, getMinuteBars, getInvestorFlow, mergeFlowRows, dbRowsToFlow, summarizeFlow, normalizeInvestorRows, compareFlowOverlap, aggregateMinuteBars } from './marketHistory.mjs'
beforeEach(() => {
  vi.clearAllMocks(); process.env.KIS_APP_KEY = 'test'; process.env.KIS_APP_SECRET = 'test'; process.env.KIS_ENV = 'prod'
  inquireInvestorTradeDailyRange.mockResolvedValue({ rows: [], pages: 1, supported: true, error: null })
})
describe('MCP market history', () => {
  it('keeps actual dates and requested daily count', async () => {
    inquireDailyBars.mockResolvedValue([{ ts: '20260925', price: 100 }, { ts: '20260928', price: 110 }])
    const out = await getDailyBars({ code: '005930', limit: 1 })
    expect(out.bars).toHaveLength(1); expect(out.latestDataDate).toBe('20260928'); expect(out.bars[0].close).toBe(110)
    expect(inquireDailyBarsRange).not.toHaveBeenCalled()
  })
  it('uses paged range query for dates, limit > 100 or adjusted prices', async () => {
    inquireDailyBarsRange.mockResolvedValue({ bars: [{ ts: '20240102', price: 100, open: 99, high: 101, low: 98, volume: 5 }, { ts: '20260928', price: 110 }], pages: 7 })
    const out = await getDailyBars({ code: '005930', start_date: '20240101', end_date: '20260930', adjusted: true })
    expect(inquireDailyBars).not.toHaveBeenCalled()
    expect(inquireDailyBarsRange.mock.calls[0][4]).toEqual({ start: '20240101', end: '20260930', adjusted: true, maxBars: 1500 })
    expect(out.adjusted).toBe(true); expect(out.pages).toBe(7); expect(out.fromDate).toBe('20240102'); expect(out.latestDataDate).toBe('20260928')
    expect(out.bars[0]).toEqual({ date: '20240102', open: 99, high: 101, low: 98, close: 100, volume: 5 })
    await getDailyBars({ code: '005930', limit: 500 })
    expect(inquireDailyBarsRange.mock.calls[1][4]).toEqual({ start: '19900101', end: undefined, adjusted: false, maxBars: 500 })
  })
  it('rejects malformed or reversed dates before making requests', async () => {
    await expect(getDailyBars({ code: '005930', start_date: '2024-01-01' })).rejects.toThrow()
    await expect(getDailyBars({ code: '005930', start_date: '20260930', end_date: '20240101' })).rejects.toThrow()
    await expect(getDailyBars({ code: '005930', limit: 1501 })).rejects.toThrow()
    expect(inquireDailyBarsRange).not.toHaveBeenCalled()
  })
  it('preserves minute OHLC and missing date without inventing today', async () => {
    inquireMinuteBars.mockResolvedValue([{ hhmmss: '102500', price: 110, open: 100, high: 115, low: 95, volume: 10 }])
    const out = await getMinuteBars({ code: '005930', end_time: '102500', market: 'unified' })
    expect(out.latestDataDate).toBeNull(); expect(out.bars[0].high).toBe(115)
    expect(inquireMinuteBars.mock.calls[0][4]).toEqual({ endHhmmss: '102500', marketDiv: 'UN' })
  })
  it('reads a past trading day through the daily-minute TR and groups bars into N minutes', async () => {
    const bar = (hhmmss, o, h, l, c, v) => ({ date: '20260713', hhmmss, price: c, open: o, high: h, low: l, volume: v })
    inquireDailyMinuteBars.mockResolvedValue({ pages: 4, bars: [
      bar('090000', 1564000, 1564000, 1550000, 1552000, 100), bar('090100', 1552000, 1555000, 1540000, 1541000, 50), bar('090400', 1541000, 1543000, 1530000, 1531000, 30),
      bar('090500', 1531000, 1532000, 1500000, 1501000, 70), bar('090700', 1501000, 1510000, 1499000, 1509000, 20)] })
    const out = await getMinuteBars({ code: '009150', date: '20260713', interval: 5, limit: 100 })
    expect(inquireMinuteBars).not.toHaveBeenCalled()
    expect(inquireDailyMinuteBars.mock.calls[0][4]).toEqual({ date: '20260713', endHhmmss: undefined, marketDiv: 'J', maxBars: 500 })
    expect(out).toMatchObject({ intervalMinutes: 5, date: '20260713', count: 2, pages: 4, firstTime: '090000', latestDataDate: '20260713', latestDataTime: '090500' })
    expect(out.bars[0]).toEqual({ date: '20260713', time: '090000', open: 1564000, high: 1564000, low: 1530000, close: 1531000, volume: 180 })
    expect(out.bars[1]).toEqual({ date: '20260713', time: '090500', open: 1531000, high: 1532000, low: 1499000, close: 1509000, volume: 90 })
    await getMinuteBars({ code: '009150', date: '20260713', end_time: '100000', market: 'unified' })
    expect(inquireDailyMinuteBars.mock.calls[1][4]).toEqual({ date: '20260713', endHhmmss: '100000', marketDiv: 'UN', maxBars: 400 })
    await getMinuteBars({ code: '009150', limit: 60 })
    expect(inquireDailyMinuteBars.mock.calls[2][4].date).toMatch(/^\d{8}$/); expect(inquireDailyMinuteBars.mock.calls[2][4].maxBars).toBe(60)
    await getMinuteBars({ code: '009150', date: '20260713', interval: 60, limit: 800 })
    expect(inquireDailyMinuteBars.mock.calls[3][4].maxBars).toBe(800)
    expect(aggregateMinuteBars([{ date: null, time: '101500', open: null, high: null, low: null, close: 10, volume: 1 }], 10)).toEqual([{ date: null, time: '101000', open: 10, high: 10, low: 10, close: 10, volume: 1 }])
    await expect(getMinuteBars({ code: '009150', interval: 7 })).rejects.toThrow('interval')
    await expect(getMinuteBars({ code: '009150', date: '2026-07-13' })).rejects.toThrow('date')
    await expect(getMinuteBars({ code: '009150', date: '20260713', limit: 801 })).rejects.toThrow('limit')
  })
  it('rejects invalid input before making requests', async () => {
    await expect(getMinuteBars({ code: '005930', end_time: '256100' })).rejects.toThrow()
    await expect(getDailyBars({ code: 'bad' })).rejects.toThrow()
    expect(inquireDailyBars).not.toHaveBeenCalled(); expect(inquireMinuteBars).not.toHaveBeenCalled()
  })
  it('sorts flow, converts KRW units, and preserves missing fields in sums', async () => {
    inquireInvestorByStock.mockResolvedValue({ rows: [
      { stck_bsop_date: '20260925', frgn_ntby_qty: '10', frgn_ntby_tr_pbmn: '2', orgn_ntby_qty: '' },
      { stck_bsop_date: '20260928', frgn_ntby_qty: '-3', frgn_ntby_tr_pbmn: '-1', orgn_ntby_qty: '0' },
    ] })
    const out = await getInvestorFlow({ code: '005930', limit: 1 })
    expect(out.rows).toHaveLength(1); expect(out.latestDataDate).toBe('20260928')
    expect(out.cumulative3d.daysUsed).toBe(2)
    expect(out.cumulative3d.foreign).toEqual({ netShares: 7, netAmountKrw: 1000000 })
    expect(out.cumulative3d.institution.netShares).toBeNull()
    expect(out.rows[0].institution.netShares).toBe(0)
  })
  it('merges stored history under live rows for ranges, live wins on same date', async () => {
    inquireInvestorByStock.mockResolvedValue({ rows: [
      { stck_bsop_date: '20260928', frgn_ntby_qty: '5', frgn_ntby_tr_pbmn: '1', orgn_ntby_qty: '0', orgn_ntby_tr_pbmn: '0', prsn_ntby_qty: '0', prsn_ntby_tr_pbmn: '0' },
    ] })
    const readStored = vi.fn(async () => ({ available: true, rows: dbRowsToFlow([
      { trade_date: '2026-09-28', foreign_net_qty: 99, foreign_net_amt: 99, institution_net_qty: 0, institution_net_amt: 0, individual_net_qty: 0, individual_net_amt: 0 },
      { trade_date: '2026-08-01', foreign_net_qty: 1, foreign_net_amt: 2000000, institution_net_qty: 3, institution_net_amt: 4, individual_net_qty: 5, individual_net_amt: 6 },
      { trade_date: '2026-07-01', foreign_net_qty: 7, foreign_net_amt: 8, institution_net_qty: 9, institution_net_amt: 10, individual_net_qty: 11, individual_net_amt: 12 },
    ]) }))
    const out = await getInvestorFlow({ code: '005930', start_date: '20260715', end_date: '20260930' }, { readStored })
    expect(readStored.mock.calls[0]).toEqual(['005930', { start: '20260715', end: '20260930', limit: 1030 }])
    expect(out.source).toBe('KIS+DB'); expect(out.rows.map((r) => r.date)).toEqual(['20260928', '20260801'])
    expect(out.rows[0].foreign.netShares).toBe(5); expect(out.rows[1].foreign.netAmountKrw).toBe(2000000)
    expect(out.latestDataDate).toBe('20260928'); expect(out.fromDate).toBe('20260801'); expect(out.cumulative3d.daysUsed).toBe(2)
    expect(mergeFlowRows([], []).length).toBe(0)
  })
  it('falls back to live rows when the stored table is unavailable', async () => {
    inquireInvestorByStock.mockResolvedValue({ rows: [{ stck_bsop_date: '20260928', frgn_ntby_qty: '5', frgn_ntby_tr_pbmn: '1' }] })
    const out = await getInvestorFlow({ code: '005930', limit: 100 })
    expect(out.source).toBe('KIS'); expect(out.rows).toHaveLength(1); expect(out.note).toContain('누적 테이블(Supabase)은 읽을 수 없었습니다')
    await expect(getInvestorFlow({ code: '005930', start_date: '2026-07-15' })).rejects.toThrow()
  })
  it('returns empty history as missing rather than zero buying', async () => {
    inquireInvestorByStock.mockResolvedValue({ rows: [] })
    const out = await getInvestorFlow({ code: '005930' })
    expect(out.latestDataDate).toBeNull(); expect(out.cumulative3d.foreign.netShares).toBeNull()
  })
  it('skips a fully empty (pending) day in cumulative sums instead of nulling them', async () => {
    const day = (d, q) => ({ stck_bsop_date: d, frgn_ntby_qty: q, frgn_ntby_tr_pbmn: q, orgn_ntby_qty: q, orgn_ntby_tr_pbmn: q, prsn_ntby_qty: q, prsn_ntby_tr_pbmn: q })
    inquireInvestorByStock.mockResolvedValue({ rows: [day('20261007', ''), day('20261006', '3'), day('20261002', '2'), day('20261001', '1'), day('20260930', '10')] })
    const out = await getInvestorFlow({ code: '009150' })
    expect(out.latestDataDate).toBe('20261007'); expect(out.pendingDates).toEqual(['20261007']); expect(out.rows[0].foreign.netShares).toBeNull()
    expect(out.cumulative3d).toMatchObject({ daysUsed: 3, fromDate: '20261001', toDate: '20261006' })
    expect(out.cumulative3d.foreign).toEqual({ netShares: 6, netAmountKrw: 6000000 })
    expect(out.cumulative5d.daysUsed).toBe(4); expect(out.cumulative5d.institution.netShares).toBe(16)
    // 일부 값만 빈 날은 건너뛰지 않고 해당 항목 합계만 null
    const partial = normalizeInvestorRows([{ stck_bsop_date: '20261006', frgn_ntby_qty: '1', frgn_ntby_tr_pbmn: '1' }, day('20261002', '2')])
    expect(summarizeFlow(partial, 3).daysUsed).toBe(2); expect(summarizeFlow(partial, 3).foreign.netShares).toBe(3); expect(summarizeFlow(partial, 3).institution.netShares).toBeNull()
  })
  it('fills dates older than the live 30 days from the KIS history TR, overlapping the oldest live days', async () => {
    const day = (d, q) => ({ stck_bsop_date: d, frgn_ntby_qty: String(q), frgn_ntby_tr_pbmn: String(q), orgn_ntby_qty: '0', orgn_ntby_tr_pbmn: '0', prsn_ntby_qty: '0', prsn_ntby_tr_pbmn: '0' })
    const liveDates = ['20261006', '20261002', '20261001', '20260930', '20260929', '20260928', '20260923']
    inquireInvestorByStock.mockResolvedValue({ rows: liveDates.map((d, i) => day(d, i + 1)) })
    // 과거 TR: 겹치는 5일 중 20260923 은 값이 다르고(→ mismatch), 나머지는 같다. 그보다 오래된 2일이 새로 온다.
    inquireInvestorTradeDailyRange.mockResolvedValue({ pages: 2, supported: true, error: null, rows: [
      day('20261001', 3), day('20260930', 4), day('20260929', 5), day('20260928', 6), day('20260923', 99), day('20260922', 50), day('20260921', 60)] })
    const out = await getInvestorFlow({ code: '009150', start_date: '20260901' })
    expect(inquireInvestorTradeDailyRange.mock.calls[0].slice(3)).toEqual(['009150', { start: '20260901', end: '20261001', maxDays: 1000 }])
    expect(out.source).toBe('KIS+KIS-HIST'); expect(out.rows.map((r) => r.date)).toEqual([...liveDates, '20260922', '20260921'])
    expect(out.rows.find((r) => r.date === '20260923').foreign.netShares).toBe(7) // 라이브가 이긴다
    expect(out.history).toMatchObject({ used: true, supported: true, pages: 2, days: 7, fromDate: '20260921', overlapDays: 5, mismatchDays: 1, error: null })
    expect(out.fromDate).toBe('20260921'); expect(out.note).toContain('20260921부터 7일, 2번 호출')
    expect(compareFlowOverlap([], normalizeInvestorRows([day('20260921', 1)]))).toEqual({ overlapDays: 0, mismatchDays: 0 })
  })
  it('does not call the history TR when the range sits inside the live window, and survives its failure', async () => {
    const day = (d) => ({ stck_bsop_date: d, frgn_ntby_qty: '1', frgn_ntby_tr_pbmn: '1', orgn_ntby_qty: '1', orgn_ntby_tr_pbmn: '1', prsn_ntby_qty: '1', prsn_ntby_tr_pbmn: '1' })
    inquireInvestorByStock.mockResolvedValue({ rows: [day('20261006'), day('20261002'), day('20261001')] })
    const inside = await getInvestorFlow({ code: '009150', start_date: '20261001' })
    expect(inquireInvestorTradeDailyRange).not.toHaveBeenCalled(); expect(inside.history.used).toBe(false); expect(inside.rows).toHaveLength(3)
    inquireInvestorTradeDailyRange.mockRejectedValue(new Error('KIS 투자자 일별동향 오류 (X): boom'))
    const readStored = vi.fn(async () => ({ available: true, rows: dbRowsToFlow([{ trade_date: '2026-09-01', foreign_net_qty: 9, foreign_net_amt: 9, institution_net_qty: 9, institution_net_amt: 9, individual_net_qty: 9, individual_net_amt: 9 }]) }))
    const failed = await getInvestorFlow({ code: '009150', start_date: '20260801' }, { readStored })
    expect(failed.source).toBe('KIS+DB'); expect(failed.history.error).toContain('boom'); expect(failed.note).toContain('KIS 과거 조회에 실패했습니다')
    expect(failed.rows.map((r) => r.date)).toEqual(['20261006', '20261002', '20261001', '20260901'])
    inquireInvestorTradeDailyRange.mockResolvedValue({ rows: [], pages: 0, supported: false, error: null })
    const vps = await getInvestorFlow({ code: '009150', limit: 100 })
    expect(vps.history.supported).toBe(false); expect(vps.note).toContain('실전 계정 전용')
  })
})
