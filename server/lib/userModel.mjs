/**
 * Supabase `get_user_model` + Anthropic 모델 ID 매핑 (서버 전용).
 * `SUPABASE_SERVICE_ROLE_KEY` 는 클라이언트·Git 에 노출 금지.
 */
import { createClient } from '@supabase/supabase-js'

const CACHE_TTL_MS = 5 * 60 * 1000
/** @type {Map<string, { model: string, expires: number }>} */
const cache = new Map()

/** @type {Map<string, { ok: boolean, expires: number }>} */
const aiEnabledCache = new Map()

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

/**
 * @param {string | null | undefined} userId
 * @returns {Promise<'opus' | 'sonnet'>}
 */
export async function getUserModel(userId) {
  if (!userId) return 'sonnet'

  const hit = cache.get(userId)
  if (hit && hit.expires > Date.now()) {
    return hit.model === 'opus' ? 'opus' : 'sonnet'
  }

  const supabase = getServiceSupabase()
  if (!supabase) {
    console.warn('[userModel] SUPABASE_SERVICE_ROLE_KEY 또는 URL 없음 — sonnet')
    return 'sonnet'
  }

  try {
    const { data, error } = await supabase.rpc('get_user_model', { target_user_id: userId })
    if (error) {
      console.error('[userModel] rpc:', error.message)
      return 'sonnet'
    }
    const raw = typeof data === 'string' ? data.trim().toLowerCase() : ''
    const model = raw === 'opus' ? 'opus' : 'sonnet'
    cache.set(userId, { model, expires: Date.now() + CACHE_TTL_MS })
    return model
  } catch (e) {
    console.error('[userModel]', e instanceof Error ? e.message : e)
    return 'sonnet'
  }
}

/**
 * @param {'opus' | 'sonnet' | string} model
 * @returns {string}
 */
export function resolveModelId(model) {
  const m = String(model || '').toLowerCase()
  return m === 'opus' ? 'claude-opus-4-8' : 'claude-sonnet-4-5'
}

/**
 * `user_settings.ai_enabled` + RLS (service_role 로 `is_ai_enabled_for_user` RPC 권장).
 * @param {string | null | undefined} userId
 * @returns {Promise<boolean>}
 */
/**
 * AI 라우트 공통 — 로그인·토글·모델 ID.
 * @param {string | null | undefined} userId
 * @returns {Promise<
 *   | { ok: true, model: 'opus' | 'sonnet', modelId: string }
 *   | { ok: false, status: 401 | 403, error: string }
 * >}
 */
export async function resolveAiAccess(userId) {
  if (!userId) {
    return { ok: false, status: 401, error: '로그인이 필요합니다' }
  }
  if (!(await isAiEnabledForUser(userId))) {
    return { ok: false, status: 403, error: 'AI 기능 비활성' }
  }
  const model = await getUserModel(userId)
  return { ok: true, model, modelId: resolveModelId(model) }
}

export async function isAiEnabledForUser(userId) {
  if (!userId) return true

  const hit = aiEnabledCache.get(userId)
  if (hit && hit.expires > Date.now()) return hit.ok

  const supabase = getServiceSupabase()
  if (!supabase) {
    console.warn('[isAiEnabledForUser] SUPABASE_SERVICE_ROLE_KEY 없음 — 허용')
    return true
  }

  try {
    const { data, error } = await supabase.rpc('is_ai_enabled_for_user', { target_user_id: userId })
    let ok = false
    if (error) {
      console.error('[isAiEnabledForUser]', error.message)
      ok = false
    } else {
      ok = data === true
    }
    aiEnabledCache.set(userId, { ok, expires: Date.now() + CACHE_TTL_MS })
    return ok
  } catch (e) {
    console.error('[isAiEnabledForUser]', e instanceof Error ? e.message : e)
    return false
  }
}
