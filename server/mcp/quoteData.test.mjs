import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('../kisClient.mjs', () => ({ MARKET_DIV_DISPLAY: 'UN', inquireOvertimePrice: vi.fn(), inquireMinuteBars: vi.fn() }))
vi.mock('../lib/toolExecutor.mjs', () => ({ getKisQuote: vi.fn() }))
vi.mock('../lib/stocksMasterSearch.mjs', () => ({ searchStocksMaster: vi.fn(async () => ({ ok: false, items: [] })) }))
vi.mock('../lib/supabaseService.mjs', () => ({ getSupabaseService: vi.fn(() => null) }))
import { inquireOvertimePrice, inquireMinuteBars } from '../kisClient.mjs'
import { getKisQuote } from '../lib/toolExecutor.mjs'
import { seoulClock, isAfterRegularClose, getQuotes } from './quoteData.mjs'

beforeEach(() => {
  vi.clearAllMocks(); process.env.KIS_APP_KEY = 'k'; process.env.KIS_APP_SECRET = 's'; process.env.KIS_ENV = 'prod'
  getKisQuote.mockResolvedValue({ code: '096770', name: 'SK이노베이션', marketDiv: 'J', currentPrice: 149100, change: -13900, changePct: -8.53, basePrice: 163000, openPrice: 159600, dayHigh: 162100, dayLow: 148100, volume: 760310 })
})

describe('MCP quote close window', () => {
  it('attaches the regular close only on weekdays after 15:30 KST', () => {
    // 2026-10-16(금) 15:29 / 15:30 / 17:06 KST, 2026-10-17(토) 17:00 KST, 2026-10-19(월) 08:31 KST
    expect(isAfterRegularClose(new Date('2026-10-16T06:29:00Z'))).toBe(false)
    expect(isAfterRegularClose(new Date('2026-10-16T06:30:00Z'))).toBe(true)
    expect(isAfterRegularClose(new Date('2026-10-16T08:06:00Z'))).toBe(true)
    expect(isAfterRegularClose(new Date('2026-10-17T08:00:00Z'))).toBe(false)
    expect(isAfterRegularClose(new Date('2026-10-18T23:31:00Z'))).toBe(false)
    expect(seoulClock(new Date('2026-10-16T08:06:00Z'))).toEqual({ weekday: 'Fri', hhmm: '1706' })
  })
  it('reads the regular close from the 15:30 minute bar and adds after-hours only when traded', async () => {
    inquireMinuteBars.mockResolvedValue([{ date: '20261020', hhmmss: '152900', price: 148100 }, { date: '20261020', hhmmss: '153000', price: 148100, volume: 29832 }])
    inquireOvertimePrice.mockResolvedValue({ regularClose: null, afterHoursPrice: null, afterHoursChangePct: null, afterHoursVolume: 0 })
    const out = await getQuotes(['096770'], { market: 'krx', includeClose: true })
    const q = out.quotes[0]
    expect(inquireMinuteBars.mock.calls[0].slice(3)).toEqual(['096770', { endHhmmss: '153000', marketDiv: 'J', settled: true }])
    expect(q.price).toBe(149100); expect(q.prevClose).toBe(163000)
    expect(q.regularClose).toBe(148100); expect(q.regularCloseBasis).toBe('KRX 정규장 종가 (15:30 1분봉)'); expect(q.regularCloseDate).toBe('20261020')
    expect(q.afterHoursPrice).toBeUndefined(); expect(q.afterHoursVolume).toBeUndefined()
    expect(out.note).toContain('regularClose')
  })
  it('falls back to the after-hours base price when the minute bar is missing, and keeps the quote when both fail', async () => {
    inquireMinuteBars.mockResolvedValue([{ date: '20261020', hhmmss: '152000', price: 148600 }])
    inquireOvertimePrice.mockResolvedValue({ regularClose: 148100, afterHoursPrice: 149100, afterHoursChangePct: 0.68, afterHoursVolume: 12000 })
    let q = (await getQuotes(['096770'], { market: 'krx', includeClose: true })).quotes[0]
    expect(q.regularClose).toBe(148100); expect(q.regularCloseBasis).toBe('KRX 정규장 종가 (시간외 단일가 기준가)')
    expect(q.afterHoursPrice).toBe(149100); expect(q.afterHoursChangePct).toBe(0.68); expect(q.afterHoursVolume).toBe(12000)
    inquireMinuteBars.mockRejectedValue(new Error('KIS 당일분봉 오류'))
    inquireOvertimePrice.mockRejectedValue(Object.assign(new Error('실전 계정 전용'), { code: 'PROD_ONLY' }))
    q = (await getQuotes(['096770'], { market: 'krx', includeClose: true })).quotes[0]
    expect(q.price).toBe(149100); expect(q.regularClose).toBeUndefined()
  })
  it('skips the close lookups when include_close is false or the market is NXT only', async () => {
    await getQuotes(['096770'], { market: 'krx', includeClose: false })
    expect(inquireMinuteBars).not.toHaveBeenCalled(); expect(inquireOvertimePrice).not.toHaveBeenCalled()
    getKisQuote.mockResolvedValue({ code: '096770', marketDiv: 'NX', currentPrice: 149000, basePrice: 163000 })
    await getQuotes(['096770'], { market: 'nxt', includeClose: true })
    expect(inquireMinuteBars).not.toHaveBeenCalled()
  })
})
