/**
 * KIS 응답용 인메모리 TTL 캐시 (서버 프로세스 단위).
 * @typedef {{ value: unknown, expiresAt: number }} KisCacheEntry
 */

/** @type {Map<string, KisCacheEntry>} */
const store = new Map()

/** @param {string} key */
export function getCached(key) {
  const row = store.get(key)
  if (!row) return undefined
  if (Date.now() >= row.expiresAt) {
    store.delete(key)
    return undefined
  }
  console.log(`[Cache] HIT ${key}`)
  return row.value
}

/**
 * @param {string} key
 * @param {unknown} value
 * @param {number} ttlMs
 */
export function setCached(key, value, ttlMs) {
  store.set(key, { value, expiresAt: Date.now() + Math.max(0, ttlMs) })
}

/**
 * @param {string} key
 * @param {number} ttlMs
 * @param {() => Promise<unknown>} fn
 * @returns {Promise<unknown>}
 */
export async function withCache(key, ttlMs, fn) {
  const hit = getCached(key)
  if (hit !== undefined) return hit
  const value = await fn()
  setCached(key, value, ttlMs)
  return value
}

function sweepExpired() {
  const now = Date.now()
  for (const [k, row] of store) {
    if (now >= row.expiresAt) store.delete(k)
  }
}

setInterval(sweepExpired, 60_000).unref?.()
