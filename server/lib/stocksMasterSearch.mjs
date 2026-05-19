/**
 * `stocks_master` Supabase 조회 (service_role). Express 라우트에서 사용.
 */
import { createClient } from '@supabase/supabase-js'

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
export async function searchStocksMaster(q, limit = 10) {
  const trimmed = String(q ?? '').trim()
  if (!trimmed) {
    return { ok: true, items: [] }
  }

  const supabase = getServiceSupabase()
  if (!supabase) {
    return { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY 또는 URL 없음' }
  }

  const esc = escapeIlike(trimmed)
  const digits = trimmed.replace(/\D/g, '').slice(0, 6)
  const namePattern = `%${esc}%`
  const codePattern = digits ? `${digits}%` : null

  const [nameRes, codeRes] = await Promise.all([
    supabase.from('stocks_master').select('code,name,market,sector').ilike('name', namePattern).limit(60),
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
    const c = String(r.code || '')
      .replace(/\D/g, '')
      .padStart(6, '0')
    if (!/^\d{6}$/.test(c)) continue
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
    const code = String(r.code || '')
      .replace(/\D/g, '')
      .padStart(6, '0')
    const name = String(r.name || '')
    const nameNorm = name.replace(/\s+/g, '')
    const nameLower = name.toLowerCase()

    if (digits.length === 6 && code === digits.padStart(6, '0')) return 0
    if (digits.length > 0 && code.startsWith(digits)) return 2
    if (nameLower === qLower || nameNorm.toLowerCase() === qNorm.toLowerCase()) return 3
    if (nameLower.startsWith(qLower) || nameNorm.toLowerCase().startsWith(qNorm.toLowerCase())) return 5
    if (code.startsWith(digits) && digits.length > 0) return 6
    if (nameLower.includes(qLower) || nameNorm.toLowerCase().includes(qNorm.toLowerCase())) return 8
    return 10
  }

  const items = rows
    .map((r) => ({
      code: String(r.code || '')
        .replace(/\D/g, '')
        .padStart(6, '0'),
      name: String(r.name || '').trim() || String(r.code),
      market: String(r.market || '').trim() || '—',
      sector: String(r.sector || '').trim() || '—',
    }))
    .filter((r) => /^\d{6}$/.test(r.code))
    .sort((a, b) => {
      const ra = rankScore(a)
      const rb = rankScore(b)
      if (ra !== rb) return ra - rb
      return a.code.localeCompare(b.code)
    })
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

  return { ok: true, items: deduped }
}

/**
 * @param {string} code
 * @returns {Promise<{ ok: true, item: { code: string, name: string, market: string, sector: string } | null } | { ok: false, error: string }>}
 */
export async function getStockMasterByCode(code) {
  const c = String(code ?? '')
    .replace(/\D/g, '')
    .padStart(6, '0')
  if (!/^\d{6}$/.test(c)) {
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
      code: c,
      name: String(data.name || '').trim() || c,
      market: String(data.market || '').trim() || '—',
      sector: String(data.sector || '').trim() || '—',
    },
  }
}
