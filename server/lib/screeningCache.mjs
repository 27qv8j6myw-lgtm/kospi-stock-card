/**
 * 스크리닝 결과 Supabase 공유 캐시 (섹터·모델·시간 버킷).
 * @see screening_cache 테이블 (cache_key unique, result jsonb, expires_at, …)
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

const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL)
const key = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY)

const supabase =
  url && key
    ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    : null

const CACHE_TTL_HOURS = 1

/**
 * @param {string} sector
 * @param {'opus'|'sonnet'|string} model
 * @returns {string}
 */
export function makeCacheKey(sector, model) {
  const now = new Date()
  const bucket = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()).getTime()
  return `screening:${String(sector)}:${String(model)}:${bucket}`
}

/**
 * @param {string} sector
 * @param {'opus'|'sonnet'|string} model
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function getCachedScreening(sector, model) {
  if (!supabase) return null
  const cacheKey = makeCacheKey(sector, model)
  const { data, error } = await supabase
    .from('screening_cache')
    .select('result, generated_at, hit_count')
    .eq('cache_key', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (error || !data || data.result == null || typeof data.result !== 'object') return null

  const inner = /** @type {Record<string, unknown>} */ (data.result)
  const prevHits = Number(data.hit_count)
  const nextHits = (Number.isFinite(prevHits) ? prevHits : 0) + 1
  void supabase
    .from('screening_cache')
    .update({ hit_count: nextHits })
    .eq('cache_key', cacheKey)
    .then(() => {})
    .catch(() => {})

  const m = model === 'sonnet' ? 'sonnet' : 'opus'
  console.log(`[Cache HIT] ${sector}/${m} (${nextHits}회)`)

  return {
    ...inner,
    cached: true,
    cachedAt: data.generated_at ?? (typeof inner.generatedAt === 'string' ? inner.generatedAt : null),
    model: m,
  }
}

/**
 * @param {string} sector
 * @param {'opus'|'sonnet'|string} model
 * @param {Record<string, unknown>} result
 * @param {string | null | undefined} userId
 */
export async function setCachedScreening(sector, model, result, userId) {
  if (!supabase) return
  const cacheKey = makeCacheKey(sector, model)
  const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString()
  const m = model === 'sonnet' ? 'sonnet' : 'opus'
  const { error } = await supabase.from('screening_cache').upsert(
    {
      cache_key: cacheKey,
      sector: String(sector),
      model: m,
      result,
      expires_at: expiresAt,
      generated_by: userId || null,
      hit_count: 0,
    },
    { onConflict: 'cache_key' },
  )

  if (error) console.error('[Cache SET]', error.message)
  else console.log(`[Cache SET] ${sector}/${m}`)
}

/**
 * `screening_cache` 테이블 전체 비우기 (하이브리드 섹터 정의 변경 후 재생성용).
 * @returns {Promise<{ ok: true, deleted: number } | { ok: false, error: string }>}
 */
export async function clearAllScreeningCache() {
  if (!supabase) {
    return { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY 또는 NEXT_PUBLIC_SUPABASE_URL 없음' }
  }

  const { count: beforeCount, error: countErr } = await supabase
    .from('screening_cache')
    .select('*', { count: 'exact', head: true })

  if (countErr) {
    return { ok: false, error: countErr.message }
  }

  const { error: delErr } = await supabase.from('screening_cache').delete().neq('cache_key', '')
  if (delErr) {
    return { ok: false, error: delErr.message }
  }

  const deleted = Number(beforeCount) || 0
  console.log(`[Cache CLEAR] screening_cache ${deleted} rows removed`)
  return { ok: true, deleted }
}

/**
 * @param {'opus'|'sonnet'|string} model
 */
export function makeAutoScreeningCacheKey(model) {
  const now = new Date()
  const bucket = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()).getTime()
  const m = model === 'sonnet' ? 'sonnet' : 'opus'
  return `auto-screening:v2:${m}:${bucket}`
}

/**
 * @param {string} cacheKey
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function getCachedAutoScreening(cacheKey) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('screening_cache')
    .select('result, generated_at, hit_count')
    .eq('cache_key', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (error || !data?.result || typeof data.result !== 'object') return null

  const prevHits = Number(data.hit_count)
  const nextHits = (Number.isFinite(prevHits) ? prevHits : 0) + 1
  void supabase
    .from('screening_cache')
    .update({ hit_count: nextHits })
    .eq('cache_key', cacheKey)
    .then(() => {})
    .catch(() => {})

  console.log(`[Cache HIT] auto-screening (${nextHits}회)`)

  return {
    .../** @type {Record<string, unknown>} */ (data.result),
    cached: true,
    cachedAt: data.generated_at ?? null,
  }
}

/**
 * @param {string} cacheKey
 * @param {Record<string, unknown>} result
 */
export async function setCachedAutoScreening(cacheKey, result) {
  if (!supabase) return
  const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString()
  const m = result.model === 'sonnet' ? 'sonnet' : 'opus'
  const { error } = await supabase.from('screening_cache').upsert(
    {
      cache_key: cacheKey,
      sector: 'auto',
      model: m,
      result,
      expires_at: expiresAt,
      hit_count: 0,
    },
    { onConflict: 'cache_key' },
  )
  if (error) console.error('[Cache SET auto]', error.message)
  else console.log('[Cache SET] auto-screening')
}

/**
 * 만료 여부 무관 — auto-screening 최신 캐시 (502·타임아웃 fallback).
 * @param {'opus'|'sonnet'|string} [model]
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function getLastAutoScreeningCache(model = 'opus') {
  if (!supabase) return null
  const m = model === 'sonnet' ? 'sonnet' : 'opus'

  const { data, error } = await supabase
    .from('screening_cache')
    .select('result, generated_at, cache_key')
    .like('cache_key', `auto-screening:v2:${m}:%`)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data?.result || typeof data.result !== 'object') {
    if (error) console.warn('[Cache] getLastAutoScreening:', error.message)
    return null
  }

  console.log(`[Cache FALLBACK] auto-screening ${data.cache_key}`)

  return {
    .../** @type {Record<string, unknown>} */ (data.result),
    cached: true,
    stale: true,
    cachedAt: data.generated_at ?? null,
    source: 'stale-cache',
  }
}
