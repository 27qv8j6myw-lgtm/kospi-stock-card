import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('../kisClient.mjs', () => ({ inquireInvestorByStock: vi.fn(), inquireInvestorTradeDailyRange: vi.fn(), inquireDailyBars: vi.fn(), inquireDailyBarsRange: vi.fn(), inquireMinuteBars: vi.fn() }))
vi.mock('../lib/supabaseService.mjs', () => ({ getSupabaseService: vi.fn(() => null) }))
import { inquireInvestorByStock } from '../kisClient.mjs'
import { runInvestorFlowCollect, resolveTrackedCodes, toDbRows, DEFAULT_TRACKED_CODES } from './investorFlow.mjs'

function fakeSupabase(tables = {}) {
  const upserts = []
  return {
    upserts,
    from(table) {
      return {
        select: async () => ({ data: tables[table] ?? [], error: null }),
        upsert: async (rows, opts) => { upserts.push({ table, rows, opts }); return { error: null } },
      }
    },
  }
}

beforeEach(() => { vi.clearAllMocks(); process.env.KIS_APP_KEY = 'k'; process.env.KIS_APP_SECRET = 's'; process.env.KIS_ENV = 'prod'; delete process.env.INVESTOR_FLOW_CODES })

describe('investor flow collector', () => {
  it('tracks defaults ∪ holdings ∪ watchlist ∪ env, 6-digit codes only', async () => {
    process.env.INVESTOR_FLOW_CODES = '123456, bad, 005930'
    const codes = await resolveTrackedCodes(fakeSupabase({ pro_holdings: [{ code: '000001' }], pro_watchlist: [{ code: '000002' }, { code: 'x' }] }))
    expect(codes).toEqual([...new Set([...DEFAULT_TRACKED_CODES, '123456', '000001', '000002'])].sort())
  })
  it('maps KIS rows to table rows in KRW and upserts on (code, trade_date)', async () => {
    inquireInvestorByStock.mockResolvedValue({ rows: [
      { stck_bsop_date: '20260928', frgn_ntby_qty: '-3', frgn_ntby_tr_pbmn: '-1', orgn_ntby_qty: '2', orgn_ntby_tr_pbmn: '0.5', prsn_ntby_qty: '', prsn_ntby_tr_pbmn: '' },
      { stck_bsop_date: '20260925', frgn_ntby_qty: '10', frgn_ntby_tr_pbmn: '2', orgn_ntby_qty: '0', orgn_ntby_tr_pbmn: '0', prsn_ntby_qty: '1', prsn_ntby_tr_pbmn: '1' },
    ] })
    const sb = fakeSupabase()
    const out = await runInvestorFlowCollect(sb, { codes: ['005930'] })
    expect(out.upserted).toBe(2); expect(out.failed).toBe(0)
    expect(sb.upserts[0].opts).toEqual({ onConflict: 'code,trade_date' })
    const first = sb.upserts[0].rows[0]
    expect(first).toMatchObject({ code: '005930', trade_date: '2026-09-28', foreign_net_qty: -3, foreign_net_amt: -1000000, institution_net_amt: 500000, individual_net_qty: null })
    expect(toDbRows('x', [], 'now')).toEqual([])
  })
  it('keeps going when one code fails', async () => {
    inquireInvestorByStock.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ rows: [{ stck_bsop_date: '20260928', frgn_ntby_qty: '1', frgn_ntby_tr_pbmn: '1' }] })
    const out = await runInvestorFlowCollect(fakeSupabase(), { codes: ['000001', '000002'] })
    expect(out.failed).toBe(1); expect(out.upserted).toBe(1); expect(out.results[0].error).toBe('boom')
  })
})
