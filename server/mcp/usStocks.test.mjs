import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('../kisClient.mjs', () => ({ inquireOverseasDailyBars: vi.fn(), inquireOverseasMinuteBars: vi.fn(), inquireOverseasPriceDetail: vi.fn() }))
import { inquireOverseasDailyBars, inquireOverseasMinuteBars, inquireOverseasPriceDetail } from '../kisClient.mjs'
import { getUsDailyBars, getUsMinuteBars, getUsQuotes, usSession, withExchange } from './usStocks.mjs'

beforeEach(() => { vi.resetAllMocks(); process.env.KIS_APP_KEY = 'k'; process.env.KIS_APP_SECRET = 's'; process.env.KIS_ENV = 'prod' })

const bar = (date, close) => ({ date, open: close - 1, high: close + 1, low: close - 2, close, volume: 100, tradingValue: 1000 })
const min = (ld, lt, close) => ({ localDate: ld, localTime: lt, kstDate: '20261112', kstTime: '060000', open: close, high: close, low: close, close, volume: 10, tradingValue: 100 })

describe('US stocks (KIS overseas)', () => {
  it('classifies local time into sessions', () => {
    expect(usSession('040000')).toBe('pre'); expect(usSession('093000')).toBe('regular')
    expect(usSession('155900')).toBe('regular'); expect(usSession('160000')).toBe('after'); expect(usSession('')).toBe('pre')
  })
  it('tries exchanges in order and remembers the one that works', async () => {
    const fn = vi.fn(async (e) => { if (e !== 'NYS') throw new Error('없음'); return 1 })
    expect(await withExchange('ZZZT', undefined, fn)).toEqual({ exchange: 'NYS', value: 1 })
    fn.mockClear()
    await withExchange('ZZZT', undefined, fn)
    expect(fn).toHaveBeenCalledTimes(1); expect(fn).toHaveBeenCalledWith('NYS')
    await expect(withExchange('ZZZT', 'XXX', fn)).rejects.toThrow('exchange')
    await expect(withExchange('QQQQ', undefined, async () => { throw new Error('x') })).rejects.toThrow('어디에서도')
  })
  it('returns daily bars with adjusted default and metadata', async () => {
    inquireOverseasDailyBars.mockResolvedValue({ bars: [bar('20261110', 168.89), bar('20261111', 173.73)], pages: 1 })
    const out = await getUsDailyBars({ symbol: 'nvda', limit: 2 })
    expect(inquireOverseasDailyBars).toHaveBeenCalledWith('k', 's', 'prod', 'NAS', 'NVDA', { period: 'D', endDate: undefined, adjusted: true, maxBars: 2 })
    expect(out.symbol).toBe('NVDA'); expect(out.exchange).toBe('NAS'); expect(out.count).toBe(2)
    expect(out.latestDataDate).toBe('20261111'); expect(out.adjusted).toBe(true)
    await expect(getUsDailyBars({ symbol: 'NVDA', limit: 501 })).rejects.toThrow('limit')
    await expect(getUsDailyBars({ symbol: 'bad symbol' })).rejects.toThrow('심볼')
  })
  it('returns minute bars tagged with ET/KST time and session', async () => {
    inquireOverseasMinuteBars.mockResolvedValue([min('20261111', '155500', 173.5), min('20261111', '160500', 171.2)])
    const out = await getUsMinuteBars({ symbol: 'NVDA', interval: 5 })
    expect(out.bars.map((b) => b.session)).toEqual(['regular', 'after']); expect(out.sessions).toEqual(['regular', 'after'])
    expect(out.bars[1].timeET).toBe('2026-11-11 16:05'); expect(out.bars[1].timeKST).toBe('2026-11-12 06:00')
    await expect(getUsMinuteBars({ symbol: 'NVDA', interval: 7 })).rejects.toThrow('interval')
  })
  it('returns quote detail with the latest trade and reports failures per symbol', async () => {
    inquireOverseasPriceDetail.mockImplementation(async (_k, _s, _e, excd, sym) => {
      if (sym === 'NOPE') throw new Error('없음')
      return { symbol: sym, exchange: excd, price: 173.73, prevClose: 168.89, change: 4.84, changePct: 2.8658, open: 170, high: 177.54, low: 170.77, volume: 1, prevVolume: 2, high52w: 220, low52w: 90, per: 30, pbr: 20, eps: 5, marketCap: 1, krwPrice: 231800, fxRate: 1334.5 }
    })
    inquireOverseasMinuteBars.mockResolvedValue([min('20261111', '193000', 170.26)])
    const out = await getUsQuotes({ symbols: ['NVDA', 'nope', 'NVDA'] })
    expect(out.count).toBe(1); expect(out.quotes[0].changePct).toBe(2.87)
    expect(out.quotes[0].lastTrade).toMatchObject({ price: 170.26, session: 'after', vsRegularPct: -2 })
    expect(out.failed).toHaveLength(1); expect(out.failed[0].symbol).toBe('NOPE')
    await expect(getUsQuotes({ symbols: [] })).rejects.toThrow('비어')
  })
})
