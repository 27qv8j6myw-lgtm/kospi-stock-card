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
 * market_cache — `cache_key`, `data`, `expires_at` (프로젝트 Supabase 스키마)
 * @param {string} cacheKey
 * @param {() => Promise<unknown>} fetcher
 * @param {number} [ttlHours]
 */
export async function getCachedOrFetch(cacheKey, fetcher, ttlHours = 6) {
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

    if (value != null) {
      const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString()
      void sb
        .from('market_cache')
        .upsert({ cache_key: cacheKey, data: value, expires_at: expiresAt }, { onConflict: 'cache_key' })
        .then(({ error: upsertErr }) => {
          if (upsertErr) console.warn('[Cache write]', cacheKey, upsertErr.message)
        })
    }

    return value
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.warn('[Cache error]', cacheKey, message)
    return fetcher()
  }
}
