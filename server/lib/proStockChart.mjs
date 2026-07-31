import { inquireDailyBars } from '../kisClient.mjs'
import { isValidStockCode, normalizeKisIscd } from './stockCode.mjs'

function cleanEnv(s) {
  if (s == null || typeof s !== 'string') return ''
  let v = s.trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim()
  }
  return v
}

function getKisEnv() {
  const appKey = cleanEnv(process.env.KIS_APP_KEY)
  const appSecret = cleanEnv(process.env.KIS_APP_SECRET)
  const env = process.env.KIS_ENV === 'prod' ? 'prod' : 'vps'
  if (!appKey || !appSecret) {
    throw new Error('KIS_APP_KEY, KIS_APP_SECRET 이 필요합니다')
  }
  return { appKey, appSecret, env }
}

/**
 * 차트용 일봉 — 날짜 오름차순 (과거 → 현재, 좌→우)
 * @param {Array<{ date?: string; close?: number; open?: number; high?: number; low?: number; volume?: number }>} rows
 */
export function sortChartBarsChronological(rows) {
  return [...rows].sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')))
}

/** 이동평균 계산에 필요한 선행 봉 수 (MA20 기준) */
const MA_WARMUP_BARS = 25

/**
 * 종가 이동평균을 각 봉에 붙인다. 표본이 모자란 앞쪽 봉은 null.
 * @param {Array<{ close: number }>} rows 날짜 오름차순
 * @param {number[]} windows
 */
function attachMovingAverages(rows, windows = [5, 20]) {
  return rows.map((row, i) => {
    const out = { ...row }
    for (const w of windows) {
      if (i + 1 < w) {
        out[`ma${w}`] = null
        continue
      }
      let sum = 0
      for (let k = i - w + 1; k <= i; k += 1) sum += rows[k].close
      out[`ma${w}`] = Math.round(sum / w)
    }
    return out
  })
}

/**
 * @param {string} code6
 * @param {number} days
 * @param {{ withMa?: boolean }} [opts] `withMa` 면 ma5·ma20 을 붙인다 (선행 봉을 더 받아 계산)
 */
export async function fetchProChartBars(code6, days, opts = {}) {
  const code = normalizeKisIscd(code6)
  if (!isValidStockCode(code)) {
    throw new Error('invalid code')
  }
  const n = Math.max(5, Math.min(Number(days) || 30, 260))
  const withMa = opts.withMa === true
  const { appKey, appSecret, env } = getKisEnv()
  const bars = await inquireDailyBars(appKey, appSecret, env, code, withMa ? n + MA_WARMUP_BARS : n)

  const mapped = bars.map((c) => ({
    date: String(c.ts || c.label || ''),
    close: c.price ?? 0,
    open: c.open ?? c.price,
    high: c.high ?? c.price,
    low: c.low ?? c.price,
    volume: c.volume ?? 0,
  }))

  const sorted = sortChartBarsChronological(mapped)
  if (!withMa) return sorted
  return attachMovingAverages(sorted).slice(-n)
}
