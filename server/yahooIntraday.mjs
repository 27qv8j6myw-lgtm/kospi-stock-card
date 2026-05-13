/**
 * Yahoo Finance chart API — 당일 분봉 (비공식, 서버 전용).
 * https://query1.finance.yahoo.com/v8/finance/chart/{SYMBOL}?interval=5m&range=1d
 */

const UA =
  'Mozilla/5.0 (compatible; KospiStockCard/1.0; +https://localhost) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const SESSION_START_MIN = 9 * 60 // 09:00
const SESSION_END_MIN = 15 * 60 + 30 // 15:30

function kstDateParts(d = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = fmt.formatToParts(d)
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970'
  const m = parts.find((p) => p.type === 'month')?.value ?? '01'
  const day = parts.find((p) => p.type === 'day')?.value ?? '01'
  return { y, m, day, iso: `${y}-${m}-${day}` }
}

/** KST 기준 분 단위 (0~1439) */
function kstMinutesFromDate(d = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const s = fmt.format(d)
  const [hh, mm] = s.split(':').map((x) => parseInt(x, 10))
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 12 * 60
  return hh * 60 + mm
}

export function krxMarketStatus(now = new Date()) {
  const mins = kstMinutesFromDate(now)
  if (mins < SESSION_START_MIN) return 'pre_open'
  if (mins > SESSION_END_MIN) return 'closed'
  return 'open'
}

function minutesToHHMM(totalMin) {
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** 정규장 슬롯 offset(분): 9:00 기준 step분 간격, 마지막 ≤ 15:30 */
export function sessionSlotOffsets(stepMinutes = 5) {
  const step = Math.max(1, Math.min(60, Number(stepMinutes) || 5))
  const max = SESSION_END_MIN - SESSION_START_MIN
  const list = []
  for (let off = step; off <= max; off += step) {
    list.push(off)
  }
  return list
}

/**
 * @param {string} code6
 * @param {'KS'|'KQ'} suffix
 * @param {'1m'|'5m'|'15m'} interval
 */
export async function getIntradayChartFromYahoo(code6, suffix, interval = '5m') {
  const sym = `${String(code6).replace(/\D/g, '').padStart(6, '0')}.${suffix}`
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=${encodeURIComponent(interval)}&range=1d`

  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'application/json',
    },
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`Yahoo 차트 응답 파싱 실패 (${res.status})`)
  }
  if (!res.ok) {
    const msg = json?.chart?.error?.description || `HTTP ${res.status}`
    throw new Error(String(msg))
  }

  const result = json?.chart?.result?.[0]
  if (!result) {
    throw new Error('Yahoo 차트 result 없음')
  }

  const tsArr = Array.isArray(result.timestamp) ? result.timestamp : []
  const quote = result?.indicators?.quote?.[0] || {}
  const closes = Array.isArray(quote.close) ? quote.close : []
  const opens = Array.isArray(quote.open) ? quote.open : []

  const data = []
  for (let i = 0; i < tsArr.length; i++) {
    const tsSec = tsArr[i]
    const close = closes[i]
    if (typeof tsSec !== 'number' || close == null || !Number.isFinite(Number(close))) continue
    const ms = tsSec * 1000
    const kstMin = kstMinutesFromDate(new Date(ms))
    const sessionOff = kstMin - SESSION_START_MIN
    if (sessionOff < 0 || sessionOff > SESSION_END_MIN - SESSION_START_MIN) continue
    data.push({
      time: minutesToHHMM(kstMin),
      timestamp: ms,
      price: Math.round(Number(close)),
      sessionMinuteOffset: sessionOff, // 9:00 이후 경과 분 (5 이상)
    })
  }

  data.sort((a, b) => a.timestamp - b.timestamp)

  let openPrice = null
  if (data.length) {
    const first = data[0]
    const o0 = opens[0]
    openPrice =
      o0 != null && Number.isFinite(Number(o0)) ? Math.round(Number(o0)) : first.price
  }

  const metaOpen = result?.meta?.chartPreviousClose ?? result?.meta?.previousClose
  if (openPrice == null && metaOpen != null && Number.isFinite(Number(metaOpen))) {
    openPrice = Math.round(Number(metaOpen))
  }

  const { iso } = kstDateParts()
  const marketStatus = krxMarketStatus()

  return {
    date: iso,
    openPrice: openPrice ?? 0,
    marketStatus,
    interval,
    suffix,
    data,
  }
}

/**
 * Recharts용 시리즈 — forward-fill, 장 시작 전·미래 구간 null
 * @param {ReturnType<typeof getIntradayChartFromYahoo>} yahooResult
 */
export function buildIntradaySlotSeries(yahooResult, marketStatusOverride, stepMinutes = 5) {
  const marketStatus = marketStatusOverride || yahooResult.marketStatus
  const openPrice = yahooResult.openPrice || 0
  const offsets = sessionSlotOffsets(stepMinutes)
  const sorted = [...yahooResult.data].sort((a, b) => a.sessionMinuteOffset - b.sessionMinuteOffset)

  const nowOff =
    marketStatus === 'closed'
      ? SESSION_END_MIN - SESSION_START_MIN
      : Math.min(
          Math.max(0, kstMinutesFromDate() - SESSION_START_MIN),
          SESSION_END_MIN - SESSION_START_MIN,
        )

  let j = 0
  let carry = null
  const series = []
  for (const off of offsets) {
    while (j < sorted.length && sorted[j].sessionMinuteOffset <= off) {
      carry = sorted[j].price
      j += 1
    }
    let value = null
    if (marketStatus !== 'pre_open' && off <= nowOff) {
      value = carry
    }
    series.push({
      x: off,
      time: minutesToHHMM(SESSION_START_MIN + off),
      value,
    })
  }

  return { series, openPrice, marketStatus, date: yahooResult.date, stepMinutes }
}

export { SESSION_START_MIN, SESSION_END_MIN }

/**
 * @param {string} code6
 * @param {'1m'|'5m'|'15m'} interval
 * @param {'KS'|'KQ'} preferredSuffix
 */
export async function getIntradayChart(code6, interval = '5m', preferredSuffix = 'KS') {
  const order = preferredSuffix === 'KQ' ? ['KQ', 'KS'] : ['KS', 'KQ']
  const step = interval === '1m' ? 1 : interval === '15m' ? 15 : 5
  let lastErr = null
  for (const suffix of order) {
    try {
      const raw = await getIntradayChartFromYahoo(code6, suffix, interval)
      const built = buildIntradaySlotSeries(raw, null, step)
      const data = raw.data.map(({ time, timestamp, price }) => ({ time, timestamp, price }))
      return {
        date: built.date,
        openPrice: built.openPrice,
        marketStatus: built.marketStatus,
        data,
        interval,
        suffix,
        series: built.series,
        stepMinutes: built.stepMinutes,
      }
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr || '당일 차트 조회 실패'))
}
