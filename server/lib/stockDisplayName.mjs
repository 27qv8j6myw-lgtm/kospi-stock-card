import { normalizeKisIscd, normalizeStockCode } from './stockCode.mjs'

/**
 * @param {string | null | undefined} name
 * @param {string} code6
 */
export function isValidStockDisplayName(name, code6) {
  const code = normalizeStockCode(code6) || normalizeKisIscd(code6)
  const s = String(name || '').trim()
  if (!s || s === code) return false
  if (/^[0-9A-Z]{6}$/i.test(s.replace(/\s/g, ''))) return false
  if (/[가-힣]/.test(s)) return true
  return /^[A-Za-z0-9][A-Za-z0-9.\-&+]*$/.test(s) && s.length >= 2
}

/**
 * @param {string} code6
 * @param {...(string|null|undefined)} candidates
 */
export function pickStockDisplayName(code6, ...candidates) {
  const code = normalizeStockCode(code6) || normalizeKisIscd(code6)
  for (const c of candidates) {
    if (isValidStockDisplayName(c, code)) return String(c).trim()
  }
  return code
}
