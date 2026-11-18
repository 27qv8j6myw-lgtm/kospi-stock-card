import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('../kisClient.mjs', () => ({ inquireProgramTradeByStock: vi.fn(), inquireForeignMemberNetTrend: vi.fn() }))
import { inquireProgramTradeByStock, inquireForeignMemberNetTrend } from '../kisClient.mjs'
import { getProgramTrade, getForeignBrokerFlow, inferAmountUnit } from './intradayFlow.mjs'

beforeEach(() => { vi.clearAllMocks(); process.env.KIS_APP_KEY = 'k'; process.env.KIS_APP_SECRET = 's'; process.env.KIS_ENV = 'prod' })

const prog = (time, price, sell, buy, unit = 1) => ({
  time, price, changePct: 4.7, volume: 200000, sellShares: sell, buyShares: buy, netShares: buy - sell,
  sellAmountRaw: (sell * price) / unit, buyAmountRaw: (buy * price) / unit, netAmountRaw: ((buy - sell) * price) / unit,
  netSharesDelta: -500, netAmountDeltaRaw: (-500 * price) / unit,
})

describe('MCP intraday flow', () => {
  it('infers the amount unit from shares × price', () => {
    expect(inferAmountUnit([{ price: 700000, shares: 1000, amountRaw: 700000000 }])).toBe(1)
    expect(inferAmountUnit([{ price: 700000, shares: 1000, amountRaw: 712000 }])).toBe(1000)
    expect(inferAmountUnit([{ price: 700000, shares: 1000, amountRaw: 695 }])).toBe(1000000)
    expect(inferAmountUnit([{ price: 700000, shares: 0, amountRaw: 0 }, { price: null, shares: 5, amountRaw: 5 }])).toBeNull()
  })
  it('returns program trading as a cumulative series with amounts in won and a trend', async () => {
    inquireProgramTradeByStock.mockResolvedValue([
      prog('093000', 710000, 30000, 20000, 1000000),
      prog('093500', 712000, 34000, 21000, 1000000),
      prog('094000', 711000, 40000, 22000, 1000000),
    ])
    const out = await getProgramTrade({ code: '402340', limit: 2 })
    expect(inquireProgramTradeByStock.mock.calls[0]).toEqual(['k', 's', 'prod', '402340', { marketDiv: 'J' }])
    expect(out.units.amountUnitInferred).toBe(1000000)
    expect(out.rows.map((r) => r.time)).toEqual(['09:35:00', '09:40:00']); expect(out.totalRows).toBe(3)
    expect(out.latest).toMatchObject({ netShares: -18000, netAmountKrw: -18000 * 711000, netPctOfVolume: -9 })
    expect(out.trend).toEqual({ fromNetShares: -13000, toNetShares: -18000, change: -5000, direction: 'selling' })
    await expect(getProgramTrade({ code: 'x' })).rejects.toThrow('6자리')
    await expect(getProgramTrade({ code: '402340', market: 'zz' })).rejects.toThrow('시장')
  })
  it('leaves amounts null when the unit cannot be inferred and handles an empty day', async () => {
    inquireProgramTradeByStock.mockResolvedValue([{ time: '090100', price: 700000, changePct: 0, volume: 0, sellShares: 0, buyShares: 0, netShares: 0, sellAmountRaw: 0, buyAmountRaw: 0, netAmountRaw: 0, netSharesDelta: 0, netAmountDeltaRaw: 0 }])
    const one = await getProgramTrade({ code: '402340' })
    expect(one.latest.netAmountKrw).toBeNull(); expect(one.trend).toBeNull(); expect(one.latest.netPctOfVolume).toBeNull()
    inquireProgramTradeByStock.mockResolvedValue([])
    const none = await getProgramTrade({ code: '402340' })
    expect(none.latest).toBeNull(); expect(none.rows).toEqual([])
  })
  it('returns foreign-broker net buying with an estimated amount', async () => {
    inquireForeignMemberNetTrend.mockResolvedValue([
      { time: '093000', price: 710000, changePct: 4.5, volume: 100000, sellShares: 30000, buyShares: 5000, netShares: -25000, netSharesDelta: -1000 },
      { time: '100000', price: 715000, changePct: 5.3, volume: 250000, sellShares: 31000, buyShares: 16000, netShares: -15000, netSharesDelta: 2000 },
    ])
    const out = await getForeignBrokerFlow({ code: '402340' })
    expect(inquireForeignMemberNetTrend.mock.calls[0]).toEqual(['k', 's', 'prod', '402340'])
    expect(out.latest).toMatchObject({ time: '10:00:00', netShares: -15000, netAmountEstKrw: -15000 * 715000, netPctOfVolume: -6 })
    expect(out.trend.direction).toBe('buying')
  })
})
