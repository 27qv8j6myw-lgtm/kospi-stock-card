/**
 * KIS 접근 토큰 Supabase 공유 저장소.
 *
 * Vercel 서버리스는 인스턴스마다 메모리·/tmp 가 분리되어 각자 토큰을 발급하다
 * KIS 발급 제한(EGW00133, 1분 1회)에 걸린다. 발급된 토큰을 `market_cache`에
 * 저장해 모든 인스턴스가 공유하면 발급 자체가 하루 1~2회로 줄어든다.
 */
import { createClient } from '@supabase/supabase-js'

const TOKEN_KEY_PREFIX = 'kis-token'

/** @returns {import('@supabase/supabase-js').SupabaseClient | null} */
function getSupabase() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

/**
 * @param {'prod'|'vps'} env
 * @returns {Promise<{ token: string, expiresAt: number } | null>}
 */
export async function readSharedToken(env) {
  const sb = getSupabase()
  if (!sb) return null
  try {
    const { data, error } = await sb
      .from('market_cache')
      .select('data')
      .eq('cache_key', `${TOKEN_KEY_PREFIX}:${env}`)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()
    if (error || !data?.data) return null
    const row = /** @type {{ token?: string, expiresAt?: number }} */ (data.data)
    if (!row.token || !row.expiresAt || row.expiresAt <= Date.now() + 60_000) return null
    return { token: String(row.token), expiresAt: Number(row.expiresAt) }
  } catch {
    return null
  }
}

/**
 * @param {'prod'|'vps'} env
 * @param {string} token
 * @param {number} expiresAt epoch ms
 */
export async function writeSharedToken(env, token, expiresAt) {
  const sb = getSupabase()
  if (!sb) return
  try {
    await sb.from('market_cache').upsert(
      {
        cache_key: `${TOKEN_KEY_PREFIX}:${env}`,
        data: { token, expiresAt, savedAt: Date.now() },
        expires_at: new Date(expiresAt).toISOString(),
      },
      { onConflict: 'cache_key' },
    )
  } catch {
    // 공유 저장 실패는 치명적이지 않음 — 로컬 캐시로 동작
  }
}

/**
 * 만료(EGW00123) 판정된 토큰 제거 — 다른 인스턴스가 죽은 토큰을 재사용하지 않게.
 * @param {'prod'|'vps'} env
 * @param {string} [badToken] 이 토큰일 때만 삭제 (다른 인스턴스가 막 갱신한 새 토큰 보호)
 */
export async function invalidateSharedToken(env, badToken) {
  const sb = getSupabase()
  if (!sb) return
  try {
    if (badToken) {
      const current = await readSharedToken(env)
      if (current && current.token !== badToken) return
    }
    await sb.from('market_cache').delete().eq('cache_key', `${TOKEN_KEY_PREFIX}:${env}`)
  } catch {
    // ignore
  }
}
