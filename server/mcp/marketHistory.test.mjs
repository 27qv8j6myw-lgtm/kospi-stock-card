import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('../kisClient.mjs', () => ({ inquireDailyBars: vi.fn(), inquireMinuteBars: vi.fn(), inquireInvestorByStock: vi.fn() }))
import { inquireDailyBars, inquireMinuteBars, inquireInvestorByStock } from '../kisClient.mjs'
import { getDailyBars, getMinuteBars, getInvestorFlow } from './marketHistory.mjs'
beforeEach(() => { vi.clearAllMocks(); process.env.KIS_APP_KEY = 'test'; process.env.KIS_APP_SECRET = 'test' })
describe('MCP market history', () => {
  it('keeps actual dates and requested daily count', async () => {
    inquireDailyBars.mockResolvedValue([{ ts: '20260925', price: 100 }, { ts: '20260928', price: 110 }])
    const out = await getDailyBars({ code: '005930', limit: 1 })
    expect(out.bars).toHaveLength(1); expect(out.latestDataDate).toBe('20260928'); expect(out.bars[0].close).toBe(110)
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
