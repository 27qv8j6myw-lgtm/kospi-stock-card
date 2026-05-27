/** 한국 상장 종목 코드: 숫자·영문 혼합 6자리 (예: 005930, 0126Z0) */

const FULL_CODE_RE = /^[0-9A-Za-z]{6}$/
const VALID_CODE_RE = /^[0-9A-Z]{6}$/

/**
 * @param {unknown} code
 */
export function isValidStockCode(code) {
  return VALID_CODE_RE.test(String(code ?? '').trim().toUpperCase())
}

/**
 * @param {unknown} code
 * @returns {string} 유효하면 대문자 6자리, 아니면 ''
 */
export function normalizeStockCode(code) {
  const s = String(code ?? '').trim().toUpperCase()
  return VALID_CODE_RE.test(s) ? s : ''
}

/**
 * KIS FID_INPUT_ISCD — 영숫자 6자리는 그대로, 숫자만이면 0패딩
 * @param {unknown} raw
 */
export function normalizeKisIscd(raw) {
  const trimmed = String(raw ?? '').trim()
  const upper = trimmed.toUpperCase()
  if (VALID_CODE_RE.test(upper)) return upper
  const digitsOnly = trimmed.replace(/\D/g, '')
  if (digitsOnly.length > 0 && digitsOnly.length <= 6) {
    return digitsOnly.padStart(6, '0')
  }
  return upper.slice(0, 6)
}

/**
 * @param {unknown} q
 */
export function isFullStockCodeQuery(q) {
  return FULL_CODE_RE.test(String(q ?? '').trim())
}

/**
 * @param {unknown} q
 */
export function isPartialStockCodeQuery(q) {
  const s = String(q ?? '').trim()
  return /^[0-9A-Za-z]{1,6}$/.test(s) && /\d/.test(s)
}

/** URL·라우트용 (대소문자 허용) */
export const STOCK_CODE_PATH_RE = /^[0-9A-Za-z]{6}$/
