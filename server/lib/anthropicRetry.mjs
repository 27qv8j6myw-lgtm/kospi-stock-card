/** @type {string} */
export const ANTHROPIC_OVERLOADED_USER_MESSAGE =
  'AI 서버가 일시적으로 혼잡합니다. 잠시 후 다시 시도해주세요.'

/**
 * @param {unknown} e
 * @returns {number | undefined}
 */
function anthropicHttpStatus(e) {
  if (!e || typeof e !== 'object') return undefined
  if ('status' in e && e.status != null) return Number(e.status)
  if ('statusCode' in e && e.statusCode != null) return Number(e.statusCode)
  return undefined
}

/**
 * @param {unknown} e
 * @returns {string | undefined}
 */
function anthropicErrorType(e) {
  if (!e || typeof e !== 'object' || !('error' in e)) return undefined
  const err = /** @type {{ type?: string }} */ (e).error
  return err?.type ? String(err.type) : undefined
}

/**
 * @param {unknown} e
 * @returns {boolean}
 */
export function isAnthropicRetryableError(e) {
  const status = anthropicHttpStatus(e)
  if (status === 529 || status === 429) return true

  const type = anthropicErrorType(e)
  if (type === 'overloaded_error' || type === 'rate_limit_error') return true

  const msg = e instanceof Error ? e.message : String(e)
  if (/overloaded/i.test(msg)) return true
  if (/rate\s*limit/i.test(msg)) return true

  return false
}

/**
 * @param {string} msg
 * @returns {boolean}
 */
export function looksLikeRawOverloadedMessage(msg) {
  const s = String(msg || '')
  if (!s) return false
  if (/overloaded_error|"type"\s*:\s*"overloaded_error"/i.test(s)) return true
  if (/Overloaded/i.test(s) && /529|overloaded/i.test(s)) return true
  if (s.length > 120 && s.includes('{') && /overloaded/i.test(s)) return true
  return false
}

/**
 * @param {unknown} e
 * @returns {string}
 */
export function mapAnthropicErrorForClient(e) {
  const msg = e instanceof Error ? e.message : String(e)
  if (isAnthropicRetryableError(e) || looksLikeRawOverloadedMessage(msg)) {
    return ANTHROPIC_OVERLOADED_USER_MESSAGE
  }
  return msg
}

/**
 * @param {() => Promise<T>} fn
 * @param {number} [maxRetries]
 * @returns {Promise<T>}
 * @template T
 */
export async function callWithRetry(fn, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn()
    } catch (e) {
      if (isAnthropicRetryableError(e) && attempt < maxRetries) {
        const wait = Math.min(1000 * 2 ** attempt, 8000)
        console.warn(
          `[Retry] Anthropic overloaded/rate-limit, ${wait}ms 후 재시도 (${attempt + 1}/${maxRetries})`,
        )
        await new Promise((r) => setTimeout(r, wait))
        continue
      }
      throw e
    }
  }
  throw new Error('callWithRetry: unreachable')
}
