/**
 * Pro 채팅 Tool Use — 시장·조회 데이터 (기존 HTTP 라우트 로직 재사용)
 */
import { createClient } from '@supabase/supabase-js'
import {
  MARKET_DIV_DISPLAY,
  inquireDomesticPrice,
  inquireTradeValueRankTop,
} from '../kisClient.mjs'
import { getMarketSummary } from '../marketSummary.mjs'

function cleanEnv(s) {
  if (s == null || typeof s !== 'string') return ''
  let v = s.trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim()
  }
  return v
}

export function getProServiceSupabase() {
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const key = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY)
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/**
 * @param {string} appKey
 * @param {string} appSecret
 * @param {'prod'|'vps'} env
 * @param {number} limit
 */
export async function fetchTopByVolume(appKey, appSecret, env, limit = 10) {
  const rows = await inquireTradeValueRankTop(appKey, appSecret, env, {
    marketIscd: '0001',
    limit: Math.min(30, Math.max(1, limit)),
  })
  return rows
    .filter((s) => s.code && s.code !== '000000')
    .map((s) => ({
      code: s.code,
      name: s.name || s.code,
      currentPrice: s.currentPrice,
      changePct: s.changePct,
      tradingValue: s.tradingValue,
    }))
}

/**
 * 거래대금 상위 풀에서 당일 등락률 상위 (빠른 모멘텀 근사)
 * @param {string} appKey
 * @param {string} appSecret
 * @param {'prod'|'vps'} env
 * @param {number} limit
 */
export async function fetchTopByMomentum(appKey, appSecret, env, limit = 10) {
  const pool = await inquireTradeValueRankTop(appKey, appSecret, env, {
    marketIscd: '0001',
    limit: 50,
  })
  return pool
    .filter((s) => s.code && s.code !== '000000' && s.changePct != null)
    .sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0))
    .slice(0, Math.min(30, Math.max(1, limit)))
    .map((s) => ({
      code: s.code,
      name: s.name || s.code,
      currentPrice: s.currentPrice,
      changePct: s.changePct,
    }))
}

/**
 * @param {string} appKey
 * @param {string} appSecret
 * @param {'prod'|'vps'} env
 */
export async function fetchMarketIndices(appKey, appSecret, env) {
  const summary = await getMarketSummary(appKey, appSecret, env)
  return {
    generatedAt: summary.generatedAt,
    indices: (summary.indices || []).map((idx) => ({
      key: idx.key,
      label: idx.label,
      value: idx.value,
      changePct: idx.change,
    })),
  }
}

/**
 * @param {string} userId
 */
export async function fetchUserRecentViews(userId, appKey, appSecret, env) {
  const sb = getProServiceSupabase()
  if (!sb) return { stocks: [], message: 'Supabase 미설정' }

  const { data: logs, error: logErr } = await sb
    .from('activity_logs')
    .select('metadata, created_at')
    .eq('user_id', userId)
    .eq('action', 'view_stock')
    .order('created_at', { ascending: false })
    .limit(20)

  if (logErr) return { error: logErr.message }

  const seen = new Set()
  /** @type {Array<{ code: string, name: string, viewedAt: string }>} */
  const unique = []
  for (const row of logs || []) {
    const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
    const code = String(meta.code ?? '')
      .replace(/\D/g, '')
      .padStart(6, '0')
    if (!code || code === '000000' || seen.has(code)) continue
    seen.add(code)
    unique.push({
      code,
      name: typeof meta.name === 'string' && meta.name.trim() ? meta.name.trim() : code,
      viewedAt: row.created_at,
    })
    if (unique.length >= 5) break
  }

  if (!unique.length) {
    return { stocks: [], message: '최근 조회 종목 없음' }
  }

  const stocks = await Promise.all(
    unique.map(async (s) => {
      if (!appKey || !appSecret) {
        return { ...s, currentPrice: null, changePct: null }
      }
      try {
        const quote = await inquireDomesticPrice(appKey, appSecret, env, s.code, {
          marketDiv: MARKET_DIV_DISPLAY,
        })
        return {
          code: s.code,
          name: s.name,
          currentPrice: quote.price,
          changePct: quote.changePercent,
          viewedAt: s.viewedAt,
        }
      } catch {
        return { ...s, currentPrice: null, changePct: null }
      }
    }),
  )

  return { stocks }
}

/**
 * @param {Record<string, unknown>|null|undefined} raw
 */
export function dividendYieldFromKisRaw(raw) {
  if (!raw || typeof raw !== 'object') return null
  const keys = ['dvd_yld', 'div_yld', 'yield', 'dividend_yield', 'dvyd']
  for (const k of keys) {
    const v = raw[k]
    if (v != null && v !== '') {
      const n = Number(String(v).replace(/,/g, ''))
      if (Number.isFinite(n)) return n
    }
  }
  for (const [k, v] of Object.entries(raw)) {
    if (!/dvd|div.*yld|yield/i.test(k)) continue
    const n = Number(String(v).replace(/,/g, ''))
    if (Number.isFinite(n)) return n
  }
  return null
}
