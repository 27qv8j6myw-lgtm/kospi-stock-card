import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('../kisClient.mjs', () => ({ inquireOverseasStockPrice: vi.fn() }))
import { inquireOverseasStockPrice } from '../kisClient.mjs'
import { parseYahooChart, streakFromCloses, planSymbols, getUsSnapshot, formatEpoch } from './usSnapshot.mjs'

/** 2026-10-16 16:00 ET = 20:00 UTC */
const FRI_CLOSE = Date.UTC(2026, 9, 16, 20, 0, 0) / 1000
const day = (d) => Date.UTC(2026, 9, d, 13, 30, 0) / 1000

function yahoo(symbol, closes, meta = {}) {
  return { chart: { result: [{
    meta: { symbol, currency: 'USD', exchangeName: 'NMS', fullExchangeName: 'NasdaqGS', regularMarketPrice: closes.at(-1),
      chartPreviousClose: closes.at(-2), regularMarketTime: FRI_CLOSE, regularMarketDayHigh: closes.at(-1) + 1, regularMarketDayLow: closes.at(-1) - 1, regularMarketVolume: 1000, ...meta },
    timestamp: closes.map((_, i) => day(16 - (closes.length - 1) + i)),
    indicators: { quote: [{ close: closes }] },
  }] } }
}

beforeEach(() => { vi.clearAllMocks(); process.env.KIS_APP_KEY = 'k'; process.env.KIS_APP_SECRET = 's'; process.env.KIS_ENV = 'prod' })

describe('US snapshot', () => {
  it('parses a Yahoo chart into price, previous close, change, times and a streak', () => {
    const out = parseYahooChart('^SOX', yahoo('^SOX', [12500, 12300, 12000, 11800, 11581.22]))
    expect(out.price).toBe(11581.22); expect(out.prevClose).toBe(11800)
    expect(out.change).toBeCloseTo(-218.78, 2); expect(out.changePct).toBe(-1.85)
    expect(out.marketTimeET).toBe('2026-10-16 16:00'); expect(out.marketTimeKST).toBe('2026-10-17 05:00')
    expect(out.sessionDate).toBe('20261016'); expect(out.dailyCloses).toHaveLength(5)
    expect(out.streak).toEqual({ direction: 'down', days: 4 }); expect(out.source).toBe('yahoo')
  })
  it('falls back to settled closes when the meta has no previous close', () => {
    const json = yahoo('CL=F', [95.15, 98.88], { chartPreviousClose: undefined, previousClose: undefined })
    const out = parseYahooChart('CL=F', json)
    expect(out.prevClose).toBe(95.15); expect(out.changePct).toBe(3.92)
  })
  it('rejects a response without a result or price', () => {
    expect(() => parseYahooChart('X', { chart: { result: null, error: { description: 'Not Found' } } })).toThrow('Not Found')
    expect(() => parseYahooChart('X', { chart: { result: [{ meta: {} }] } })).toThrow('regularMarketPrice')
  })
  it('counts consecutive moves from the end of the close series', () => {
    expect(streakFromCloses([1, 2, 3, 2, 1])).toEqual({ direction: 'down', days: 2 })
    expect(streakFromCloses([3, 2, 1, 2, 3, 4])).toEqual({ direction: 'up', days: 3 })
    expect(streakFromCloses([5, 5])).toEqual({ direction: 'flat', days: 0 })
    expect(streakFromCloses([5])).toBeNull()
  })
  it('plans default groups plus validated extra symbols without duplicates', () => {
    const all = planSymbols({})
    expect(all.filter((s) => s.group === 'indices').map((s) => s.symbol)).toContain('^SOX')
    expect(all.find((s) => s.symbol === 'SOXL').kisExchange).toBe('AMS')
    const some = planSymbols({ groups: ['futures'], symbols: ['nvda', 'ZN=F', 'NVDA'] })
    expect(some.map((s) => s.symbol)).toEqual(['NQ=F', 'ES=F', 'CL=F', 'BZ=F', 'GC=F', 'NVDA', 'ZN=F'])
    expect(some.find((s) => s.symbol === 'NVDA').kisExchange).toBe('NAS'); expect(some.find((s) => s.symbol === 'ZN=F').kisExchange).toBeUndefined()
    expect(() => planSymbols({ groups: ['bonds'] })).toThrow('groups')
    expect(() => planSymbols({ symbols: ['bad symbol!'] })).toThrow('심볼')
    expect(() => planSymbols({ symbols: Array.from({ length: 16 }, (_, i) => `S${i}`) })).toThrow('최대')
  })
  it('groups results, uses the KIS fallback for stocks and lists failures', async () => {
    const fetchImpl = vi.fn(async (url) => {
      const symbol = decodeURIComponent(new URL(url).pathname.split('/').pop())
      if (symbol === 'MU') return { ok: false, status: 429, json: async () => ({}) }
      if (symbol === 'BZ=F') return { ok: true, status: 200, json: async () => ({ chart: { result: null, error: { description: 'No data' } } }) }
      return { ok: true, status: 200, json: async () => yahoo(symbol, [100, 101, 102]) }
    })
    inquireOverseasStockPrice.mockResolvedValue({ symbol: 'MU', exchange: 'NAS', price: 180.5, prevClose: 190, change: -9.5, changePct: -5, volume: 10, tradingValue: 1 })
    const out = await getUsSnapshot({ groups: ['futures', 'stocks'], symbols: ['QQQ'] }, { fetchImpl, now: Date.UTC(2026, 9, 17, 0, 0, 0) })
    expect(out.retrievedAtKST).toBe('2026-10-17 09:00'); expect(out.retrievedAtET).toBe('2026-10-16 20:00')
    expect(out.groups.futures.map((r) => r.symbol)).toEqual(['NQ=F', 'ES=F', 'CL=F', 'GC=F'])
    expect(out.failed).toEqual([{ symbol: 'BZ=F', label: '브렌트유 선물 (근월 연속, $/bbl)', error: 'yahoo: No data' }])
    const mu = out.groups.stocks.find((r) => r.symbol === 'MU')
    expect(mu.source).toBe('kis'); expect(mu.price).toBe(180.5); expect(mu.changePct).toBe(-5)
    expect(inquireOverseasStockPrice).toHaveBeenCalledWith('k', 's', 'prod', 'NAS', 'MU')
    expect(out.groups.extra[0].symbol).toBe('QQQ'); expect(out.count).toBe(15)
  })
  it('formats epochs in the requested time zone', () => {
    expect(formatEpoch(FRI_CLOSE, 'America/New_York')).toBe('2026-10-16 16:00'); expect(formatEpoch(null, 'Asia/Seoul')).toBeNull()
  })
})
