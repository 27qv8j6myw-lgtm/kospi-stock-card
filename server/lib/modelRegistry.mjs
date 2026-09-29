/**
 * Anthropic 모델 레지스트리 — `GET /v1/models` 를 주기적으로 조회해
 * 최신 opus / sonnet / haiku / fable ID를 자동 선택하고 메모리에 캐시한다.
 *
 * - 서버리스 콜드스타트마다 캐시가 비므로, 비동기 경로에서는 `ensureModelRegistry()` 를
 *   먼저 await 해 첫 요청부터 최신 모델을 쓰게 한다. (getUserModel 이 호출)
 * - resolveModelId() 는 동기 함수이므로 getLatestModelId 는 캐시를 동기로 반환하고
 *   TTL 만료 시 백그라운드(fire-and-forget) 로 갱신한다.
 * - 조회 실패 시에는 DEFAULTS 로 폴백한다.
 * - env override(OPUS_MODEL_ID/SONNET_MODEL_ID/FABLE_MODEL_ID)는 resolveModelId 쪽에서 우선 처리.
 */

const ANTHROPIC_MODELS_URL = 'https://api.anthropic.com/v1/models'
const ANTHROPIC_VERSION = '2023-06-01'
/** Fable 모델 상세의 `allowed_fallback_models` 는 이 베타 헤더가 있어야 내려온다 */
const SERVER_SIDE_FALLBACK_BETA = 'server-side-fallback-2026-06-01'
const TTL_MS = 6 * 60 * 60 * 1000 // 6시간
const FAILURE_RETRY_MS = 60 * 1000
const ENSURE_TIMEOUT_MS = 2500

/** 조회 실패 시 폴백 (현재 시점 최신 GA) */
export const DEFAULT_MODEL_IDS = {
  opus: 'claude-opus-5-5',
  sonnet: 'claude-sonnet-5-5',
  // haiku 는 무날짜 별칭이 제공되지 않아 날짜 포함 스냅샷을 폴백으로 사용
  // (pricing.normalizeModelKey 가 날짜 접미사를 떼어 단가 매칭)
  haiku: 'claude-haiku-4-5-20251001',
  fable: 'claude-fable-5-1',
}

/** Fable refusal 서버사이드 폴백 기본값 — Fable 5.1 의 allowed_fallback_models 에 opus-5-5 는 없음 */
export const DEFAULT_FABLE_FALLBACK_MODEL_ID = 'claude-opus-5'

/**
 * @type {{
 *   opus: string | null, sonnet: string | null, haiku: string | null, fable: string | null,
 *   fableFallback: string | null, fetchedAt: number, failedAt: number
 * }}
 */
const cache = {
  opus: null,
  sonnet: null,
  haiku: null,
  fable: null,
  fableFallback: null,
  fetchedAt: 0,
  failedAt: 0,
}

/** @type {Promise<void> | null} */
let inFlight = null

/**
 * `created_at` 최신 + 안정 버전 우선으로 family 대표 ID 선택.
 * @param {Array<{ id?: string, created_at?: string }>} models
 * @param {'opus' | 'sonnet' | 'haiku' | 'fable'} family
 * @returns {string | null}
 */
function pickLatest(models, family) {
  const candidates = models
    .filter((m) => typeof m?.id === 'string' && m.id.toLowerCase().includes(family))
    .filter((m) => {
      const id = m.id.toLowerCase()
      // preview/beta/deprecated 류는 제외 (자동선택 안정성)
      return !id.includes('preview') && !id.includes('beta') && !id.includes('deprecated')
    })
  if (candidates.length === 0) return null
  candidates.sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
  )
  return candidates[0].id
}

/**
 * Fable 모델이 허용하는 폴백 중 가장 최신 모델.
 * @param {string} apiKey
 * @param {string} fableId
 * @param {Array<{ id?: string, created_at?: string }>} models
 * @returns {Promise<string | null>}
 */
async function fetchFableFallback(apiKey, fableId, models) {
  const res = await fetch(`${ANTHROPIC_MODELS_URL}/${encodeURIComponent(fableId)}`, {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-beta': SERVER_SIDE_FALLBACK_BETA,
    },
  })
  if (!res.ok) return null
  const json = await res.json()
  const allowed = Array.isArray(json?.allowed_fallback_models)
    ? json.allowed_fallback_models.filter((/** @type {unknown} */ id) => typeof id === 'string')
    : []
  if (allowed.length === 0) return null
  const createdAt = new Map(models.map((m) => [m.id, new Date(m.created_at || 0).getTime()]))
  const sorted = [...allowed].sort((a, b) => (createdAt.get(b) ?? 0) - (createdAt.get(a) ?? 0))
  return sorted[0]
}

async function fetchModels() {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) return
  try {
    const res = await fetch(`${ANTHROPIC_MODELS_URL}?limit=1000`, {
      headers: { 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION },
    })
    if (!res.ok) {
      console.warn('[modelRegistry] /v1/models', res.status)
      cache.failedAt = Date.now()
      return
    }
    const json = await res.json()
    const models = Array.isArray(json?.data) ? json.data : []
    cache.opus = pickLatest(models, 'opus') || cache.opus
    cache.sonnet = pickLatest(models, 'sonnet') || cache.sonnet
    cache.haiku = pickLatest(models, 'haiku') || cache.haiku
    cache.fable = pickLatest(models, 'fable') || cache.fable
    if (cache.fable) {
      try {
        cache.fableFallback = (await fetchFableFallback(apiKey, cache.fable, models)) || cache.fableFallback
      } catch (e) {
        console.warn('[modelRegistry] fallback', e instanceof Error ? e.message : String(e))
      }
    }
    cache.fetchedAt = Date.now()
    console.log(
      '[modelRegistry] latest opus=%s sonnet=%s haiku=%s fable=%s fableFallback=%s',
      cache.opus,
      cache.sonnet,
      cache.haiku,
      cache.fable,
      cache.fableFallback,
    )
  } catch (e) {
    cache.failedAt = Date.now()
    console.warn('[modelRegistry]', e instanceof Error ? e.message : String(e))
  }
}

function isFresh() {
  return Date.now() - cache.fetchedAt < TTL_MS
}

/** @returns {Promise<void> | null} */
function maybeRefresh() {
  if (isFresh()) return null
  if (inFlight) return inFlight
  if (Date.now() - cache.failedAt < FAILURE_RETRY_MS) return null
  inFlight = fetchModels().finally(() => {
    inFlight = null
  })
  return inFlight
}

/**
 * 캐시가 비었거나 만료됐으면 최신 목록 조회를 기다린다(최대 timeoutMs).
 * 이후 동기 getLatestModelId / resolveModelId 가 최신 ID를 반환한다.
 * @param {number} [timeoutMs]
 * @returns {Promise<void>}
 */
export async function ensureModelRegistry(timeoutMs = ENSURE_TIMEOUT_MS) {
  const pending = maybeRefresh()
  if (!pending) return
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer
  await Promise.race([
    pending,
    new Promise((resolve) => {
      timer = setTimeout(resolve, timeoutMs)
    }),
  ])
  clearTimeout(timer)
}

/**
 * 캐시된 최신 모델 ID(동기) — 만료 시 백그라운드 갱신을 트리거한다.
 * @param {'opus' | 'sonnet' | 'haiku' | 'fable'} family
 * @returns {string}
 */
export function getLatestModelId(family) {
  void maybeRefresh()
  const fam =
    family === 'opus'
      ? 'opus'
      : family === 'haiku'
        ? 'haiku'
        : family === 'fable'
          ? 'fable'
          : 'sonnet'
  return cache[fam] || DEFAULT_MODEL_IDS[fam]
}

/**
 * Fable refusal 서버사이드 폴백 대상(동기) — 최신 Fable 의 allowed_fallback_models 중 최신.
 * @returns {string}
 */
export function getFableFallbackModelId() {
  void maybeRefresh()
  return cache.fableFallback || DEFAULT_FABLE_FALLBACK_MODEL_ID
}
