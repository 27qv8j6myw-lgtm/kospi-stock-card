/**
 * Supabase `get_user_model` + Anthropic 모델 ID 매핑 (서버 전용).
 * `SUPABASE_SERVICE_ROLE_KEY` 는 클라이언트·Git 에 노출 금지.
 */
import { createClient } from '@supabase/supabase-js'
import { ensureModelRegistry, getLatestModelId } from './modelRegistry.mjs'
import { isAdminUserEmail } from './userInfo.mjs'

const CACHE_TTL_MS = 5 * 60 * 1000
/** 모델 티어는 관리자 화면에서 바꾸면 곧바로 반영되도록 짧게 캐시 */
const MODEL_CACHE_TTL_MS = 30 * 1000
/** @type {Map<string, { model: string, admin: boolean, expires: number }>} */
const cache = new Map()

/** @type {Map<string, { ok: boolean, expires: number }>} */
const aiEnabledCache = new Map()

/** @type {Map<string, { workload: 'high' | 'extra' | 'max', expires: number }>} */
const workloadCache = new Map()

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
 * @param {string} raw
 * @returns {'opus' | 'sonnet' | 'fable'}
 */
function normalizeTier(raw) {
  if (raw === 'fable') return 'fable'
  if (raw === 'opus') return 'opus'
  return 'sonnet'
}

/**
 * 서비스롤로 userId → 이메일 조회 후 관리자 여부 판별.
 * 모델 결정을 DB 함수/마이그레이션이 아닌 서버 코드(배포)에서 확정하기 위한 단일 기준.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
async function isAdminUserId(supabase, userId) {
  try {
    const { data, error } = await supabase.auth.admin.getUserById(userId)
    if (error) {
      console.warn('[userModel] getUserById:', error.message)
      return false
    }
    return isAdminUserEmail(data?.user?.email)
  } catch (e) {
    console.warn('[userModel] getUserById', e instanceof Error ? e.message : e)
    return false
  }
}

/**
 * 관리자가 고른 모델 — user_settings.ai_model 이 'opus' 면 opus, 그 외(미설정 포함)는 fable.
 * (get_user_model RPC 는 관리자에게 항상 fable 을 돌려주므로 테이블을 직접 읽는다)
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @returns {Promise<'opus' | 'fable'>}
 */
async function getAdminChosenModel(supabase, userId) {
  const { data, error } = await supabase
    .from('user_settings')
    .select('ai_model')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) console.warn('[userModel] admin ai_model:', error.message)
  const raw = typeof data?.ai_model === 'string' ? data.ai_model.trim().toLowerCase() : ''
  return raw === 'opus' ? 'opus' : 'fable'
}

/**
 * 사용자 티어 + 관리자 여부. 관리자는 fable/opus 중 선택(기본 fable),
 * 비관리자는 기존 get_user_model RPC(opus/sonnet).
 * @param {string | null | undefined} userId
 * @returns {Promise<{ model: 'opus' | 'sonnet' | 'fable', admin: boolean }>}
 */
async function getUserTier(userId) {
  await ensureModelRegistry()
  if (!userId) return { model: 'sonnet', admin: false }

  const hit = cache.get(userId)
  if (hit && hit.expires > Date.now()) {
    return { model: normalizeTier(hit.model), admin: hit.admin }
  }

  const supabase = getServiceSupabase()
  if (!supabase) {
    console.warn('[userModel] SUPABASE_SERVICE_ROLE_KEY 또는 URL 없음 — sonnet')
    return { model: 'sonnet', admin: false }
  }

  try {
    if (await isAdminUserId(supabase, userId)) {
      const model = await getAdminChosenModel(supabase, userId)
      cache.set(userId, { model, admin: true, expires: Date.now() + MODEL_CACHE_TTL_MS })
      return { model, admin: true }
    }

    const { data, error } = await supabase.rpc('get_user_model', { target_user_id: userId })
    if (error) {
      console.error('[userModel] rpc:', error.message)
      return { model: 'sonnet', admin: false }
    }
    const raw = typeof data === 'string' ? data.trim().toLowerCase() : ''
    const model = normalizeTier(raw)
    cache.set(userId, { model, admin: false, expires: Date.now() + MODEL_CACHE_TTL_MS })
    return { model, admin: false }
  } catch (e) {
    console.error('[userModel]', e instanceof Error ? e.message : e)
    return { model: 'sonnet', admin: false }
  }
}

/**
 * 사용자 AI 티어.
 * @param {string | null | undefined} userId
 * @returns {Promise<'opus' | 'sonnet' | 'fable'>}
 */
export async function getUserModel(userId) {
  return (await getUserTier(userId)).model
}

/**
 * 관리자 전용 심층 분석 모드 여부 — 관리자가 고른 모델(fable/opus)과 무관하게 유지.
 * @param {string | null | undefined} userId
 * @returns {Promise<boolean>}
 */
export async function isDeepAnalysisUser(userId) {
  return (await getUserTier(userId)).admin
}

/**
 * 모델 ID 해석 우선순위: env override → Anthropic /v1/models 최신 스냅샷 → 기본값.
 * env override: `OPUS_MODEL_ID`, `SONNET_MODEL_ID`, `FABLE_MODEL_ID` (배포 없이 특정 모델 고정).
 * @param {'opus' | 'sonnet' | 'fable' | string} model
 * @returns {string}
 */
export function resolveModelId(model) {
  const m = String(model || '').toLowerCase()
  if (m === 'fable') return cleanEnv(process.env.FABLE_MODEL_ID) || getLatestModelId('fable')
  if (m === 'opus') return cleanEnv(process.env.OPUS_MODEL_ID) || getLatestModelId('opus')
  if (m === 'haiku') return cleanEnv(process.env.HAIKU_MODEL_ID) || getLatestModelId('haiku')
  return cleanEnv(process.env.SONNET_MODEL_ID) || getLatestModelId('sonnet')
}

/**
 * 에이전트형(도구 루프) 경로용 모델 — fable 티어(관리자가 Fable 선택)는 fable, 그 외는 opus.
 * @param {string | null | undefined} userId
 * @returns {Promise<string>} 모델 ID
 */
export async function resolveAgenticModelId(userId) {
  const tier = await getUserModel(userId)
  return resolveModelId(tier === 'fable' ? 'fable' : 'opus')
}

/**
 * 경량 작업(뉴스 요약·매매일지 인사이트/복기 등) 비용 절감용 모델 해석.
 * 상위 티어(fable=관리자, opus)는 해당 모델 유지, 그 외(sonnet)는 haiku 로 다운그레이드.
 * @param {string | null | undefined} userId
 * @returns {Promise<string>} 모델 ID
 */
export async function resolveLightTaskModelId(userId) {
  const userModel = await getUserModel(userId)
  return userModel === 'sonnet' ? resolveModelId('haiku') : resolveModelId(userModel)
}

const WORKLOAD_MULTIPLIER = { high: 1, extra: 1.5, max: 2 }

/**
 * 사용자 AI 작업량(토큰 예산 단계) — user_settings.ai_workload.
 * 컬럼 미생성/오류 시 'high'.
 * @param {string | null | undefined} userId
 * @returns {Promise<'high' | 'extra' | 'max'>}
 */
export async function getUserWorkload(userId) {
  if (!userId) return 'high'

  const hit = workloadCache.get(userId)
  if (hit && hit.expires > Date.now()) return hit.workload

  /** @param {'high' | 'extra' | 'max'} workload */
  const cacheAndReturn = (workload) => {
    workloadCache.set(userId, { workload, expires: Date.now() + CACHE_TTL_MS })
    return workload
  }

  const supabase = getServiceSupabase()
  if (!supabase) return cacheAndReturn('high')

  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('ai_workload')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) {
      // 컬럼 미생성 등 — 기본값을 캐시해 호출마다 실패 쿼리 반복 방지
      return cacheAndReturn('high')
    }
    const raw = typeof data?.ai_workload === 'string' ? data.ai_workload.trim().toLowerCase() : ''
    return cacheAndReturn(raw === 'extra' || raw === 'max' ? raw : 'high')
  } catch {
    return cacheAndReturn('high')
  }
}

/**
 * 작업량 단계에 따라 max_tokens 산출. high=base, extra=1.5x, max=2x (cap 적용).
 * @param {string | null | undefined} userId
 * @param {number} baseTokens
 * @param {number} [cap]
 * @returns {Promise<number>}
 */
export async function resolveUserMaxTokens(userId, baseTokens, cap) {
  const workload = await getUserWorkload(userId)
  const mult = WORKLOAD_MULTIPLIER[workload] ?? 1
  const tokens = Math.round(baseTokens * mult)
  return cap ? Math.min(tokens, cap) : tokens
}

/**
 * 모델 + max_tokens 동시 해석(병렬). 모델별 base 토큰 + 작업량 배수 + cap.
 * sonnet 은 장문화로 이어쓰기 라운드가 늘어 base 를 더 높게 주는 것을 권장.
 * @param {string | null | undefined} userId
 * @param {{ opusBase: number, sonnetBase?: number, cap?: number, forceModel?: 'opus' | 'sonnet' }} opts
 *   forceModel 지정 시 사용자 설정과 무관하게 해당 모델 사용(도구 루프는 opus 고정 권장).
 *   단, fable 티어(관리자가 Fable 선택)는 forceModel 과 무관하게 fable 유지.
 * @returns {Promise<{ userModel: 'opus' | 'sonnet' | 'fable', modelId: string, maxTokens: number, deep: boolean }>}
 *   deep: 관리자 전용 심층 분석 모드 (관리자가 Opus 를 골라도 유지)
 */
export async function resolveModelAndMaxTokens(userId, { opusBase, sonnetBase, cap, forceModel }) {
  const [{ model: tier, admin }, workload] = await Promise.all([
    getUserTier(userId),
    getUserWorkload(userId),
  ])
  const userModel = tier === 'fable' ? 'fable' : (forceModel ?? tier)
  const base = userModel === 'sonnet' ? (sonnetBase ?? opusBase) : opusBase
  const mult = WORKLOAD_MULTIPLIER[workload] ?? 1
  const tokens = Math.round(base * mult)
  return {
    userModel,
    modelId: resolveModelId(userModel),
    maxTokens: cap ? Math.min(tokens, cap) : tokens,
    deep: admin,
  }
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
 *   | { ok: true, model: 'opus' | 'sonnet' | 'fable', modelId: string }
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
