/**
 * `stocks_master` Supabase 조회 (service_role). Express 라우트에서 사용.
 */
import { createClient } from '@supabase/supabase-js'
import {
  isFullStockCodeQuery,
  isPartialStockCodeQuery,
  isValidStockCode,
  normalizeStockCode,
} from './stockCode.mjs'
import { isValidStockDisplayName, lookupAndRegisterStock } from './stockMasterKisLookup.mjs'

function cleanEnv(s) {
  if (s == null || typeof s !== 'string') return ''
  let v = s.trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim()
  }
  return v
}

function escapeIlike(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

function getServiceSupabase() {
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const key = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY)
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/**
 * @param {string} q
 * @param {number} limit
 * @returns {Promise<{ ok: true, items: Array<{ code: string, name: string, market: string, sector: string }> } | { ok: false, error: string }>}
 */
export async function searchStocksMaster(q, limit = 15) {
  const trimmed = String(q ?? '').trim()
  if (!trimmed) {
    return { ok: true, items: [] }
  }

  const supabase = getServiceSupabase()
  if (!supabase) {
    return { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY 또는 URL 없음' }
  }

  const esc = escapeIlike(trimmed)
  const upperQ = trimmed.toUpperCase()
  const namePattern = `%${esc}%`
  const codePattern = isPartialStockCodeQuery(trimmed) ? `${escapeIlike(upperQ)}%` : null

  const [nameRes, codeRes] = await Promise.all([
    supabase.from('stocks_master').select('code,name,market,sector').ilike('name', namePattern).limit(80),
    codePattern
      ? supabase.from('stocks_master').select('code,name,market,sector').ilike('code', codePattern).limit(40)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (nameRes.error) {
    return { ok: false, error: nameRes.error.message }
  }
  if (codeRes.error) {
    return { ok: false, error: codeRes.error.message }
  }

  const byCode = new Map()
  for (const r of [...(nameRes.data || []), ...(codeRes.data || [])]) {
    const c = normalizeStockCode(r.code)
    if (!isValidStockCode(c)) continue
    if (!byCode.has(c)) byCode.set(c, r)
  }
  const rows = [...byCode.values()]
  const qLower = trimmed.toLowerCase()
  const qNorm = trimmed.replace(/\s+/g, '')

  /**
   * @param {{ code: string, name: string }} r
   * @returns {number}
   */
  function rankScore(r) {
    const code = normalizeStockCode(r.code)
    const name = String(r.name || '')
    const nameNorm = name.replace(/\s+/g, '')
    const nameLower = name.toLowerCase()

    if (isFullStockCodeQuery(trimmed) && code === normalizeStockCode(trimmed)) return 0
    if (upperQ && code.startsWith(upperQ)) return 2
    if (nameLower === qLower || nameNorm.toLowerCase() === qNorm.toLowerCase()) return 3
    if (nameLower.startsWith(qLower) || nameNorm.toLowerCase().startsWith(qNorm.toLowerCase())) return 5
    if (upperQ && code.startsWith(upperQ)) return 6
    if (nameLower.includes(qLower) || nameNorm.toLowerCase().includes(qNorm.toLowerCase())) return 8
    return 10
  }

  /**
   * @param {string | null | undefined} market
   */
  function isTradingMarket(market) {
    if (market == null) return false
    const m = String(market).trim()
    return m.length > 0 && m !== '—'
  }

  const items = rows
    .map((r) => ({
      code: normalizeStockCode(r.code),
      name: String(r.name || '').trim() || normalizeStockCode(r.code),
      market: String(r.market || '').trim() || '—',
      sector: String(r.sector || '').trim() || '—',
      _marketRaw: r.market,
    }))
    .filter((r) => isValidStockCode(r.code))
    .sort((a, b) => {
      const aTrade = isTradingMarket(a._marketRaw)
      const bTrade = isTradingMarket(b._marketRaw)
      if (aTrade !== bTrade) return aTrade ? -1 : 1
      const ra = rankScore(a)
      const rb = rankScore(b)
      if (ra !== rb) return ra - rb
      return a.code.localeCompare(b.code)
    })
    .map(({ _marketRaw: _m, ...rest }) => rest)
    .slice(0, Math.min(40, limit * 4))

  /** 중복 코드 제거 (첫 정렬 순 유지) */
  const seen = new Set()
  const deduped = []
  for (const it of items) {
    if (seen.has(it.code)) continue
    seen.add(it.code)
    deduped.push(it)
    if (deduped.length >= limit) break
  }

  const codeExact = isFullStockCodeQuery(trimmed) ? normalizeStockCode(trimmed) : null

  const existingExact = codeExact ? deduped.find((r) => r.code === codeExact) : null
  const needsKisFallback =
    codeExact &&
    (!existingExact || !isValidStockDisplayName(existingExact.name, codeExact))

  if (needsKisFallback) {
    try {
      const kisRow = await lookupAndRegisterStock(codeExact, 'Auto-register-search')
      if (kisRow) {
        const row = {
          code: kisRow.code,
          name: kisRow.name,
          market: kisRow.market,
          sector: kisRow.sector || '—',
        }
        if (existingExact) {
          const idx = deduped.indexOf(existingExact)
          if (idx >= 0) deduped[idx] = row
        } else {
          deduped.unshift(row)
          if (deduped.length > limit) deduped.length = limit
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn('[stocks-search] KIS 조회 실패', codeExact, msg)
    }
  }

  return { ok: true, items: deduped }
}

/**
 * @param {string} code
 * @returns {Promise<{ ok: true, item: { code: string, name: string, market: string, sector: string } | null } | { ok: false, error: string }>}
 */
export async function getStockMasterByCode(code) {
  const c = normalizeStockCode(code)
  if (!isValidStockCode(c)) {
    return { ok: false, error: 'invalid code' }
  }

  const supabase = getServiceSupabase()
  if (!supabase) {
    return { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY 또는 URL 없음' }
  }

  const { data, error } = await supabase
    .from('stocks_master')
    .select('code,name,market,sector')
    .eq('code', c)
    .maybeSingle()

  if (error) {
    return { ok: false, error: error.message }
  }

  if (!data) {
    return { ok: true, item: null }
  }

  return {
    ok: true,
    item: {
      code: normalizeStockCode(data.code) || c,
      name: String(data.name || '').trim() || c,
      market: String(data.market || '').trim() || '—',
      sector: String(data.sector || '').trim() || '—',
    },
  }
}
