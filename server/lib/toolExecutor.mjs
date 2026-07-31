import {
  MARKET_DIV_DISPLAY,
  inquireDomesticPrice,
  inquireDailyBars,
  inquireInvestorByStock,
  logKisFrgnFields,
} from '../kisClient.mjs'
import { isValidStockCode, normalizeKisIscd } from './stockCode.mjs'
import { searchStocksMaster } from './stocksMasterSearch.mjs'
import {
  dividendYieldFromKisRaw,
  fetchMarketIndices,
  fetchTopByMomentum,
  fetchTopByVolume,
  fetchUserRecentViews,
} from './proMarketData.mjs'
import {
  getAnalystReportsForPro,
  getDisclosuresForPro,
  searchNewsForPro,
} from './proResearchTools.mjs'
import { registerStockMaster } from './stockMasterKisLookup.mjs'
import { resolveStockName } from './resolveStockName.mjs'
import { pickStockDisplayName } from './stockDisplayName.mjs'

function cleanEnv(s) {
  if (s == null || typeof s !== 'string') return ''
  let v = s.trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim()
  }
  return v
}

function getKisEnv() {
  const appKey = cleanEnv(process.env.KIS_APP_KEY)
  const appSecret = cleanEnv(process.env.KIS_APP_SECRET)
  const env = process.env.KIS_ENV === 'prod' ? 'prod' : 'vps'
  if (!appKey || !appSecret) {
    throw new Error('KIS_APP_KEY, KIS_APP_SECRET 이 필요합니다')
  }
  return { appKey, appSecret, env }
}

function normalizeCode(raw) {
  const code = normalizeKisIscd(raw)
  return isValidStockCode(code) ? code : ''
}

function clampInt(v, fallback, min, max) {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

/**
 * @param {string} code6
 * @param {...(string|null|undefined)} candidates
 */
async function resolveDisplayName(code6, ...candidates) {
  const code = normalizeCode(code6)
  if (!code) return ''
  const fromMaster = await resolveStockName(code)
  return pickStockDisplayName(code, ...candidates, fromMaster)
}

/**
 * @param {string} code6
 * @param {{ marketDiv?: 'J' | 'NX' | 'UN' }} [opts] 기본값은 KRX 단독(`'J'`).
 *   표시용 통합가가 필요하면 `getKisDisplayQuote` 를 쓴다.
 */
export async function getKisQuote(code6, opts = {}) {
  const code = normalizeCode(code6)
  const { appKey, appSecret, env } = getKisEnv()
  const quote = await inquireDomesticPrice(appKey, appSecret, env, code, {
    marketDiv: opts.marketDiv,
  })
  const raw = quote.raw
  if (process.env.KIS_DEBUG_QUOTE === '1' && raw && typeof raw === 'object') {
    logKisFrgnFields(code, raw)
  } else if (
    quote.foreignHoldingRate == null &&
    raw &&
    typeof raw === 'object' &&
    Object.keys(raw).some((k) => k.toLowerCase().includes('frgn'))
  ) {
    logKisFrgnFields(code, raw)
  }
  const nameKr =
    quote.nameKr && String(quote.nameKr).trim() && String(quote.nameKr).trim() !== code
      ? String(quote.nameKr).trim()
      : null
  return {
    code,
    name: nameKr || code,
    marketDiv: quote.marketDiv ?? 'J',
    market: quote.market ? String(quote.market).trim() : null,
    sector: quote.sector ? String(quote.sector).trim() : null,
    currentPrice: quote.price,
    change: quote.change,
    changePct: quote.changePercent,
    volume: quote.volume,
    tradingValue: quote.tradeValue,
    openPrice: quote.open ?? null,
    dayHigh: quote.high ?? null,
    dayLow: quote.low ?? null,
    tradingAmount: quote.tradeValue ?? null,
    per: quote.per,
    pbr: quote.pbr,
    eps: quote.eps,
    bps: quote.bps,
    dividendYield: dividendYieldFromKisRaw(quote.raw),
    marketCap: quote.marketCap,
    listedShares: quote.listedShares ?? null,
    foreignHoldingRate: quote.foreignHoldingRate ?? null,
    foreignHoldingQty: quote.foreignHoldingQty ?? null,
    foreignNetBuy: quote.foreignNetBuy ?? null,
  }
}

/**
 * 표시용 현재가 — KRX·NXT 통합가. NXT 프리마켓(08:00~08:50)과
 * 애프터마켓(15:30~20:00) 시간대에도 값이 잡힌다. NXT 미지원 종목·환경은
 * KIS 클라이언트가 KRX 단독으로 폴백한다.
 * @param {string} code6
 */
export async function getKisDisplayQuote(code6) {
  return await getKisQuote(code6, { marketDiv: MARKET_DIV_DISPLAY })
}

/**
 * @param {string} code6
 */
export async function getKis52Week(code6) {
  const code = normalizeCode(code6)
  const { appKey, appSecret, env } = getKisEnv()
  const bars = await inquireDailyBars(appKey, appSecret, env, code, 260)
  if (!bars.length) {
    throw new Error('52주 일봉 데이터 없음')
  }
  let high52w = -Infinity
  let low52w = Infinity
  for (const b of bars) {
    const hi = b.high ?? b.price
    const lo = b.low ?? b.price
    if (hi > high52w) high52w = hi
    if (lo < low52w) low52w = lo
  }
  return { high52w, low52w }
}

/**
 * @param {string} toolName
 * @param {Record<string, unknown>} input
 * @param {string | null | undefined} [userId]
 */
export async function executeTool(toolName, input, userId) {
  console.log(`[Tool] ${toolName}`, input)

  try {
    const { appKey, appSecret, env } = getKisEnv()

    switch (toolName) {
      case 'searchStock': {
        const query = String(input?.query ?? '').trim()
        if (!query) return []
        const out = await searchStocksMaster(query, 5)
        if (!out.ok) return { error: out.error }
        return out.items.map((s) => ({ code: s.code, name: s.name }))
      }

      case 'getStockQuote': {
        const q = await getKisQuote(String(input?.code ?? ''))
        const displayName = await resolveDisplayName(q.code, q.name)
        if (displayName && displayName !== q.code) {
          void registerStockMaster(
            {
              code: q.code,
              name: displayName,
              market: q.market || 'KOSPI',
              sector: q.sector || '—',
            },
            'Auto-register via Tool',
          )
        }
        return {
          code: q.code,
          name: displayName,
          market: q.market,
          sector: q.sector,
          currentPrice: q.currentPrice,
          change: q.change,
          changePct: q.changePct,
          volume: q.volume,
          tradingValue: q.tradingValue,
          openPrice: q.openPrice,
          dayHigh: q.dayHigh,
          dayLow: q.dayLow,
          tradingAmount: q.tradingAmount ?? q.tradingValue,
          marketCap: q.marketCap,
          listedShares: q.listedShares,
          foreignHoldingRate: q.foreignHoldingRate,
          foreignHoldingQty: q.foreignHoldingQty,
          foreignNetBuy: q.foreignNetBuy,
        }
      }

      case 'get52Week': {
        const code = normalizeCode(String(input?.code ?? ''))
        const week52 = await getKis52Week(code)
        const quote = await getKisQuote(code)
        const displayName = await resolveDisplayName(code, quote.name)
        const pctFromHigh =
          week52.high52w > 0
            ? Number((((quote.currentPrice - week52.high52w) / week52.high52w) * 100).toFixed(1))
            : null
        return {
          code,
          name: displayName,
          high52w: week52.high52w,
          low52w: week52.low52w,
          currentPrice: quote.currentPrice,
          pctFromHigh,
        }
      }

      case 'getInvestorTrend': {
        const code = normalizeCode(String(input?.code ?? ''))
        const days = clampInt(input?.days, 5, 1, 20)
        const inv = await inquireInvestorByStock(appKey, appSecret, env, code)
        const rows = Array.isArray(inv.rows) ? inv.rows.slice(0, days) : []
        if (!rows.length && !inv.latest) {
          return { error: '투자자 동향 데이터 없음' }
        }

        let foreignNetAmount = 0
        let institutionNetAmount = 0
        let foreignBuyDays = 0
        let institutionBuyDays = 0

        for (const r of rows) {
          const fAmt = (Number(r.frgn_ntby_tr_pbmn) || 0) * 1_000_000
          const iAmt = (Number(r.orgn_ntby_tr_pbmn) || 0) * 1_000_000
          foreignNetAmount += fAmt
          institutionNetAmount += iAmt
          if (fAmt > 0) foreignBuyDays += 1
          if (iAmt > 0) institutionBuyDays += 1
        }

        const usedDays = rows.length || days
        const displayName = await resolveDisplayName(code)

        return {
          code,
          name: displayName,
          days: usedDays,
          foreign: {
            cumulativeNet: foreignNetAmount,
            avgDaily: usedDays ? Math.round(foreignNetAmount / usedDays) : 0,
            buyDays: foreignBuyDays,
          },
          institute: {
            cumulativeNet: institutionNetAmount,
            avgDaily: usedDays ? Math.round(institutionNetAmount / usedDays) : 0,
            buyDays: institutionBuyDays,
          },
          latest: inv.latest,
        }
      }

      case 'getValuation': {
        const q = await getKisQuote(String(input?.code ?? ''))
        const displayName = await resolveDisplayName(q.code, q.name)
        return {
          code: q.code,
          name: displayName,
          per: q.per,
          pbr: q.pbr,
          eps: q.eps,
          bps: q.bps,
          dividendYield: q.dividendYield,
        }
      }

      case 'getDailyChart': {
        const code = normalizeCode(String(input?.code ?? ''))
        const days = clampInt(input?.days, 20, 5, 100)
        const bars = await inquireDailyBars(appKey, appSecret, env, code, days)
        if (!bars.length) {
          return { error: '일봉 데이터 없음' }
        }

        const closes = bars.map((c) => c.price ?? 0)
        const max = Math.max(...closes)
        const min = Math.min(...closes)
        const first = closes[0]
        const last = closes[closes.length - 1]
        const changePct =
          first > 0 ? Number((((last - first) / first) * 100).toFixed(2)) : null

        const recentDesc = bars.slice(-5).reverse()
        const displayName = await resolveDisplayName(code)

        return {
          code,
          name: displayName,
          days: bars.length,
          summary: {
            startPrice: first,
            endPrice: last,
            changePct,
            max,
            min,
          },
          recent: recentDesc.map((c) => ({
            date: c.ts,
            label: c.label,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.price,
            volume: c.volume,
          })),
        }
      }

      case 'getTopByVolume': {
        const limit = clampInt(input?.limit, 10, 1, 30)
        const stocks = await fetchTopByVolume(appKey, appSecret, env, limit)
        return { limit, stocks }
      }

      case 'getTopByMomentum': {
        const limit = clampInt(input?.limit, 10, 1, 30)
        const stocks = await fetchTopByMomentum(appKey, appSecret, env, limit)
        return { limit, stocks }
      }

      case 'getMarketIndices': {
        return await fetchMarketIndices(appKey, appSecret, env)
      }

      case 'getMyRecentViews': {
        if (!userId) return { error: '인증 정보 없음' }
        return await fetchUserRecentViews(userId, appKey, appSecret, env)
      }

      case 'searchNews': {
        const query = String(input?.query ?? '').trim()
        const limit = clampInt(input?.limit, 5, 1, 10)
        if (!query) return { query: '', count: 0, news: [] }
        return await searchNewsForPro(query, limit)
      }

      case 'getDisclosures': {
        const code = normalizeCode(String(input?.code ?? ''))
        const days = clampInt(input?.days, 30, 7, 90)
        return await getDisclosuresForPro(code, days)
      }

      case 'getAnalystReports': {
        const code = normalizeCode(String(input?.code ?? ''))
        let currentPrice = Number(input?.currentPrice)
        if (!Number.isFinite(currentPrice)) {
          try {
            const q = await getKisQuote(code)
            currentPrice = q.currentPrice
          } catch {
            currentPrice = NaN
          }
        }
        return await getAnalystReportsForPro(code, currentPrice)
      }

      default:
        return { error: `알 수 없는 도구: ${toolName}` }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { error: message }
  }
}
