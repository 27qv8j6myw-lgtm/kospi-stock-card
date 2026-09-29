/** Anthropic list prices — USD per 1M tokens (list; caching/batch discounts not applied) */

/** @type {Record<string, { input: number, output: number }>} */
export const MODEL_PRICE = {
  'claude-fable-5-1': { input: 10, output: 50 },
  'claude-fable-5': { input: 10, output: 50 },
  'claude-opus-5-5': { input: 4, output: 20 },
  'claude-opus-5': { input: 5, output: 25 },
  'claude-opus-4-8': { input: 5, output: 25 },
  'claude-opus-4-7': { input: 5, output: 25 },
  'claude-opus-4-6': { input: 5, output: 25 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  // Sonnet 5: 도입가 $2/$10 가 표준가로 확정(예정됐던 9/1 인상 취소)
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-sonnet-4-5': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
}

export const DEFAULT_MODEL = 'claude-opus-5-5'

/**
 * 모델 ID 정규화 — 날짜 스냅샷 접미사(`-YYYYMMDD`) 제거.
 * 예: `claude-haiku-4-5-20251001` → `claude-haiku-4-5`
 * @param {string} key
 * @returns {string}
 */
function normalizeModelKey(key) {
  return key.replace(/-\d{8}$/, '')
}

/** @deprecated use MODEL_PRICE['claude-opus-4-8'] */
export const OPUS_INPUT_USD_PER_M = MODEL_PRICE[DEFAULT_MODEL].input

/** @deprecated use MODEL_PRICE['claude-opus-4-8'] */
export const OPUS_OUTPUT_USD_PER_M = MODEL_PRICE[DEFAULT_MODEL].output

/**
 * @param {string | null | undefined} model
 * @param {number} inputTokens
 * @param {number} outputTokens
 * @returns {number}
 */
export function calcCost(model, inputTokens, outputTokens) {
  const raw = String(model || '').trim() || DEFAULT_MODEL
  const p = MODEL_PRICE[raw] || MODEL_PRICE[normalizeModelKey(raw)] || MODEL_PRICE[DEFAULT_MODEL]
  const input = Number(inputTokens) || 0
  const output = Number(outputTokens) || 0
  return (input / 1_000_000) * p.input + (output / 1_000_000) * p.output
}

/**
 * Opus 4.8 list price (default model).
 * @param {number} inputTokens
 * @param {number} outputTokens
 * @returns {number}
 */
export function calcOpusCostUsd(inputTokens, outputTokens) {
  return calcCost(DEFAULT_MODEL, inputTokens, outputTokens)
}
