import { inquireDailyBars } from '../kisClient.mjs'

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

/**
 * @param {string} code6
 * @param {number} days
 */
export async function fetchProChartBars(code6, days) {
  const code = String(code6).replace(/\D/g, '').padStart(6, '0').slice(0, 6)
  const n = Math.max(5, Math.min(Number(days) || 30, 260))
  const { appKey, appSecret, env } = getKisEnv()
  const bars = await inquireDailyBars(appKey, appSecret, env, code, n)

  const mapped = bars.map((c) => ({
    date: String(c.ts || c.label || ''),
    close: c.price ?? 0,
    open: c.open ?? c.price,
    high: c.high ?? c.price,
    low: c.low ?? c.price,
    volume: c.volume ?? 0,
  }))

  return sortChartBarsChronological(mapped)
}
