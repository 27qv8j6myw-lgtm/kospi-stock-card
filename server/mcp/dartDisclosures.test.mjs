import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import AdmZip from 'adm-zip'
import { classifyReport, buildCorpMap, documentToText, getDisclosures, getDisclosureDocument, setCorpMap, kstYmd } from './dartDisclosures.mjs'

const json = (body) => ({ ok: true, status: 200, json: async () => body })
const row = (o) => ({ corp_cls: 'Y', corp_name: '삼성E&A', corp_code: '00126308', stock_code: '028050', flr_nm: '삼성E&A', rm: '유', ...o })

beforeEach(() => { process.env.DART_API_KEY = 'testkey'; setCorpMap({ '028050': { corpCode: '00126308', name: '삼성E&A' } }) })
afterEach(() => { vi.unstubAllGlobals(); setCorpMap(null) })

describe('DART disclosures', () => {
  it('tags report titles', () => {
    expect(classifyReport('연결재무제표기준영업(잠정)실적(공정공시)').tags).toContain('earnings')
    expect(classifyReport('결산실적공시예고').tags).toEqual(['earnings_schedule'])
    expect(classifyReport('기업설명회(IR)개최(안내공시)').tags).toEqual(['earnings_schedule'])
    expect(classifyReport('단일판매ㆍ공급계약체결').tags).toEqual(['order'])
    expect(classifyReport('[기재정정]단일판매ㆍ공급계약체결')).toEqual({ tags: ['order'], correction: true })
    expect(classifyReport('주식등의대량보유상황보고서(일반)').tags).toEqual(['ownership'])
    expect(classifyReport('주요사항보고서(유상증자결정)').tags).toEqual(['dilution'])
    expect(classifyReport('분기보고서 (2026.09)')).toEqual({ tags: ['periodic'], correction: false })
  })
  it('builds the corp map from periodic filings, paging each market and widening the window when thin', async () => {
    const calls = []
    vi.stubGlobal('fetch', vi.fn(async (u) => {
      const q = new URL(u).searchParams
      calls.push(`${q.get('corp_cls')}:${q.get('bgn_de')}:${q.get('page_no')}`)
      expect(q.get('pblntf_ty')).toBe('A'); expect(q.get('last_reprt_at')).toBe('Y')
      if (q.get('corp_cls') === 'N') return json({ status: '013', message: '없음' })
      const page = Number(q.get('page_no'))
      const cls = q.get('corp_cls')
      const code = cls === 'Y' ? `00${page}000` : `10${page}000`
      return json({ status: '000', total_count: 150, total_page: 2, list: [
        { corp_code: `0000${cls === 'Y' ? 1 : 2}00${page}`, corp_name: `회사${cls}${page}`, stock_code: code },
        { corp_code: '00009999', corp_name: '비상장', stock_code: '' },
      ] })
    }))
    const map = await buildCorpMap(Date.UTC(2026, 10, 17, 3))
    expect(map['001000']).toEqual({ corpCode: '00001001', name: '회사Y1' })
    expect(map['102000']).toEqual({ corpCode: '00002002', name: '회사K2' })
    expect(Object.keys(map)).toHaveLength(4)
    expect(calls).toContain('Y:20260820:2'); expect(calls).toContain('K:20260522:1') // 표가 얇아 앞 90일도 조회
  })
  it('reports a slow DART as a timeout instead of hanging', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { const e = new Error('timeout'); e.name = 'TimeoutError'; throw e }))
    await expect(getDisclosures({})).rejects.toThrow('응답 지연')
  })
  it('turns markup into rows of text', () => {
    const t = documentToText('<?xml version="1.0"?><BODY><TITLE>영업(잠정)실적</TITLE><TABLE><TR><TH>구분</TH><TH>당기</TH></TR><TR><TD>영업이익</TD><TD>1,234&nbsp;억 &amp; </TD></TR></TABLE><P>끝</P></BODY>')
    expect(t).toBe('영업(잠정)실적\n구분 | 당기\n영업이익 | 1,234 억 &\n끝')
  })
  it('lists disclosures per code with summary and filters', async () => {
    const fetchMock = vi.fn(async () => json({ status: '000', total_count: 3, total_page: 1, list: [
      row({ report_nm: '결산실적공시예고', rcept_no: '20261110800001', rcept_dt: '20261110' }),
      row({ report_nm: '단일판매ㆍ공급계약체결', rcept_no: '20261105800002', rcept_dt: '20261105' }),
      row({ report_nm: '분기보고서 (2026.09)', rcept_no: '20261101000003', rcept_dt: '20261101' }),
    ] }))
    vi.stubGlobal('fetch', fetchMock)
    const out = await getDisclosures({ codes: ['028050'], end_date: '20261116', days: 30 })
    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.pathname).toBe('/api/list.json')
    expect(url.searchParams.get('corp_code')).toBe('00126308')
    expect(url.searchParams.get('bgn_de')).toBe('20261018'); expect(url.searchParams.get('end_de')).toBe('20261116')
    const r = out.results[0]
    expect(r.disclosures).toHaveLength(3)
    expect(r.disclosures[0]).toMatchObject({ date: '2026-11-10', code: '028050', market: 'KOSPI', tags: ['earnings_schedule'], url: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261110800001' })
    expect(r.summary.byTag).toEqual({ earnings_schedule: 1, order: 1, periodic: 1 })
    expect(r.summary.orders[0].rceptNo).toBe('20261105800002')
    const only = await getDisclosures({ codes: ['028050'], tags: ['order'] })
    expect(only.results[0].disclosures.map((d) => d.report)).toEqual(['단일판매ㆍ공급계약체결'])
    const miss = await getDisclosures({ codes: ['999999'] })
    expect(miss.results[0].error).toContain('고유번호')
  })
  it('scans the whole market, skips unlisted, and treats 013 as empty', async () => {
    const fetchMock = vi.fn(async () => json({ status: '000', total_count: 2, total_page: 1, list: [
      row({ report_nm: '단일판매ㆍ공급계약체결', rcept_no: '20261116800001', rcept_dt: '20261116' }),
      row({ report_nm: '단일판매ㆍ공급계약체결', rcept_no: '20261116800009', rcept_dt: '20261116', stock_code: '', corp_name: '비상장사' }),
    ] }))
    vi.stubGlobal('fetch', fetchMock)
    const out = await getDisclosures({ keyword: '공급계약', market: 'KOSPI', type: 'exchange' })
    const q = new URL(fetchMock.mock.calls[0][0]).searchParams
    expect(q.get('corp_cls')).toBe('Y'); expect(q.get('pblntf_ty')).toBe('I'); expect(q.get('bgn_de')).toBe(kstYmd(0)); expect(q.get('corp_code')).toBeNull()
    expect(out.disclosures).toHaveLength(1); expect(out.scanned.complete).toBe(true)
    await expect(getDisclosures({ days: 30 })).rejects.toThrow('최대 7일')
    vi.stubGlobal('fetch', vi.fn(async () => json({ status: '013', message: '조회된 데이타가 없습니다.' })))
    expect((await getDisclosures({})).disclosures).toEqual([])
    vi.stubGlobal('fetch', vi.fn(async () => json({ status: '020', message: '요청 제한을 초과하였습니다.' })))
    await expect(getDisclosures({})).rejects.toThrow('020')
  })
  it('reads a document zip, pages, and excerpts by keyword', async () => {
    const zip = new AdmZip()
    zip.addFile('20261105800002.xml', Buffer.from('<?xml version="1.0" encoding="utf-8"?><DOCUMENT><TITLE>단일판매ㆍ공급계약체결</TITLE><TABLE><TR><TD>계약금액(원)</TD><TD>1,500,000,000,000</TD></TR><TR><TD>매출액대비(%)</TD><TD>15.2</TD></TR></TABLE></DOCUMENT>', 'utf-8'))
    const body = zip.toBuffer()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) })))
    const out = await getDisclosureDocument({ rcept_no: '20261105800002' })
    expect(out.text).toContain('계약금액(원) | 1,500,000,000,000'); expect(out.truncated).toBe(false); expect(out.files[0].name).toBe('20261105800002.xml')
    const kw = await getDisclosureDocument({ rcept_no: '20261105800002', keyword: '매출액대비' })
    expect(kw.matches).toBe(1); expect(kw.snippets[0].text).toContain('15.2')
    await expect(getDisclosureDocument({ rcept_no: '123' })).rejects.toThrow('14자리')
    const err = Buffer.from('<?xml version="1.0"?><result><status>014</status><message>파일이 존재하지 않습니다.</message></result>')
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, arrayBuffer: async () => err.buffer.slice(err.byteOffset, err.byteOffset + err.byteLength) })))
    await expect(getDisclosureDocument({ rcept_no: '20261105800002' })).rejects.toThrow('014')
  })
})
