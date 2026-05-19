import { inquireDomesticPrice, inquireDailyBars } from '../kisClient.mjs'
import { searchStocksMaster } from './stocksMasterSearch.mjs'

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
  return String(raw || '')
    .replace(/\D/g, '')
    .padStart(6, '0')
    .slice(0, 6)
}

/**
 * @param {string} code6
 */
export async function getKisQuote(code6) {
  const code = normalizeCode(code6)
  const { appKey, appSecret, env } = getKisEnv()
  const quote = await inquireDomesticPrice(appKey, appSecret, env, code)
  return {
    code,
    name: quote.nameKr || code,
    currentPrice: quote.price,
    change: quote.change,
    changePct: quote.changePercent,
    volume: quote.volume,
    tradingValue: quote.tradeValue,
  }
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
 */
export async function executeTool(toolName, input) {
  console.log(`[Tool] ${toolName}`, input)

  try {
    switch (toolName) {
      case 'searchStock': {
        const query = String(input?.query ?? '').trim()
        if (!query) return []
        const out = await searchStocksMaster(query, 5)
        if (!out.ok) return { error: out.error }
        return out.items.map((s) => ({ code: s.code, name: s.name }))
      }

      case 'getStockQuote': {
        return await getKisQuote(String(input?.code ?? ''))
      }

      case 'get52Week': {
        const week52 = await getKis52Week(String(input?.code ?? ''))
        const quote = await getKisQuote(String(input?.code ?? ''))
        const pctFromHigh =
          week52.high52w > 0
            ? Number((((quote.currentPrice - week52.high52w) / week52.high52w) * 100).toFixed(1))
            : null
        return {
          high52w: week52.high52w,
          low52w: week52.low52w,
          currentPrice: quote.currentPrice,
          pctFromHigh,
        }
      }

      default:
        return { error: `알 수 없는 도구: ${toolName}` }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { error: message }
  }
}
