/**
 * MCP 커넥터 공시 — OpenDART(금융감독원 전자공시) 로 공시 목록과 원문을 직접 가져온다.
 *
 * 메우려는 빈칸: 실적 발표일(결산실적공시예고·IR 개최), 잠정실적, 수주(단일판매ㆍ공급계약),
 * 블록딜·지분 변동(대량보유·임원 주요주주), 증자·CB 같은 희석 공시.
 * 종목코드 → DART 고유번호(corp_code)는 정기보고서 목록(list.json)을 훑어 만든다.
 * corpCode.xml 은 내려받는 데 1~2분이 걸려 서버리스 제한 시간(60초)을 넘기므로 쓰지 않는다.
 * 만든 표는 인스턴스 메모리와 임시 파일에 7일 보관한다. 모든 호출에는 제한 시간이 있다.
 * DART_API_KEY 가 필요하다 (opendart.fss.or.kr 무료 발급, 하루 20,000건).
 */
import AdmZip from 'adm-zip'
import { readFile, writeFile, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const BASE = 'https://opendart.fss.or.kr/api'
const VIEWER = 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo='
const CORP_TTL_MS = 7 * 24 * 60 * 60 * 1000
const CORP_TMP = path.join(os.tmpdir(), 'signal15-dart-corp-map-v2.json')
const LIST_TIMEOUT_MS = 12_000
const DOC_TIMEOUT_MS = 25_000
const MAP_BUDGET_MS = 30_000

/** 공시유형(pblntf_ty) */
export const DISCLOSURE_TYPES = {
  periodic: 'A', // 정기공시 (사업·반기·분기보고서)
  major: 'B', // 주요사항보고 (증자·CB·합병 등)
  issuance: 'C', // 발행공시
  ownership: 'D', // 지분공시 (대량보유·임원 주요주주)
  other: 'E', // 기타공시 (자기주식 등)
  audit: 'F', // 외부감사
  fund: 'G', // 펀드
  abs: 'H', // 자산유동화
  exchange: 'I', // 거래소공시 (잠정실적·공급계약·실적예고·IR)
  ftc: 'J', // 공정위공시
}

/** 제목으로 붙이는 태그 — 순서대로 전부 검사 */
const TAG_RULES = [
  ['earnings', /영업\(잠정\)실적|매출액또는손익구조|연결재무제표기준영업|실적\(공정공시\)/],
  ['earnings_schedule', /결산실적공시예고|기업설명회\(IR\)|실적발표/],
  ['guidance', /영업실적등에대한전망|장래사업ㆍ경영계획|장래사업·경영계획/],
  ['order', /단일판매\s*[ㆍ·]\s*공급계약/],
  ['dilution', /유상증자|전환사채|신주인수권부사채|교환사채|전환청구권|신주인수권행사/],
  ['buyback', /자기주식|주식소각/],
  ['dividend', /배당/],
  ['ownership', /대량보유|임원ㆍ주요주주|임원·주요주주|최대주주|주식등의대량/],
  ['periodic', /사업보고서|반기보고서|분기보고서/],
  ['mna', /합병|분할|영업양수|영업양도|타법인주식및출자증권/],
  ['investment', /신규시설투자|유형자산취득|유형자산양수/],
  ['risk', /소송|횡령|배임|거래정지|불성실공시|관리종목|상장폐지|감사의견|회생절차|부도/],
]

const clean = (v) => String(v ?? '').trim().replace(/^(["'])(.*)\1$/, '$2').trim()

function apiKey() {
  const key = clean(process.env.DART_API_KEY)
  if (!key) throw new Error('DART_API_KEY 가 설정되지 않았습니다 (opendart.fss.or.kr 에서 무료 발급 후 서버 환경변수에 등록)')
  return key
}

export const dartConfigured = () => Boolean(clean(process.env.DART_API_KEY))

/** KST 기준 YYYYMMDD (offsetDays 만큼 과거) */
export function kstYmd(offsetDays = 0, now = Date.now()) {
  return new Date(now + 9 * 3600_000 - offsetDays * 86_400_000).toISOString().slice(0, 10).replaceAll('-', '')
}

const dash = (ymd) => (ymd && ymd.length === 8 ? `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}` : ymd ?? null)

/** @param {string} reportName */
export function classifyReport(reportName) {
  const name = String(reportName ?? '')
  const tags = TAG_RULES.filter(([, re]) => re.test(name)).map(([tag]) => tag)
  return { tags, correction: /^\s*\[[^\]]*정정/.test(name) }
}

/** 제한 시간이 있는 fetch — DART 가 느릴 때 함수 전체가 멈추지 않게 한다 */
async function timedFetch(url, ms, what) {
  try {
    return await fetch(url, { signal: AbortSignal.timeout(ms) })
  } catch (e) {
    const name = e instanceof Error ? e.name : ''
    if (name === 'TimeoutError' || name === 'AbortError') throw new Error(`DART ${what} 응답 지연 (${Math.round(ms / 1000)}초 초과) — 잠시 뒤 다시 시도하세요`)
    throw new Error(`DART ${what} 연결 실패: ${e instanceof Error ? e.message : String(e)}`)
  }
}

/** @type {Record<string, {corpCode: string, name: string}> | null} */
let corpMap = null
let corpMapAt = 0
/** @type {Promise<Record<string, {corpCode: string, name: string}>> | null} */
let corpMapBuilding = null

/** 테스트·사전 주입용 */
export function setCorpMap(map) {
  corpMap = map
  corpMapAt = map ? Date.now() : 0
  corpMapBuilding = null
}

/** 목록 행에서 종목코드 ↔ 고유번호를 배운다 (시장 전체 조회 때도 호출) */
function learn(map, rows) {
  for (const r of rows) {
    const stock = String(r.stock_code ?? '').trim().toUpperCase()
    const corpCode = String(r.corp_code ?? '').trim()
    if (/^[0-9A-Z]{6}$/.test(stock) && /^\d{8}$/.test(corpCode) && !map[stock]) map[stock] = { corpCode, name: r.corp_name }
  }
}

const ymdMinus = (ymd, days) => new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8)) - days * 86_400_000).toISOString().slice(0, 10).replaceAll('-', '')

/**
 * 정기보고서(사업·반기·분기) 목록을 시장별로 훑어 상장사 고유번호 표를 만든다.
 * 최근 90일에 제출 마감이 없을 수 있어(11월 중순~3월 말) 부족하면 그 앞 90일도 본다.
 * @param {number} [now]
 */
export async function buildCorpMap(now = Date.now()) {
  /** @type {Record<string, {corpCode: string, name: string}>} */
  const map = {}
  const deadline = Date.now() + MAP_BUDGET_MS
  const end = kstYmd(0, now)
  const windows = [[ymdMinus(end, 89), end], [ymdMinus(end, 179), ymdMinus(end, 90)]]
  for (const [bgn, fin] of windows) {
    await Promise.all(['Y', 'K', 'N'].map(async (cls) => {
      const base = { pblntf_ty: 'A', corp_cls: cls, bgn_de: bgn, end_de: fin, last_reprt_at: 'Y', page_count: 100 }
      const first = await fetchList({ ...base, page_no: 1 })
      learn(map, first.list)
      const pages = []
      for (let p = 2; p <= Math.min(first.totalPage, 40); p += 1) pages.push(p)
      for (let i = 0; i < pages.length && Date.now() < deadline; i += 5) {
        const outs = await Promise.all(pages.slice(i, i + 5).map((p) => fetchList({ ...base, page_no: p }).catch(() => ({ list: [] }))))
        for (const o of outs) learn(map, o.list)
      }
    }))
    if (Object.keys(map).length >= 1500 || Date.now() >= deadline) break
  }
  return map
}

async function loadCorpMap() {
  if (corpMap && Date.now() - corpMapAt < CORP_TTL_MS) return corpMap
  try {
    const st = await stat(CORP_TMP)
    if (Date.now() - st.mtimeMs < CORP_TTL_MS) {
      corpMap = JSON.parse(await readFile(CORP_TMP, 'utf-8'))
      corpMapAt = st.mtimeMs
      return corpMap
    }
  } catch { /* 임시 파일 없음 */ }
  corpMapBuilding ??= buildCorpMap().finally(() => { corpMapBuilding = null })
  const built = await corpMapBuilding
  if (Object.keys(built).length) {
    corpMap = built
    corpMapAt = Date.now()
    writeFile(CORP_TMP, JSON.stringify(built)).catch(() => {})
  }
  return built
}

/** ZIP 대신 온 오류 본문(XML/JSON)에서 메시지 추출 */
function dartErrorText(buf) {
  const text = buf.toString('utf-8').slice(0, 500)
  const status = text.match(/<status>([^<]*)<\/status>/)?.[1] ?? text.match(/"status"\s*:\s*"([^"]*)"/)?.[1]
  const message = text.match(/<message>([^<]*)<\/message>/)?.[1] ?? text.match(/"message"\s*:\s*"([^"]*)"/)?.[1]
  return status || message ? `${status ?? ''} ${message ?? ''}`.trim() : text.replace(/\s+/g, ' ').slice(0, 120)
}

/**
 * list.json 한 페이지
 * @param {Record<string, string | number | undefined>} params
 */
async function fetchList(params) {
  const qs = new URLSearchParams({ crtfc_key: apiKey() })
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') qs.set(k, String(v))
  const res = await timedFetch(`${BASE}/list.json?${qs}`, LIST_TIMEOUT_MS, '공시 목록')
  if (!res.ok) throw new Error(`DART list HTTP ${res.status}`)
  const body = await res.json()
  if (body.status === '013') return { list: [], totalCount: 0, totalPage: 0 }
  if (body.status !== '000') throw new Error(`DART ${body.status}: ${body.message}`)
  return { list: body.list ?? [], totalCount: Number(body.total_count) || 0, totalPage: Number(body.total_page) || 1 }
}

const MARKET = { Y: 'KOSPI', K: 'KOSDAQ', N: 'KONEX', E: '기타' }

function toRow(r) {
  const reportName = String(r.report_nm ?? '').trim()
  const { tags, correction } = classifyReport(reportName)
  return {
    date: dash(r.rcept_dt),
    code: r.stock_code || null,
    name: r.corp_name,
    market: MARKET[r.corp_cls] ?? r.corp_cls ?? null,
    report: reportName,
    filer: r.flr_nm,
    tags,
    correction,
    remark: r.rm || null,
    rceptNo: r.rcept_no,
    url: `${VIEWER}${r.rcept_no}`,
  }
}

function summarize(rows) {
  /** @type {Record<string, number>} */
  const byTag = {}
  for (const r of rows) for (const t of r.tags) byTag[t] = (byTag[t] ?? 0) + 1
  const pick = (tag) => rows.filter((r) => r.tags.includes(tag)).slice(0, 5).map((r) => ({ date: r.date, code: r.code, name: r.name, report: r.report, rceptNo: r.rceptNo }))
  return { count: rows.length, byTag, earningsSchedule: pick('earnings_schedule'), earnings: pick('earnings'), orders: pick('order'), risks: pick('risk') }
}

function resolveRange({ start_date, end_date, days }, defaultDays) {
  const end = end_date || kstYmd(0)
  let start = start_date
  if (!start) {
    const endMs = Date.UTC(+end.slice(0, 4), +end.slice(4, 6) - 1, +end.slice(6, 8))
    start = new Date(endMs - ((days ?? defaultDays) - 1) * 86_400_000).toISOString().slice(0, 10).replaceAll('-', '')
  }
  if (start > end) throw new Error('start_date 가 end_date 보다 늦습니다')
  return { start, end }
}

function matcher({ keyword, tags }) {
  const kw = String(keyword ?? '').trim().toLowerCase()
  const want = Array.isArray(tags) && tags.length ? new Set(tags) : null
  return (row) => (!kw || row.report.toLowerCase().includes(kw) || String(row.name).toLowerCase().includes(kw)) && (!want || row.tags.some((t) => want.has(t)))
}

/**
 * 공시 목록. codes 가 있으면 종목별(기본 최근 90일), 없으면 시장 전체(기본 오늘, 최대 7일)에서 찾는다.
 * @param {{codes?: string[], days?: number, start_date?: string, end_date?: string, type?: keyof typeof DISCLOSURE_TYPES,
 *   keyword?: string, tags?: string[], market?: 'KOSPI'|'KOSDAQ', limit?: number, final_only?: boolean}} input
 */
export async function getDisclosures(input = {}) {
  const codes = (input.codes ?? []).map((c) => String(c).trim().toUpperCase())
  const limit = Math.min(Math.max(input.limit ?? 40, 1), 200)
  const typeCode = input.type ? DISCLOSURE_TYPES[input.type] : undefined
  const match = matcher(input)
  const base = { retrievedAt: new Date().toISOString(), timezone: 'Asia/Seoul', source: 'OpenDART (금융감독원 전자공시)' }
  const common = { pblntf_ty: typeCode, last_reprt_at: input.final_only ? 'Y' : 'N', sort: 'date', sort_mth: 'desc', page_count: 100 }

  if (!codes.length) {
    const { start, end } = resolveRange(input, 1)
    const spanDays = (Date.UTC(+end.slice(0, 4), +end.slice(4, 6) - 1, +end.slice(6, 8)) - Date.UTC(+start.slice(0, 4), +start.slice(4, 6) - 1, +start.slice(6, 8))) / 86_400_000
    if (spanDays > 6) throw new Error('codes 없이 시장 전체를 볼 때는 기간이 최대 7일입니다')
    const corpCls = input.market === 'KOSPI' ? 'Y' : input.market === 'KOSDAQ' ? 'K' : undefined
    const MAX_PAGES = 8
    const rows = []
    let page = 1, totalPage = 1, totalCount = 0
    while (page <= totalPage && page <= MAX_PAGES && rows.length < limit) {
      const out = await fetchList({ ...common, bgn_de: start, end_de: end, corp_cls: corpCls, page_no: page })
      totalPage = out.totalPage
      totalCount = out.totalCount
      if (corpMap) learn(corpMap, out.list)
      for (const r of out.list) {
        if (!r.stock_code) continue // 비상장 제외
        const row = toRow(r)
        if (match(row)) rows.push(row)
      }
      page += 1
    }
    const sliced = rows.slice(0, limit)
    return {
      ...base,
      scope: 'market',
      period: { start: dash(start), end: dash(end) },
      scanned: { pages: page - 1, totalPages: totalPage, totalFilings: totalCount, complete: page > totalPage },
      summary: summarize(sliced),
      disclosures: sliced,
      note: '시장 전체 조회는 최신순으로 최대 800건까지만 훑습니다. scanned.complete=false 면 type·market·기간으로 좁혀 다시 부르세요. 비상장사는 제외했습니다.',
    }
  }

  const { start, end } = resolveRange(input, 90)
  const map = await loadCorpMap()
  const perCode = Math.max(1, Math.ceil(limit / codes.length))
  const results = await Promise.all(codes.map(async (code) => {
    const corp = map[code]
    if (!corp) return { code, error: 'DART 고유번호를 찾지 못했습니다 (최근 6개월 정기보고서가 없는 종목 — ETF·신규 상장·종목코드 오류)' }
    try {
      const rows = []
      let page = 1, totalPage = 1, totalCount = 0
      while (page <= totalPage && page <= 5 && rows.length < perCode) {
        const out = await fetchList({ ...common, corp_code: corp.corpCode, bgn_de: start, end_de: end, page_no: page })
        totalPage = out.totalPage
        totalCount = out.totalCount
        for (const r of out.list) {
          const row = toRow({ ...r, stock_code: r.stock_code || code })
          if (match(row)) rows.push(row)
        }
        page += 1
      }
      const sliced = rows.slice(0, perCode)
      return { code, name: corp.name, totalFilings: totalCount, summary: summarize(sliced), disclosures: sliced }
    } catch (e) {
      return { code, name: corp.name, error: e instanceof Error ? e.message : String(e) }
    }
  }))
  return {
    ...base,
    scope: 'codes',
    period: { start: dash(start), end: dash(end) },
    results,
    note: 'tags: earnings(잠정실적·손익구조변동) · earnings_schedule(결산실적공시예고·IR 개최 — 실적 발표일 확인용) · guidance · order(단일판매ㆍ공급계약) · dilution(증자·CB) · buyback · dividend · ownership(대량보유·임원 주요주주) · periodic · mna · investment · risk. 숫자는 get_disclosure_document 로 원문을 열어 확인하세요.',
  }
}

const ENTITIES = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'" }

/**
 * DART 원문(XML/HTML 마크업) → 읽을 수 있는 텍스트. 표는 행마다 한 줄, 칸은 ' | ' 로 구분.
 * @param {string} markup
 */
export function documentToText(markup) {
  return String(markup ?? '')
    .replace(/<\?xml[^>]*\?>/gi, '')
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/(td|th|tu|te)\s*>/gi, ' | ')
    .replace(/<\/(tr|p|title|table|div|li|h[1-6]|section-\d|cover-title|pgbrk)\s*>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(nbsp|amp|lt|gt|quot|apos|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/[ \t ]+/g, ' ')
    .replace(/ ?\| ?(?=\n|$)/g, '')
    .replace(/\n[ |]*(?=\n)/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

function decodeEntry(buf) {
  const head = buf.subarray(0, 200).toString('latin1')
  const enc = head.match(/encoding=["']([^"']+)["']/i)?.[1]?.toLowerCase()
  if (enc && enc !== 'utf-8' && enc !== 'utf8') {
    try { return new TextDecoder(enc).decode(buf) } catch { /* 모르는 인코딩이면 utf-8 */ }
  }
  return buf.toString('utf-8')
}

/**
 * 공시 원문 텍스트. keyword 를 주면 그 주변만 발췌한다.
 * @param {{rcept_no: string, max_chars?: number, offset?: number, keyword?: string, file?: number}} input
 */
export async function getDisclosureDocument(input) {
  const rceptNo = String(input?.rcept_no ?? '').trim()
  if (!/^\d{14}$/.test(rceptNo)) throw new Error('rcept_no 는 14자리 접수번호입니다 (get_disclosures 의 rceptNo)')
  const maxChars = Math.min(Math.max(input.max_chars ?? 6000, 500), 20000)
  const offset = Math.max(input.offset ?? 0, 0)
  const res = await timedFetch(`${BASE}/document.xml?crtfc_key=${encodeURIComponent(apiKey())}&rcept_no=${rceptNo}`, DOC_TIMEOUT_MS, '공시 원문')
  if (!res.ok) throw new Error(`DART document HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf[0] !== 0x50 || buf[1] !== 0x4b) throw new Error(`DART 원문 오류: ${dartErrorText(buf)}`)
  const entries = new AdmZip(buf).getEntries().filter((e) => !e.isDirectory)
  if (!entries.length) throw new Error('원문 ZIP 이 비어 있습니다')
  const files = entries.map((e, i) => ({ index: i, name: e.entryName, bytes: e.header.size }))
  const index = Math.min(Math.max(input.file ?? 0, 0), entries.length - 1)
  const text = documentToText(decodeEntry(entries[index].getData()))
  const out = {
    retrievedAt: new Date().toISOString(),
    source: 'OpenDART 공시서류 원본파일',
    rceptNo,
    url: `${VIEWER}${rceptNo}`,
    files,
    file: index,
    totalChars: text.length,
  }
  const keyword = String(input.keyword ?? '').trim()
  if (keyword) {
    const snippets = []
    const lower = text.toLowerCase()
    const kw = keyword.toLowerCase()
    let from = 0, used = 0
    while (snippets.length < 8 && used < maxChars) {
      const at = lower.indexOf(kw, from)
      if (at < 0) break
      const s = Math.max(0, at - 300)
      const e = Math.min(text.length, at + kw.length + 700)
      snippets.push({ at, text: text.slice(s, e) })
      used += e - s
      from = e
    }
    return { ...out, keyword, matches: snippets.length, snippets }
  }
  const slice = text.slice(offset, offset + maxChars)
  return { ...out, offset, returnedChars: slice.length, truncated: offset + slice.length < text.length, nextOffset: offset + slice.length < text.length ? offset + slice.length : null, text: slice }
}
