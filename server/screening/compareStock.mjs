import { scoreSingleStock, fetchIndexScreeningContext } from './scoreStock.mjs'

const stockCache = new Map()
const STOCK_TTL = 10 * 60 * 1000

let indexEntry = { env: '', at: 0, ctx: null }
const INDEX_TTL = 60 * 1000

async function indexCtxCached(appKey, appSecret, env) {
  const now = Date.now()
  if (indexEntry.ctx && indexEntry.env === env && now - indexEntry.at < INDEX_TTL) {
    return indexEntry.ctx
  }
  const ctx = await fetchIndexScreeningContext(appKey, appSecret, env)
  indexEntry = { env, at: now, ctx }
  return ctx
}

/**
 * @param {string} appKey
 * @param {string} appSecret
 * @param {'prod'|'vps'} env
 * @param {string} codeRaw
 */
export async function getCompareStockPayload(appKey, appSecret, env, codeRaw) {
  const code6 = String(codeRaw || '')
    .replace(/\D/g, '')
    .padStart(6, '0')
  if (!code6 || code6 === '000000') {
    throw new Error('유효하지 않은 종목코드')
  }
  const ck = `${env}:${code6}`
  const hit = stockCache.get(ck)
  if (hit && Date.now() - hit.at < STOCK_TTL) {
    return { ...hit.payload, source: 'cache' }
  }
  const indexCtx = await indexCtxCached(appKey, appSecret, env)
  const payload = await scoreSingleStock(appKey, appSecret, env, code6, indexCtx)
  stockCache.set(ck, { at: Date.now(), payload })
  return { ...payload, source: 'fresh' }
}
