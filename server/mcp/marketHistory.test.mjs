import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('../kisClient.mjs', () => ({ inquireDailyBars: vi.fn(), inquireDailyBarsRange: vi.fn(), inquireMinuteBars: vi.fn(), inquireInvestorByStock: vi.fn() }))
import { inquireDailyBars, inquireDailyBarsRange, inquireMinuteBars, inquireInvestorByStock } from '../kisClient.mjs'
import { getDailyBars, getMinuteBars, getInvestorFlow } from './marketHistory.mjs'
beforeEach(() => { vi.clearAllMocks(); process.env.KIS_APP_KEY = 'test'; process.env.KIS_APP_SECRET = 'test' })
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
  it('returns empty history as missing rather than zero buying', async () => {
    inquireInvestorByStock.mockResolvedValue({ rows: [] })
    const out = await getInvestorFlow({ code: '005930' })
    expect(out.latestDataDate).toBeNull(); expect(out.cumulative3d.foreign.netShares).toBeNull()
  })
})
