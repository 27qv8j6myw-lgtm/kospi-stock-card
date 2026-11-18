/**
 * MCP 커넥터 거시지표 — 미국은 FRED(세인트루이스 연준), 한국은 ECOS(한국은행 경제통계시스템).
 *
 * 메우려는 빈칸: CPI·PPI·고용·금리 같은 지표의 실제 수치와 다음 발표일, 한국 기준금리·환율·물가.
 * 기사 제목이 아니라 원자료 값을 그대로 돌려준다. FRED_API_KEY · ECOS_API_KEY 가 필요하다 (둘 다 무료).
 * 모든 호출에 제한 시간이 있고, 오류 메시지에는 키가 들어간 주소를 넣지 않는다.
 */
const FRED = 'https://api.stlouisfed.org/fred'
const ECOS = 'https://ecos.bok.or.kr/api'
const TIMEOUT_MS = 12_000

const clean = (v) => String(v ?? '').trim().replace(/^(["'])(.*)\1$/, '$2').trim()
export const fredConfigured = () => Boolean(clean(process.env.FRED_API_KEY))
export const ecosConfigured = () => Boolean(clean(process.env.ECOS_API_KEY))

function key(name, where) {
  const k = clean(process.env[name])
  if (!k) throw new Error(`${name} 가 설정되지 않았습니다 (${where} 에서 무료 발급 후 서버 환경변수에 등록)`)
  return k
}

async function getJson(url, what) {
  let res
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch (e) {
    const name = e instanceof Error ? e.name : ''
    if (name === 'TimeoutError' || name === 'AbortError') throw new Error(`${what} 응답 지연 (${TIMEOUT_MS / 1000}초 초과)`)
    throw new Error(`${what} 연결 실패`)
  }
  let body = null
  try { body = await res.json() } catch { /* JSON 아님 */ }
  if (!res.ok) throw new Error(`${what} HTTP ${res.status}${body?.error_message ? `: ${body.error_message}` : ''}`)
  if (body == null) throw new Error(`${what} 응답을 읽지 못했습니다`)
  return body
}

const round = (n, d = 4) => (n == null || !Number.isFinite(n) ? null : Math.round(n * 10 ** d) / 10 ** d)
const num = (v) => {
  const n = Number(String(v ?? '').replaceAll(',', ''))
  return String(v ?? '').trim() === '' || String(v).trim() === '.' || !Number.isFinite(n) ? null : n
}
const todayKst = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

/* ───────────────────────── FRED ───────────────────────── */

/** 자주 쓰는 이름 → FRED 시리즈 ID. 그 밖에는 FRED ID 를 그대로 넣는다. */
export const FRED_ALIASES = {
  CPI: 'CPIAUCSL', CORE_CPI: 'CPILFESL', PPI: 'PPIFIS', CORE_PPI: 'PPIFES', PCE: 'PCEPI', CORE_PCE: 'PCEPILFE',
  UNEMPLOYMENT: 'UNRATE', PAYROLLS: 'PAYEMS', JOBLESS_CLAIMS: 'ICSA', RETAIL_SALES: 'RSAFS', INDUSTRIAL_PRODUCTION: 'INDPRO',
  GDP: 'GDPC1', GDP_GROWTH: 'A191RL1Q225SBEA', CONSUMER_SENTIMENT: 'UMCSENT',
  FED_FUNDS: 'DFF', FED_TARGET_UPPER: 'DFEDTARU', FED_TARGET_LOWER: 'DFEDTARL',
  UST2Y: 'DGS2', UST10Y: 'DGS10', UST30Y: 'DGS30', YIELD_CURVE_10Y2Y: 'T10Y2Y', BREAKEVEN_10Y: 'T10YIE',
  HY_SPREAD: 'BAMLH0A0HYM2', DOLLAR_INDEX_BROAD: 'DTWEXBGS', WTI: 'DCOILWTICO', VIX: 'VIXCLS',
}

const YOY_LAG = { M: 12, Q: 4, SA: 2, A: 1 }

async function fredGet(path, params) {
  const qs = new URLSearchParams({ ...params, api_key: key('FRED_API_KEY', 'fred.stlouisfed.org'), file_type: 'json' })
  return getJson(`${FRED}/${path}?${qs}`, 'FRED')
}

/** 관측값(오래된 순)에 직전 대비·전년 대비를 붙인다. 단위가 % 인 지표는 %p 차이만 낸다. */
export function withChanges(obs, lag, isRate) {
  return obs.map((o, i) => {
    const prev = i > 0 ? obs[i - 1].value : null
    const ago = lag && i >= lag ? obs[i - lag].value : null
    const out = { date: o.date, value: o.value }
    if (o.value != null && prev != null) {
      out.change = round(o.value - prev)
      if (!isRate && prev !== 0) out.pctChange = round(((o.value - prev) / Math.abs(prev)) * 100, 2)
    }
    if (o.value != null && ago != null) {
      out.yoyChange = round(o.value - ago)
      if (!isRate && ago !== 0) out.yoyPct = round(((o.value - ago) / Math.abs(ago)) * 100, 2)
    }
    return out
  })
}

async function fredSeries(input, limit, includeRelease) {
  const requested = String(input).trim()
  const id = FRED_ALIASES[requested.toUpperCase()] ?? requested.toUpperCase()
  if (!/^[A-Z0-9_.\-]{1,40}$/.test(id)) return { requested, error: 'FRED 시리즈 ID 형식이 아닙니다' }
  try {
    const info = (await fredGet('series', { series_id: id })).seriess?.[0]
    if (!info) return { requested, seriesId: id, error: 'FRED 에 없는 시리즈입니다' }
    const freq = String(info.frequency_short ?? '').toUpperCase()
    const lag = YOY_LAG[freq] ?? 0
    const isRate = /percent|rate/i.test(String(info.units ?? '')) && !/index/i.test(String(info.units ?? ''))
    const [obsBody, release] = await Promise.all([
      fredGet('series/observations', { series_id: id, sort_order: 'desc', limit: String(limit + Math.max(lag, 1) + 5) }),
      includeRelease ? fredNextRelease(id).catch(() => null) : null,
    ])
    const asc = (obsBody.observations ?? []).map((o) => ({ date: o.date, value: num(o.value) })).filter((o) => o.value != null).reverse()
    const observations = withChanges(asc, lag, isRate).slice(-limit)
    return {
      requested, seriesId: id, title: info.title, frequency: info.frequency, units: info.units,
      seasonalAdjustment: info.seasonal_adjustment_short ?? null, lastUpdated: info.last_updated ?? null,
      latest: observations.at(-1) ?? null, observations,
      ...(includeRelease ? { release } : {}),
      url: `https://fred.stlouisfed.org/series/${id}`,
    }
  } catch (e) {
    return { requested, seriesId: id, error: e instanceof Error ? e.message : String(e) }
  }
}

async function fredNextRelease(id) {
  const rel = (await fredGet('series/release', { series_id: id })).releases?.[0]
  if (!rel) return null
  const today = todayKst()
  const dates = (await fredGet('release/dates', {
    release_id: String(rel.id), realtime_start: today, realtime_end: '9999-12-31',
    include_release_dates_with_no_data: 'true', sort_order: 'asc', limit: '3',
  })).release_dates ?? []
  return { name: rel.name, upcoming: dates.map((d) => d.date).filter((d) => d >= today) }
}

/**
 * 미국 거시지표 (FRED)
 * @param {{series?: string[], limit?: number, include_release?: boolean}} input
 */
export async function getUsMacro(input = {}) {
  const series = input.series?.length ? input.series : ['CPI', 'CORE_CPI', 'PPI', 'UNEMPLOYMENT', 'PAYROLLS', 'FED_TARGET_UPPER', 'UST10Y']
  const limit = Math.min(Math.max(input.limit ?? 6, 1), 120)
  key('FRED_API_KEY', 'fred.stlouisfed.org')
  const results = await Promise.all(series.slice(0, 10).map((s) => fredSeries(s, limit, input.include_release !== false)))
  return {
    retrievedAt: new Date().toISOString(),
    source: 'FRED (Federal Reserve Bank of St. Louis)',
    results,
    aliases: Object.keys(FRED_ALIASES),
    note: 'observations 는 오래된 순입니다. change·pctChange 는 직전 관측 대비, yoyChange·yoyPct 는 1년 전 대비(월·분기 지표)이며 단위가 % 인 지표는 %p 차이(change·yoyChange)만 줍니다. 지수형 물가(CPI 등)의 발표 헤드라인은 pctChange(전월 대비)·yoyPct(전년 대비)입니다. release.upcoming 은 FRED 가 아는 다음 발표 예정일(미국 날짜)이고 비어 있으면 확인 못 한 것입니다. 발표 당일에는 반영이 수십 분 늦을 수 있습니다.',
  }
}

/* ───────────────────────── ECOS ───────────────────────── */

/** 자주 쓰는 지표. 값이 비면 mode=search → items 로 코드를 다시 찾는다. */
export const ECOS_ALIASES = {
  base_rate: { stat: '722Y001', cycle: 'M', items: ['0101000'], label: '한국은행 기준금리' },
  usdkrw: { stat: '731Y001', cycle: 'D', items: ['0000001'], label: '원/달러 환율(매매기준율)' },
  cpi: { stat: '901Y009', cycle: 'M', items: ['0'], label: '소비자물가지수(총지수)' },
  ktb3y: { stat: '817Y002', cycle: 'D', items: ['010200000'], label: '국고채 3년 금리' },
  ktb10y: { stat: '817Y002', cycle: 'D', items: ['010210000'], label: '국고채 10년 금리' },
}

async function ecosGet(service, parts) {
  const k = key('ECOS_API_KEY', 'ecos.bok.or.kr')
  const body = await getJson(`${ECOS}/${service}/${k}/json/kr/${parts.map((p) => encodeURIComponent(p)).join('/')}`, 'ECOS')
  if (body.RESULT) {
    if (body.RESULT.CODE === 'INFO-200') return { total: 0, rows: [] }
    throw new Error(`ECOS ${body.RESULT.CODE}: ${body.RESULT.MESSAGE}`)
  }
  const data = body[service]
  if (!data) throw new Error('ECOS 응답 형식이 예상과 다릅니다')
  return { total: Number(data.list_total_count) || 0, rows: data.row ?? [] }
}

/** 주기별 기본 조회 범위 (끝=오늘, 시작=충분히 과거) */
export function ecosRange(cycle, now = Date.now()) {
  const d = new Date(now + 9 * 3600_000)
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1
  const pad = (n) => String(n).padStart(2, '0')
  if (cycle === 'D') {
    const s = new Date(d.getTime() - 45 * 86_400_000)
    return [`${s.getUTCFullYear()}${pad(s.getUTCMonth() + 1)}${pad(s.getUTCDate())}`, `${y}${pad(m)}${pad(d.getUTCDate())}`]
  }
  if (cycle === 'M') return [`${y - 2}${pad(m)}`, `${y}${pad(m)}`]
  if (cycle === 'Q') return [`${y - 3}Q1`, `${y}Q${Math.ceil(m / 3)}`]
  return [`${y - 8}`, `${y}`]
}

const includes = (text, kw) => !kw || String(text ?? '').toLowerCase().includes(kw)

/**
 * 한국 거시지표 (한국은행 ECOS)
 * @param {{mode?: 'key'|'series'|'search'|'items', indicator?: string, keyword?: string, stat_code?: string, item_codes?: string[],
 *   cycle?: 'D'|'M'|'Q'|'A', start?: string, end?: string, limit?: number}} input
 */
export async function getKrMacro(input = {}) {
  const mode = input.mode ?? (input.indicator || input.stat_code ? 'series' : 'key')
  const kw = String(input.keyword ?? '').trim().toLowerCase()
  const base = { retrievedAt: new Date().toISOString(), source: '한국은행 경제통계시스템(ECOS)', mode }

  if (mode === 'key') {
    const { rows } = await ecosGet('KeyStatisticList', ['1', '100'])
    const indicators = rows
      .filter((r) => includes(r.KEYSTAT_NAME, kw) || includes(r.CLASS_NAME, kw))
      .map((r) => ({ group: r.CLASS_NAME, name: r.KEYSTAT_NAME, value: num(r.DATA_VALUE), unit: r.UNIT_NAME || null, period: r.CYCLE || null }))
    return { ...base, count: indicators.length, indicators, note: '한국은행 100대 통계지표의 최신값입니다. period 는 그 값의 기준 시점(YYYYMMDD·YYYYMM·YYYYQn·YYYY)입니다. 시계열이 필요하면 mode=series 를 쓰세요.' }
  }

  if (mode === 'search') {
    if (!kw) throw new Error('mode=search 에는 keyword 가 필요합니다 (예: 소비자물가, 수출, 경상수지)')
    const { rows } = await ecosGet('StatisticTableList', ['1', '1000'])
    const tables = rows.filter((r) => r.SRCH_YN === 'Y' && includes(r.STAT_NAME, kw)).slice(0, 40)
      .map((r) => ({ statCode: r.STAT_CODE, name: r.STAT_NAME, cycle: r.CYCLE || null, org: r.ORG_NAME || null }))
    return { ...base, keyword: input.keyword, count: tables.length, tables, note: '통계표 코드를 찾았으면 mode=items 로 항목코드를 확인한 뒤 mode=series 로 조회하세요.' }
  }

  if (mode === 'items') {
    if (!input.stat_code) throw new Error('mode=items 에는 stat_code 가 필요합니다')
    const { rows, total } = await ecosGet('StatisticItemList', ['1', '1000', input.stat_code])
    const items = rows.filter((r) => includes(r.ITEM_NAME, kw)).slice(0, 80)
      .map((r) => ({ group: r.GRP_NAME || null, itemCode: r.ITEM_CODE, name: r.ITEM_NAME, parent: r.P_ITEM_CODE || null, cycle: r.CYCLE, start: r.START_TIME, end: r.END_TIME, unit: r.UNIT_NAME || null }))
    return { ...base, statCode: input.stat_code, total, count: items.length, items }
  }

  const alias = input.indicator ? ECOS_ALIASES[String(input.indicator).toLowerCase()] : null
  if (input.indicator && !alias) throw new Error(`indicator 는 ${Object.keys(ECOS_ALIASES).join(' · ')} 중 하나입니다. 그 밖에는 stat_code 를 쓰세요`)
  const stat = input.stat_code ?? alias?.stat
  if (!stat) throw new Error('mode=series 에는 indicator 또는 stat_code 가 필요합니다')
  const cycle = input.cycle ?? alias?.cycle ?? 'M'
  const items = input.item_codes?.length ? input.item_codes : alias?.items ?? []
  const [defStart, defEnd] = ecosRange(cycle)
  const start = input.start ?? defStart
  const end = input.end ?? defEnd
  const limit = Math.min(Math.max(input.limit ?? 12, 1), 500)
  const { rows, total } = await ecosGet('StatisticSearch', ['1', '1000', stat, cycle, start, end, ...items.slice(0, 4)])
  /** 항목별로 묶는다 (항목코드를 안 주면 표 안의 여러 항목이 함께 온다) */
  const groups = new Map()
  for (const r of rows) {
    const id = [r.ITEM_CODE1, r.ITEM_CODE2, r.ITEM_CODE3, r.ITEM_CODE4].filter(Boolean).join('/')
    if (!groups.has(id)) groups.set(id, { itemCodes: id, name: [r.ITEM_NAME1, r.ITEM_NAME2, r.ITEM_NAME3, r.ITEM_NAME4].filter(Boolean).join(' · '), unit: r.UNIT_NAME || null, obs: [] })
    groups.get(id).obs.push({ date: r.TIME, value: num(r.DATA_VALUE) })
  }
  const lag = YOY_LAG[cycle] ?? 0
  const series = [...groups.values()].slice(0, 12).map((g) => {
    const asc = g.obs.filter((o) => o.value != null).sort((a, b) => a.date.localeCompare(b.date))
    const isRate = /%|퍼센트/.test(String(g.unit ?? ''))
    const observations = withChanges(asc, lag, isRate).slice(-limit)
    return { itemCodes: g.itemCodes, name: g.name, unit: g.unit, latest: observations.at(-1) ?? null, observations }
  })
  return {
    ...base, statCode: stat, statName: rows[0]?.STAT_NAME ?? alias?.label ?? null, cycle, period: { start, end },
    totalRows: total, truncated: total > rows.length, series,
    note: series.length ? 'observations 는 오래된 순입니다. change·pctChange 는 직전 대비, yoy 는 1년 전 대비(월·분기)이며 단위가 % 인 지표는 %p 차이만 줍니다.' : '값이 없습니다. 통계표·항목코드나 기간을 확인하세요 (mode=search → mode=items).',
  }
}
