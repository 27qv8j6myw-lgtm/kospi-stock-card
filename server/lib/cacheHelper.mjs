import { createClient } from '@supabase/supabase-js'

function cleanEnv(s) {
  if (s == null || typeof s !== 'string') return ''
  let v = s.trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim()
  }
  return v
}

function getSupabaseService() {
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const key = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY)
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

/**
 * 짧은 안정 해시(djb2) — 캐시 키 길이 제한용.
 * @param {string} s
 * @returns {string}
 */
export function hashKey(s) {
  let h = 5381
  const str = String(s)
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 33) ^ str.charCodeAt(i)
  }
  return (h >>> 0).toString(36)
}

/**
 * 캐시만 조회 (미스여도 재계산하지 않음).
 * 모바일에서 요청이 끊긴 뒤 복귀 조회할 때 긴 재계산을 트리거하지 않기 위해 사용한다.
 * @param {string} cacheKey
 * @returns {Promise<unknown | null>} 유효한 캐시가 없으면 null
 */
export async function getCachedValue(cacheKey) {
  const sb = getSupabaseService()
  if (!sb) return null

  try {
    const { data: cached, error } = await sb
      .from('market_cache')
      .select('data, expires_at')
      .eq('cache_key', cacheKey)
      .maybeSingle()

    if (error || !cached?.expires_at) return null
    if (new Date(cached.expires_at).getTime() <= Date.now()) return null
    return cached.data ?? null
  } catch (e) {
    console.warn('[Cache read]', cacheKey, e instanceof Error ? e.message : String(e))
    return null
  }
}

/**
 * market_cache — `cache_key`, `data`, `expires_at` (프로젝트 Supabase 스키마)
 * @param {string} cacheKey
 * @param {() => Promise<unknown>} fetcher
 * @param {number} [ttlHours]
 * @param {(value: unknown) => boolean} [shouldCache] true 일 때만 캐시에 기록 (실패 응답 캐싱 방지)
 */
export async function getCachedOrFetch(cacheKey, fetcher, ttlHours = 6, shouldCache) {
  const sb = getSupabaseService()
  if (!sb) {
    return fetcher()
  }

  try {
    const { data: cached, error } = await sb
      .from('market_cache')
      .select('data, expires_at')
      .eq('cache_key', cacheKey)
      .maybeSingle()

    if (!error && cached?.expires_at) {
      const expiresAt = new Date(cached.expires_at).getTime()
      if (expiresAt > Date.now()) {
        console.log(`[Cache HIT] ${cacheKey}`)
        return cached.data
      }
    }

    console.log(`[Cache MISS] ${cacheKey}`)
    const value = await fetcher()

    const allowCache = typeof shouldCache === 'function' ? shouldCache(value) : value != null
    if (value != null && allowCache) {
      const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString()
      // 응답 전에 저장을 끝낸다 — 클라이언트가 끊겨 함수가 곧 종료돼도 결과가 남아야 복귀 조회로 살릴 수 있다.
      const { error: upsertErr } = await sb
        .from('market_cache')
        .upsert({ cache_key: cacheKey, data: value, expires_at: expiresAt }, { onConflict: 'cache_key' })
      if (upsertErr) console.warn('[Cache write]', cacheKey, upsertErr.message)
    }

    return value
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.warn('[Cache error]', cacheKey, message)
    return fetcher()
  }
}
