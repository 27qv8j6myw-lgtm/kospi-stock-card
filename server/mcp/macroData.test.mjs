import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getUsMacro, getKrMacro, withChanges, ecosRange } from './macroData.mjs'

const json = (body, ok = true, status = 200) => ({ ok, status, json: async () => body })
beforeEach(() => { process.env.FRED_API_KEY = 'fredkey'; process.env.ECOS_API_KEY = 'ecoskey' })
afterEach(() => { vi.unstubAllGlobals() })

describe('macro data', () => {
  it('computes changes: percent for levels, points only for rates', () => {
    const lvl = withChanges([{ date: 'a', value: 100 }, { date: 'b', value: 102 }, { date: 'c', value: 103.02 }], 2, false)
    expect(lvl[1]).toEqual({ date: 'b', value: 102, change: 2, pctChange: 2 })
    expect(lvl[2]).toMatchObject({ pctChange: 1, yoyChange: 3.02, yoyPct: 3.02 })
    const rate = withChanges([{ date: 'a', value: 4.1 }, { date: 'b', value: 4.4 }], 0, true)
    expect(rate[1]).toEqual({ date: 'b', value: 4.4, change: 0.3 })
  })
  it('returns FRED series with aliases, yoy and next release', async () => {
    const months = Array.from({ length: 20 }, (_, i) => ({ date: `m${String(20 - i).padStart(2, '0')}`, value: i === 3 ? '.' : String(120 - i) }))
    const fetchMock = vi.fn(async (u) => {
      const url = new URL(u)
      expect(url.searchParams.get('api_key')).toBe('fredkey'); expect(url.searchParams.get('file_type')).toBe('json')
      if (url.pathname.endsWith('/series')) return json({ seriess: [{ title: 'CPI All Urban', frequency: 'Monthly', frequency_short: 'M', units: 'Index 1982-1984=100', seasonal_adjustment_short: 'SA', last_updated: '2026-11-12' }] })
      if (url.pathname.endsWith('/series/observations')) { expect(url.searchParams.get('series_id')).toBe('CPIAUCSL'); expect(url.searchParams.get('limit')).toBe('20'); return json({ observations: months }) }
      if (url.pathname.endsWith('/series/release')) return json({ releases: [{ id: 10, name: 'Consumer Price Index' }] })
      if (url.pathname.endsWith('/release/dates')) return json({ release_dates: [{ date: '2999-12-10' }] })
      throw new Error('unexpected')
    })
    vi.stubGlobal('fetch', fetchMock)
    const out = await getUsMacro({ series: ['cpi'], limit: 3 })
    const r = out.results[0]
    expect(r).toMatchObject({ seriesId: 'CPIAUCSL', title: 'CPI All Urban', release: { name: 'Consumer Price Index', upcoming: ['2999-12-10'] } })
    expect(r.observations).toHaveLength(3)
    expect(r.latest).toMatchObject({ date: 'm20', value: 120, change: 1 })
    expect(r.latest.yoyPct).toBeCloseTo(((120 - 107) / 107) * 100, 2) // 결측 1개를 건너뛴 12개 전
  })
  it('keeps going when one FRED series fails and requires the key', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error_message: 'Bad Request. The series does not exist.' }, false, 400)))
    const out = await getUsMacro({ series: ['NOPE'] })
    expect(out.results[0].error).toContain('400'); expect(out.results[0].error).not.toContain('fredkey')
    delete process.env.FRED_API_KEY
    await expect(getUsMacro({})).rejects.toThrow('FRED_API_KEY')
  })
  it('lists ECOS key statistics with keyword filter', async () => {
    const fetchMock = vi.fn(async () => json({ KeyStatisticList: { list_total_count: 2, row: [
      { CLASS_NAME: '시장금리', KEYSTAT_NAME: '한국은행 기준금리', DATA_VALUE: '2.5', CYCLE: '20261117', UNIT_NAME: '%' },
      { CLASS_NAME: '환율', KEYSTAT_NAME: '원/달러 환율(종가)', DATA_VALUE: '1,335.8', CYCLE: '20261117', UNIT_NAME: '원' },
    ] } }))
    vi.stubGlobal('fetch', fetchMock)
    const out = await getKrMacro({ keyword: '환율' })
    expect(fetchMock.mock.calls[0][0]).toBe('https://ecos.bok.or.kr/api/KeyStatisticList/ecoskey/json/kr/1/100')
    expect(out.indicators).toEqual([{ group: '환율', name: '원/달러 환율(종가)', value: 1335.8, unit: '원', period: '20261117' }])
  })
  it('fetches an ECOS series by alias, groups items, and treats INFO-200 as empty', async () => {
    const fetchMock = vi.fn(async () => json({ StatisticSearch: { list_total_count: 3, row: [
      { STAT_NAME: '소비자물가지수', ITEM_CODE1: '0', ITEM_NAME1: '총지수', UNIT_NAME: '2020=100', TIME: '202509', DATA_VALUE: '117.0' },
      { STAT_NAME: '소비자물가지수', ITEM_CODE1: '0', ITEM_NAME1: '총지수', UNIT_NAME: '2020=100', TIME: '202510', DATA_VALUE: '117.585' },
      { STAT_NAME: '소비자물가지수', ITEM_CODE1: '0', ITEM_NAME1: '총지수', UNIT_NAME: '2020=100', TIME: '202508', DATA_VALUE: '116.5' },
    ] } }))
    vi.stubGlobal('fetch', fetchMock)
    const out = await getKrMacro({ indicator: 'cpi', start: '202508', end: '202510' })
    expect(fetchMock.mock.calls[0][0]).toBe('https://ecos.bok.or.kr/api/StatisticSearch/ecoskey/json/kr/1/1000/901Y009/M/202508/202510/0')
    expect(out.series[0].observations.map((o) => o.date)).toEqual(['202508', '202509', '202510'])
    expect(out.series[0].latest).toMatchObject({ value: 117.585, pctChange: 0.5 })
    vi.stubGlobal('fetch', vi.fn(async () => json({ RESULT: { CODE: 'INFO-200', MESSAGE: '해당하는 데이터가 없습니다.' } })))
    expect((await getKrMacro({ indicator: 'base_rate' })).series).toEqual([])
    vi.stubGlobal('fetch', vi.fn(async () => json({ RESULT: { CODE: 'INFO-100', MESSAGE: '인증키가 유효하지 않습니다.' } })))
    await expect(getKrMacro({})).rejects.toThrow('INFO-100')
    await expect(getKrMacro({ mode: 'search' })).rejects.toThrow('keyword')
  })
  it('builds default ECOS ranges per cycle', () => {
    const now = Date.UTC(2026, 10, 17, 3)
    expect(ecosRange('M', now)).toEqual(['202411', '202611'])
    expect(ecosRange('Q', now)).toEqual(['2023Q1', '2026Q4'])
    expect(ecosRange('D', now)).toEqual(['20261003', '20261117'])
    expect(ecosRange('A', now)).toEqual(['2018', '2026'])
  })
})
