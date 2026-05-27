/** 한국 상장 종목 코드: 숫자·영문 혼합 6자리 (예: 005930, 0126Z0) */

const FULL_CODE_RE = /^[0-9A-Za-z]{6}$/
const VALID_CODE_RE = /^[0-9A-Z]{6}$/

export function isValidStockCode(code: unknown): boolean {
  return VALID_CODE_RE.test(String(code ?? '').trim().toUpperCase())
}

export function normalizeStockCode(code: unknown): string {
  const s = String(code ?? '').trim().toUpperCase()
  return VALID_CODE_RE.test(s) ? s : ''
}

export function normalizeKisIscd(raw: unknown): string {
  const trimmed = String(raw ?? '').trim()
  const upper = trimmed.toUpperCase()
  if (VALID_CODE_RE.test(upper)) return upper
  const digitsOnly = trimmed.replace(/\D/g, '')
  if (digitsOnly.length > 0 && digitsOnly.length <= 6) {
    return digitsOnly.padStart(6, '0')
  }
  return upper.slice(0, 6)
}

export function isFullStockCodeQuery(q: unknown): boolean {
  return FULL_CODE_RE.test(String(q ?? '').trim())
}

export const STOCK_CODE_PATH_RE = /^[0-9A-Za-z]{6}$/
