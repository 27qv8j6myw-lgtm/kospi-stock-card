/**
 * Anthropic 모델 레지스트리 — `GET /v1/models` 를 주기적으로 조회해
 * 최신 opus / sonnet 스냅샷 ID를 자동 선택하고 메모리에 캐시한다.
 *
 * - resolveModelId() 가 동기 함수이므로, 캐시는 동기로 반환하고
 *   TTL 만료 시 백그라운드(fire-and-forget) 로 갱신한다.
 * - 첫 조회 완료 전 또는 실패 시에는 DEFAULTS 로 폴백한다.
 * - env override(OPUS_MODEL_ID/SONNET_MODEL_ID)는 resolveModelId 쪽에서 우선 처리.
 */

const ANTHROPIC_MODELS_URL = 'https://api.anthropic.com/v1/models'
const ANTHROPIC_VERSION = '2023-06-01'
const TTL_MS = 6 * 60 * 60 * 1000 // 6시간

/** 조회 실패/미완료 시 폴백 (현재 시점 최신 GA) */
export const DEFAULT_MODEL_IDS = {
  opus: 'claude-opus-4-8',
  sonnet: 'claude-sonnet-4-6',
  // haiku 는 무날짜 별칭이 제공되지 않아 날짜 포함 스냅샷을 폴백으로 사용
  // (pricing.normalizeModelKey 가 날짜 접미사를 떼어 단가 매칭)
  haiku: 'claude-haiku-4-5-20251001',
}

/** @type {{ opus: string | null, sonnet: string | null, haiku: string | null, fetchedAt: number }} */
const cache = { opus: null, sonnet: null, haiku: null, fetchedAt: 0 }

/** @type {Promise<void> | null} */
let inFlight = null

/**
 * `created_at` 최신 + 안정 버전 우선으로 family(opus/sonnet) 대표 ID 선택.
 * @param {Array<{ id?: string, created_at?: string }>} models
 * @param {'opus' | 'sonnet'} family
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

async function fetchModels() {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) return
  try {
    const res = await fetch(ANTHROPIC_MODELS_URL, {
      headers: { 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION },
    })
    if (!res.ok) {
      console.warn('[modelRegistry] /v1/models', res.status)
      return
    }
    const json = await res.json()
    const models = Array.isArray(json?.data) ? json.data : []
    const opus = pickLatest(models, 'opus')
    const sonnet = pickLatest(models, 'sonnet')
    const haiku = pickLatest(models, 'haiku')
    cache.opus = opus || cache.opus
    cache.sonnet = sonnet || cache.sonnet
    cache.haiku = haiku || cache.haiku
    cache.fetchedAt = Date.now()
    console.log(
      '[modelRegistry] latest opus=%s sonnet=%s haiku=%s',
      cache.opus,
      cache.sonnet,
      cache.haiku,
    )
  } catch (e) {
    console.warn('[modelRegistry]', e instanceof Error ? e.message : String(e))
  }
}

function maybeRefresh() {
  if (Date.now() - cache.fetchedAt < TTL_MS) return
  if (inFlight) return
  inFlight = fetchModels().finally(() => {
    inFlight = null
  })
}

/**
 * 캐시된 최신 모델 ID(동기) — 만료 시 백그라운드 갱신을 트리거한다.
 * @param {'opus' | 'sonnet' | 'haiku'} family
 * @returns {string}
 */
export function getLatestModelId(family) {
  maybeRefresh()
  const fam = family === 'opus' ? 'opus' : family === 'haiku' ? 'haiku' : 'sonnet'
  return cache[fam] || DEFAULT_MODEL_IDS[fam]
}
