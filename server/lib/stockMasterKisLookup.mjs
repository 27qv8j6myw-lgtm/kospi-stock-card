/**
 * KIS 시세 → stocks_master 자동 등록 (toolExecutor·stocksMasterSearch 와 순환 import 없음)
 */
import { createClient } from '@supabase/supabase-js'
import { inquireDomesticPrice } from '../kisClient.mjs'

function cleanEnv(s) {
  if (s == null || typeof s !== 'string') return ''
  let v = s.trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim()
  }
  return v
}

function getServiceSupabase() {
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const key = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY)
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
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
 * @param {string | null | undefined} name
 * @param {string} code6
 */
export function isValidStockDisplayName(name, code6) {
  const code = String(code6).replace(/\D/g, '').padStart(6, '0').slice(0, 6)
  const s = String(name || '').trim()
  if (!s || s === code) return false
  if (/^\d{6}$/.test(s.replace(/\s/g, ''))) return false
  return /[가-힣]/.test(s)
}

/**
 * @param {string | null | undefined} rawMarket
 */
function normalizeMarket(rawMarket) {
  const m = String(rawMarket || '').trim().toUpperCase()
  if (!m) return 'KOSPI'
  if (m.includes('KOSDAQ')) return 'KOSDAQ'
  if (m.includes('KOSPI')) return 'KOSPI'
  if (m.includes('KONEX')) return 'KONEX'
  return String(rawMarket).trim() || 'KOSPI'
}

/**
 * @param {string} code6
 * @returns {Promise<{ code: string, name: string, market: string, sector: string } | null>}
 */
export async function fetchStockMetaFromKis(code6) {
  const code = String(code6 || '')
    .replace(/\D/g, '')
    .padStart(6, '0')
    .slice(0, 6)
  if (!/^\d{6}$/.test(code)) return null

  const { appKey, appSecret, env } = getKisEnv()
  const quote = await inquireDomesticPrice(appKey, appSecret, env, code)
  const name =
    quote.nameKr && String(quote.nameKr).trim() && String(quote.nameKr).trim() !== code
      ? String(quote.nameKr).trim()
      : null
  if (!isValidStockDisplayName(name, code)) return null

  return {
    code,
    name,
    market: normalizeMarket(quote.market),
    sector: quote.sector ? String(quote.sector).trim() : '—',
  }
}

/**
 * @param {{ code: string, name: string, market?: string, sector?: string }} row
 * @param {string} [logTag]
 */
export async function registerStockMaster(row, logTag = 'Auto-register') {
  const supabase = getServiceSupabase()
  if (!supabase) return false

  try {
    const { error } = await supabase.from('stocks_master').upsert(
      {
        code: row.code,
        name: row.name,
        market: row.market && String(row.market).trim() ? String(row.market).trim() : 'KOSPI',
        sector: row.sector && String(row.sector).trim() ? String(row.sector).trim() : '—',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'code' },
    )
    if (!error) {
      console.log(`[${logTag}] ${row.code}: ${row.name}`)
      return true
    }
  } catch {
    // ignore
  }
  return false
}

/**
 * KIS 조회 후 stocks_master upsert
 * @param {string} code6
 * @param {string} [logTag]
 */
export async function lookupAndRegisterStock(code6, logTag = 'Auto-register') {
  const meta = await fetchStockMetaFromKis(code6)
  if (!meta) return null
  void registerStockMaster(meta, logTag)
  return meta
}
