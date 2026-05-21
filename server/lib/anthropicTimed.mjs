/**
 * Anthropic messages.create 래퍼 — SDK timeout 옵션.
 * @param {import('@anthropic-ai/sdk').default} client
 * @param {import('@anthropic-ai/sdk').MessageCreateParams} params
 * @param {number} [timeoutMs]
 * @returns {Promise<import('@anthropic-ai/sdk').Message>}
 */
export async function createAnthropicMessage(client, params, timeoutMs = 60_000) {
  const ms = Number(timeoutMs) > 0 ? Number(timeoutMs) : 60_000
  try {
    return await client.messages.create(params, { timeout: ms })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const name = e instanceof Error ? e.name : ''
    if (name === 'AbortError' || /timeout|timed out|ETIMEDOUT/i.test(msg)) {
      throw new Error(`Claude 요청 시간 초과(${Math.round(ms / 1000)}s)`)
    }
    throw e
  }
}

/** 스크리닝 Opus 호출 기본 타임아웃 (ms) */
export const SCREENING_AI_TIMEOUT_MS = Number(process.env.SCREENING_AI_TIMEOUT_MS) || 60_000

/** 섹터 선정·대량 프롬프트 */
export const SCREENING_SECTOR_AI_TIMEOUT_MS =
  Number(process.env.SCREENING_SECTOR_AI_TIMEOUT_MS) || 90_000
