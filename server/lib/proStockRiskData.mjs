import {
  firstNumByKeyHint,
  inquireDailyCreditBalance,
  inquireDailyShortSale,
  inquireDomesticPrice,
} from '../kisClient.mjs'
import { fetchNaverShortAndCredit } from './naverRiskScrape.mjs'
import {
  getSectorCoreCodes,
  getSectorDefinition,
  normalizeSectorCode6,
} from './sectorDefinitions.mjs'

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

function num(v) {
  if (v === undefined || v === null || v === '') return null
  const n = Number(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function parseShortRatioFromRow(row) {
  if (!row || typeof row !== 'object') return null
  const direct =
    firstNumByKeyHint(row, /shtn.*rt|short.*rt|공매.*율|sbor.*jrts|whol.*shtn/i) ??
    num(row.shtn_rt) ??
    num(row.sbor_jrts)
  if (direct != null && direct >= 0 && direct <= 100) return direct
  const vol = firstNumByKeyHint(row, /shtn.*vol|short.*vol|acml.*shtn/i)
  const total = firstNumByKeyHint(row, /acml.*vol|tot.*vol|trd.*vol/i)
  if (vol != null && total != null && total > 0) {
    const pct = (vol / total) * 100
    if (pct >= 0 && pct <= 100) return pct
  }
  return null
}

function parseCreditBalanceKrw(row) {
  if (!row || typeof row !== 'object') return null
  return (
    firstNumByKeyHint(row, /crdt.*rmnd|crdt.*bal|loan.*rmnd|신용.*잔/i) ??
    num(row.crdt_rmnd_amt) ??
    num(row.crdt_loan_rmnd)
  )
}

/**
 * @param {string} code6
 * @param {{ marketCap?: number | null } | null} quote
 * @returns {Promise<{ shortRatio: number | null, shortChange: number | null, marginRatio: number | null }>}
 */
export async function fetchProRiskMetrics(code6, quote) {
  const code = String(code6).replace(/\D/g, '').padStart(6, '0')
  let shortRatio = null
  let shortChange = null
  let marginRatio = null

  try {
    const { appKey, appSecret, env } = getKisEnv()
    const { rows } = await inquireDailyShortSale(appKey, appSecret, env, code, { days: 10 })
    const parsed = rows
      .map((r) => ({ row: r, ratio: parseShortRatioFromRow(r) }))
      .filter((x) => x.ratio != null)
    if (parsed.length) {
      shortRatio = parsed[parsed.length - 1].ratio
      if (parsed.length >= 2) {
        const prev = parsed[Math.max(0, parsed.length - 6)].ratio
        if (prev != null && shortRatio != null) {
          shortChange = Number((shortRatio - prev).toFixed(2))
        }
      }
    }

    const creditRows = await inquireDailyCreditBalance(appKey, appSecret, env, code)
    const latestCredit = creditRows.length ? creditRows[0] : null
    const balanceKrw = parseCreditBalanceKrw(latestCredit)
    const mcap = quote?.marketCap
    if (balanceKrw != null && mcap != null && mcap > 0) {
      marginRatio = Number(((balanceKrw / mcap) * 100).toFixed(2))
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.warn('[Pro risk KIS]', code, message)
  }

  if (shortRatio == null || marginRatio == null) {
    const nv = await fetchNaverShortAndCredit(code)
    if (shortRatio == null && nv.shortRatio != null) shortRatio = nv.shortRatio
    if (marginRatio == null && nv.marginRatio != null) marginRatio = nv.marginRatio
  }

  return { shortRatio, shortChange, marginRatio }
}

/**
 * @param {string} code6
 * @param {{ sector?: string | null, marketCap?: number | null } | null} quote
 */
export async function fetchSectorRank(code6, quote) {
  const code = normalizeSectorCode6(code6)
  const def = getSectorDefinition(quote?.sector ?? '')
  const sectorName = def?.label ?? (quote?.sector ? String(quote.sector).trim() : null)

  if (!def) {
    return { rank: null, total: null, name: sectorName }
  }

  const peerCodes = [...new Set([code, ...getSectorCoreCodes(def).map(normalizeSectorCode6)])].filter(
    (c) => c && c !== '000000',
  )

  try {
    const { appKey, appSecret, env } = getKisEnv()
    const snapshots = await Promise.all(
      peerCodes.map(async (c) => {
        try {
          const q = await inquireDomesticPrice(appKey, appSecret, env, c)
          return { code: c, changePct: q.changePercent ?? 0 }
        } catch {
          return { code: c, changePct: null }
        }
      }),
    )

    const ranked = snapshots
      .filter((s) => s.changePct != null && Number.isFinite(s.changePct))
      .sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0))

    if (!ranked.length) {
      return { rank: null, total: peerCodes.length, name: sectorName }
    }

    const idx = ranked.findIndex((r) => r.code === code)
    return {
      rank: idx >= 0 ? idx + 1 : null,
      total: ranked.length,
      name: sectorName,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.warn('[Pro sector rank]', code, message)
    return { rank: null, total: peerCodes.length, name: sectorName }
  }
}
