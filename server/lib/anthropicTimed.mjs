import { callWithRetry } from './anthropicRetry.mjs'

/** Fable5 refusal 시 서버사이드 폴백 대상 (Opus 4.8) */
const FABLE_FALLBACK_MODEL = 'claude-opus-4-8'
/** 서버사이드 폴백 베타 헤더 (정확한 날짜 필수) */
const SERVER_SIDE_FALLBACK_BETA = 'server-side-fallback-2026-06-01'

/**
 * fable 계열 모델이면 refusal → Opus 자동 폴백을 위한 파라미터/헤더를 준비한다.
 * (네이티브 Anthropic API 전용 서버사이드 폴백)
 * @param {import('@anthropic-ai/sdk').MessageCreateParams | import('@anthropic-ai/sdk').MessageStreamParams} params
 * @param {Record<string, unknown>} [options]
 * @returns {{ params: any, options: Record<string, unknown> }}
 */
function withFableFallback(params, options = {}) {
  const model = String(params?.model || '').toLowerCase()
  if (!model.includes('fable')) return { params, options }
  const nextParams = { ...params, fallbacks: [{ model: FABLE_FALLBACK_MODEL }] }
  const nextOptions = {
    ...options,
    headers: { ...(options.headers || {}), 'anthropic-beta': SERVER_SIDE_FALLBACK_BETA },
  }
  return { params: nextParams, options: nextOptions }
}

/**
 * Anthropic messages.create 래퍼 — timeout + overloaded 재시도.
 * @param {import('@anthropic-ai/sdk').default} client
 * @param {import('@anthropic-ai/sdk').MessageCreateParams} params
 * @param {number} [timeoutMs]
 * @returns {Promise<import('@anthropic-ai/sdk').Message>}
 */
export async function createAnthropicMessage(client, params, timeoutMs = 60_000) {
  const ms = Number(timeoutMs) > 0 ? Number(timeoutMs) : 60_000
  const { params: reqParams, options: reqOptions } = withFableFallback(params, { timeout: ms })
  try {
    return await callWithRetry(() => client.messages.create(reqParams, reqOptions))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const name = e instanceof Error ? e.name : ''
    if (name === 'AbortError' || /timeout|timed out|ETIMEDOUT/i.test(msg)) {
      throw new Error(`Claude 요청 시간 초과(${Math.round(ms / 1000)}s)`)
    }
    throw e
  }
}

/**
 * messages.stream 시작 — HTTP 연결/초기 응답 overloaded 시 재시도.
 * @param {import('@anthropic-ai/sdk').default} client
 * @param {import('@anthropic-ai/sdk').MessageStreamParams} params
 * @returns {Promise<import('@anthropic-ai/sdk').MessageStream>}
 */
export async function createAnthropicStream(client, params) {
  const { params: reqParams, options: reqOptions } = withFableFallback(params)
  const hasOptions = reqOptions && Object.keys(reqOptions).length > 0
  return callWithRetry(() =>
    Promise.resolve(
      hasOptions ? client.messages.stream(reqParams, reqOptions) : client.messages.stream(reqParams),
    ),
  )
}

/** 스크리닝 Opus 호출 기본 타임아웃 (ms) */
export const SCREENING_AI_TIMEOUT_MS = Number(process.env.SCREENING_AI_TIMEOUT_MS) || 60_000

/** 섹터 선정·대량 프롬프트 */
export const SCREENING_SECTOR_AI_TIMEOUT_MS =
  Number(process.env.SCREENING_SECTOR_AI_TIMEOUT_MS) || 90_000
