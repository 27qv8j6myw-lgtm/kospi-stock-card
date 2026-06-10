/**
 * AI 동적 섹터 선정용 시장 데이터 수집 (KIS + stocks_master).
 */
import { createClient } from '@supabase/supabase-js'
import {
  inquireDailyBars,
  inquireDomesticPrice,
  inquireInvestorByStock,
  inquireTradeValueRankTop,
} from '../kisClient.mjs'
import { getStockMasterByCode } from './stocksMasterSearch.mjs'

function cleanEnv(s) {
  if (s == null || typeof s !== 'string') return ''
  let v = s.trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim()
  }
  return v
}

function getSupabaseService() {
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const key = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY)
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/**
 * @returns {{ appKey: string, appSecret: string, env: 'prod'|'vps' } | null}
 */
export function getKisCredentials() {
  const appKey = cleanEnv(process.env.KIS_APP_KEY)
  const appSecret = cleanEnv(process.env.KIS_APP_SECRET)
  if (!appKey || !appSecret) return null
  const env = process.env.KIS_ENV === 'prod' ? 'prod' : 'vps'
  return { appKey, appSecret, env }
}

/**
 * @param {string} code
 */
async function enrichSectorFromMaster(code) {
  const c = String(code).replace(/\D/g, '').padStart(6, '0')
  const master = await getStockMasterByCode(c)
  if (master.ok && master.item?.sector) return master.item.sector
  return null
}

/**
 * @param {string} appKey
 * @param {string} appSecret
 * @param {'prod'|'vps'} env
 * @param {number} limit
 */
export async function getTopByVolume(appKey, appSecret, env, limit = 50) {
  const rows = await inquireTradeValueRankTop(appKey, appSecret, env, {
    marketIscd: '0001',
    limit: Math.min(50, limit),
  })
  const out = []
  for (const s of rows) {
    if (!s.code || s.code === '000000') continue
    const sector = await enrichSectorFromMaster(s.code)
    out.push({
      code: s.code,
      name: s.name || s.code,
      sector,
      tradingValue: Number(s.tradingValue) || 0,
      changePct: Number(s.changePct) || 0,
    })
  }
  return out
}

/**
 * @param {string} appKey
 * @param {string} appSecret
 * @param {'prod'|'vps'} env
 * @param {number} limit
 */
export async function getTopByMomentum(appKey, appSecret, env, limit = 30) {
  const sb = getSupabaseService()
  if (!sb) return []

  const { data: kospi200, error } = await sb
    .from('stocks_master')
    .select('code, name, sector')
    .eq('is_kospi200', true)

  if (error || !kospi200?.length) {
    console.warn('[marketDataCollector] KOSPI200 없음:', error?.message)
    return []
  }

  const CHUNK = 10
  const results = []
  for (let i = 0; i < kospi200.length; i += CHUNK) {
    const chunk = kospi200.slice(i, i + CHUNK)
    const chunkResults = await Promise.all(
      chunk.map(async (stock) => {
        const code = String(stock.code ?? '')
          .replace(/\D/g, '')
          .padStart(6, '0')
        if (!code || code === '000000') return null
        try {
          const dailyData = await inquireDailyBars(appKey, appSecret, env, code, 8)
          if (!dailyData || dailyData.length < 4) return null
          const todayClose = dailyData[dailyData.length - 1].price
          const threeDaysAgoClose = dailyData[dailyData.length - 4].price
          if (
            todayClose == null ||
            threeDaysAgoClose == null ||
            !Number.isFinite(todayClose) ||
            !Number.isFinite(threeDaysAgoClose) ||
            threeDaysAgoClose === 0
          ) {
            return null
          }
          const return3D = ((todayClose - threeDaysAgoClose) / threeDaysAgoClose) * 100
          return {
            code,
            name: stock.name || code,
            sector: stock.sector ?? null,
            return3D,
          }
        } catch {
          return null
        }
      }),
    )
    for (const row of chunkResults) {
      if (row) results.push(row)
    }
  }

  return results.sort((a, b) => b.return3D - a.return3D).slice(0, limit)
}

/**
 * 거래대금 상위 종목의 3일 외국인 순매수 금액으로 근사 순위.
 * @param {string} appKey
 * @param {string} appSecret
 * @param {'prod'|'vps'} env
 * @param {number} limit
 */
export async function getTopByForeignNet(appKey, appSecret, env, limit = 30) {
  const volumeRows = await inquireTradeValueRankTop(appKey, appSecret, env, {
    marketIscd: '0001',
    limit: 40,
  })
  const codes = volumeRows.map((s) => s.code).filter((c) => c && c !== '000000')
  const CHUNK = 8
  const scored = []

  for (let i = 0; i < codes.length; i += CHUNK) {
    const slice = codes.slice(i, i + CHUNK)
    const batch = await Promise.all(
      slice.map(async (code) => {
        try {
          const inv = await inquireInvestorByStock(appKey, appSecret, env, code)
          const foreignNet = Number(inv.cumulative3d?.foreignNetAmount) || 0
          const volRow = volumeRows.find((v) => v.code === code)
          const sector = await enrichSectorFromMaster(code)
          return {
            code,
            name: volRow?.name || code,
            sector,
            foreignNet,
            foreignNetRatio: null,
            changePct: Number(volRow?.changePct) || 0,
          }
        } catch {
          return null
        }
      }),
    )
    scored.push(...batch.filter(Boolean))
  }

  return scored
    .sort((a, b) => b.foreignNet - a.foreignNet)
    .slice(0, limit)
    .map((r) => ({
      ...r,
      foreignNetRatio:
        r.foreignNet !== 0 && Number.isFinite(r.foreignNet)
          ? Math.round((r.foreignNet / 1e8) * 10) / 10
          : null,
    }))
}

/**
 * AI 섹터 선정용 시장 데이터 수집.
 * @returns {Promise<{ topVolume: object[], topMomentum: object[], topForeign: object[], timestamp: string }>}
 */
export async function collectMarketData() {
  const creds = getKisCredentials()
  if (!creds) {
    throw new Error('KIS_APP_KEY, KIS_APP_SECRET 이 필요합니다.')
  }
  const { appKey, appSecret, env } = creds

  const [topVolume, topMomentum, topForeign] = await Promise.all([
    getTopByVolume(appKey, appSecret, env, 50),
    getTopByMomentum(appKey, appSecret, env, 30),
    getTopByForeignNet(appKey, appSecret, env, 30),
  ])

  return {
    topVolume,
    topMomentum,
    topForeign,
    timestamp: new Date().toISOString(),
  }
}

/**
 * @param {unknown} v
 */
function toNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * 종목 코드 리스트로 실시간 시세 일괄 조회 (KIS 캐시 + 병렬).
 * @param {string[]} codes
 * @param {{ skipCache?: boolean }} [opts]
 * @returns {Promise<Map<string, { code: string, currentPrice: number | null, changePct: number | null, changeAmount: number | null, prevClose: number | null, volume: number | null }>>}
 */
export async function fetchRealtimePrices(codes, opts = {}) {
  const skipCache = Boolean(opts.skipCache)
  const creds = getKisCredentials()
  const priceMap = new Map()
  if (!creds) return priceMap

  const uniqueCodes = [
    ...new Set(
      (codes || [])
        .map((c) => {
          const norm = String(c).trim().toUpperCase()
          if (/^[0-9A-Z]{6}$/.test(norm)) return norm
          const digits = String(c).replace(/\D/g, '').padStart(6, '0')
          return /^\d{6}$/.test(digits) ? digits : ''
        })
        .filter(Boolean),
    ),
  ]

  const BATCH = 5
  for (let i = 0; i < uniqueCodes.length; i += BATCH) {
    const batch = uniqueCodes.slice(i, i + BATCH)
    const quotes = await Promise.all(
      batch.map(async (code) => {
        try {
          const q = await inquireDomesticPrice(
            creds.appKey,
            creds.appSecret,
            creds.env,
            code,
            { skipCache },
          )
          const currentPrice = toNum(q.price)
          const changePct = toNum(q.changePercent)
          const changeAmount = toNum(q.change)
          const prevClose =
            currentPrice != null && changeAmount != null ? currentPrice - changeAmount : null
          return {
            code,
            currentPrice,
            changePct,
            changeAmount,
            prevClose,
            volume: toNum(q.volume),
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          console.warn(`[Realtime] ${code} 시세 조회 실패:`, msg)
          return { code, currentPrice: null, changePct: null, changeAmount: null, prevClose: null, volume: null }
        }
      }),
    )
    for (const q of quotes) {
      priceMap.set(q.code, q)
    }
  }

  return priceMap
}

/**
 * @param {Record<string, unknown>} stock
 * @param {{ currentPrice?: number | null, changePct?: number | null, changeAmount?: number | null, prevClose?: number | null, volume?: number | null } | undefined} realtime
 */
function mergeStockQuote(stock, realtime) {
  if (!realtime) return stock
  return {
    ...stock,
    currentPrice: realtime.currentPrice ?? stock.currentPrice ?? null,
    changePct:
      realtime.changePct != null
        ? realtime.changePct
        : stock.changePct != null
          ? stock.changePct
          : 0,
    changeAmount: realtime.changeAmount ?? stock.changeAmount ?? null,
    prevClose: realtime.prevClose ?? stock.prevClose ?? null,
    volume: realtime.volume ?? stock.volume ?? null,
  }
}

/**
 * @param {unknown} scenario
 * @param {number | null | undefined} currentPrice
 */
export function applyScenarioPrices(scenario, currentPrice) {
  if (!scenario || typeof scenario !== 'object') return scenario
  const s = /** @type {Record<string, unknown>} */ (scenario)
  if (s.target1 && typeof s.target1 === 'object' && 'price' in /** @type {object} */ (s.target1)) {
    return scenario
  }
  const price = toNum(currentPrice)
  if (price == null || price <= 0) return scenario

  const pctPrice = (pct) => {
    const p = toNum(pct)
    return p != null ? Math.round(price * (1 + p / 100)) : null
  }

  const level = (pctKey, reasonKey) => {
    const pct = toNum(s[pctKey])
    return {
      price: pctPrice(pct),
      pct,
      reason: String(s[reasonKey] ?? '').trim(),
    }
  }

  return {
    entry: String(s.entry ?? '').trim(),
    entryReason: String(s.entryReason ?? s.entryDetail ?? '').trim(),
    target1: level('target1Pct', 'target1Reason'),
    target2: level('target2Pct', 'target2Reason'),
    stopLoss: level('stopLossPct', 'stopLossReason'),
  }
}

/**
 * 섹터·관심후보 번들에 KIS 실시간 시세 병합.
 * @param {{ sectors?: Array<{ stocks?: Array<Record<string, unknown>> }>, keyAnalyses?: Array<Record<string, unknown>> }} bundle
 * @param {Map<string, { currentPrice?: number | null, changePct?: number | null, changeAmount?: number | null, prevClose?: number | null, volume?: number | null }>} priceMap
 */
export function mergeRealtimeIntoScreeningBundle(bundle, priceMap) {
  const normCode = (c) => String(c).replace(/\D/g, '').padStart(6, '0')

  for (const sector of bundle.sectors || []) {
    if (!Array.isArray(sector.stocks)) continue
    sector.stocks = sector.stocks.map((stock) => {
      const code = normCode(stock.code)
      return mergeStockQuote(stock, priceMap.get(code))
    })
  }

  for (const analysis of bundle.keyAnalyses || []) {
    const code = normCode(analysis.code)
    const realtime = priceMap.get(code)
    if (realtime) {
      analysis.currentPrice = realtime.currentPrice ?? null
      analysis.changePct = realtime.changePct ?? analysis.changePct ?? 0
      analysis.changeAmount = realtime.changeAmount ?? null
      analysis.prevClose = realtime.prevClose ?? null
      analysis.volume = realtime.volume ?? null
    }
    if (analysis.scenario && analysis.currentPrice) {
      analysis.scenario = applyScenarioPrices(analysis.scenario, analysis.currentPrice)
    }
  }
}
