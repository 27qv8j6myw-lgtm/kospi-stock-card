/**
 * 당일 차트의 시간외 구간 — NXT 프리마켓(08:00~08:50)과 애프터마켓(15:30~20:00).
 *
 * 정규장 구간은 Yahoo 분봉을 쓰고, 시간외만 KIS 통합(UN) 분봉으로 채운다.
 * KIS 분봉 API 는 한 번에 30분치만 주므로 30분 단위로 나눠 받고,
 * 이미 지나간 묶음은 값이 고정되므로 길게 캐시한다.
 */
import { MARKET_DIV_DISPLAY, inquireMinuteBars } from '../kisClient.mjs'

const PRE_OPEN_MIN = 8 * 60
const SESSION_START_MIN = 9 * 60
const SESSION_END_MIN = 15 * 60 + 30
const AFTER_CLOSE_MIN = 20 * 60
const CHUNK_MIN = 30
const CONCURRENCY = 3

function cleanEnv(s) {
  if (typeof s !== 'string') return ''
  let v = s.trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim()
  }
  return v
}

/** @param {Date} [now] 서울 기준 자정부터의 분 */
export function seoulMinutes(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const hh = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
  const mm = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
  return (Number.isFinite(hh) ? hh % 24 : 0) * 60 + (Number.isFinite(mm) ? mm : 0)
}

/** @param {Date} [now] */
function isWeekend(now = new Date()) {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', weekday: 'short' }).format(
    now,
  )
  return wd === 'Sat' || wd === 'Sun'
}

/** 정규장 + NXT 시간외를 합친 거래 시간대 (08:00~20:00 평일) */
export function isDomesticTradingWindow(now = new Date()) {
  if (isWeekend(now)) return false
  const m = seoulMinutes(now)
  return m >= PRE_OPEN_MIN && m <= AFTER_CLOSE_MIN
}

/** @param {number} minute */
function hhmmss(minute) {
  const hh = String(Math.floor(minute / 60)).padStart(2, '0')
  const mm = String(minute % 60).padStart(2, '0')
  return `${hh}${mm}00`
}

/**
 * 받아올 30분 묶음의 끝 시각 목록. 각 커서는 직전 30분을 담아온다.
 * @param {number} nowMin
 */
function chunkCursors(nowMin) {
  /** @type {number[]} */
  const out = []
  if (nowMin > PRE_OPEN_MIN) {
    for (let m = PRE_OPEN_MIN + CHUNK_MIN; m <= SESSION_START_MIN; m += CHUNK_MIN) {
      if (m - CHUNK_MIN <= nowMin) out.push(m)
    }
  }
  if (nowMin > SESSION_END_MIN) {
    const last = Math.min(AFTER_CLOSE_MIN, Math.ceil(nowMin / CHUNK_MIN) * CHUNK_MIN)
    for (let m = SESSION_END_MIN + CHUNK_MIN; m <= last; m += CHUNK_MIN) out.push(m)
  }
  return out
}

/**
 * @param {Array<{ hhmmss: string, price: number, volume: number }>} bars
 * @returns {Array<{ minute: number, price: number }>}
 */
function toPoints(bars) {
  return bars
    .map((b) => {
      const hh = Number(b.hhmmss.slice(0, 2))
      const mm = Number(b.hhmmss.slice(2, 4))
      if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
      // 체결이 없는 분은 전일 종가나 0 이 그대로 내려오므로 거래량으로 걸러낸다
      if (!(b.price > 0) || !(b.volume > 0)) return null
      return { minute: hh * 60 + mm, price: b.price }
    })
    .filter(Boolean)
}

/**
 * 시간외 체결 포인트. 정규장 구간과 NXT 미상장 종목은 빈 배열로 돌려준다.
 * @param {string} code6
 * @param {Date} [now]
 * @returns {Promise<{ pre: Array<{ minute: number, price: number }>, after: Array<{ minute: number, price: number }> }>}
 */
export async function fetchExtendedIntradayPoints(code6, now = new Date()) {
  const empty = { pre: [], after: [] }
  const appKey = cleanEnv(process.env.KIS_APP_KEY)
  const appSecret = cleanEnv(process.env.KIS_APP_SECRET)
  if (!appKey || !appSecret) return empty
  if (isWeekend(now)) return empty

  const nowMin = seoulMinutes(now)
  const cursors = chunkCursors(nowMin)
  if (cursors.length === 0) return empty

  const env = process.env.KIS_ENV === 'prod' ? 'prod' : 'vps'
  /** @type {Map<number, number>} */
  const byMinute = new Map()

  for (let i = 0; i < cursors.length; i += CONCURRENCY) {
    const batch = cursors.slice(i, i + CONCURRENCY)
    const results = await Promise.all(
      batch.map(async (cursor) => {
        try {
          return await inquireMinuteBars(appKey, appSecret, env, code6, {
            endHhmmss: hhmmss(cursor),
            marketDiv: MARKET_DIV_DISPLAY,
            settled: cursor < nowMin,
          })
        } catch (e) {
          console.warn(
            `[intraday/ext] ${code6} ${hhmmss(cursor)} 실패:`,
            e instanceof Error ? e.message : String(e),
          )
          return []
        }
      }),
    )
    for (const point of toPoints(results.flat())) {
      byMinute.set(point.minute, point.price)
    }
  }

  const points = [...byMinute.entries()]
    .map(([minute, price]) => ({ minute, price }))
    .sort((a, b) => a.minute - b.minute)

  return {
    pre: points.filter((p) => p.minute < SESSION_START_MIN),
    after: points.filter((p) => p.minute > SESSION_END_MIN),
  }
}

export { PRE_OPEN_MIN, SESSION_START_MIN, SESSION_END_MIN, AFTER_CLOSE_MIN }
