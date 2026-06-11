import { apiUrl } from '@/lib/apiBase'
import { normalizeKisIscd, normalizeStockCode } from '@/lib/stockCode'

export type HoldingQuote = {
  currentPrice: number
  changePct: number
}

export type HoldingWithQuotes = {
  id: string
  code: string
  name: string
  quantity: number
  avg_price: number
  group_id: string | null
  currentPrice: number
  evalAmount: number
  costAmount: number
  profit: number
  profitPct: number
  weight?: number
  changePct?: number
}

/** API·DB 코드 형식 차이 대비 */
export function holdingCodeKeys(code: string): string[] {
  const upper = String(code ?? '').trim().toUpperCase()
  const norm = normalizeStockCode(upper) || normalizeKisIscd(upper)
  const digits = upper.replace(/\D/g, '').padStart(6, '0')
  return [...new Set([upper, norm, digits].filter(Boolean))]
}

export function lookupQuote(
  quotes: Record<string, HoldingQuote>,
  code: string,
): HoldingQuote | undefined {
  for (const key of holdingCodeKeys(code)) {
    const q = quotes[key]
    if (q && q.currentPrice > 0) return q
  }
  return undefined
}

export function mergeQuoteMaps(
  prev: Record<string, HoldingQuote>,
  incoming: Record<string, HoldingQuote | { currentPrice?: number | null; changePct?: number | null }>,
): Record<string, HoldingQuote> {
  const next = { ...prev }
  for (const [rawKey, rawQ] of Object.entries(incoming)) {
    const price = Number(rawQ?.currentPrice)
    if (!Number.isFinite(price) || price <= 0) continue
    const changePct = Number(rawQ?.changePct)
    const entry: HoldingQuote = {
      currentPrice: price,
      changePct: Number.isFinite(changePct) ? changePct : (prev[rawKey]?.changePct ?? 0),
    }
    for (const key of holdingCodeKeys(rawKey)) {
      next[key] = entry
    }
  }
  return next
}

export function enrichHoldingsWithQuotes(
  rows: Array<
    Omit<HoldingWithQuotes, 'evalAmount' | 'costAmount' | 'profit' | 'profitPct' | 'weight'> &
      Partial<HoldingWithQuotes>
  >,
  quotes: Record<string, HoldingQuote>,
): HoldingWithQuotes[] {
  const next = rows.map((h) => {
    const quantity = Number(h.quantity) || 0
    const avgPrice = Number(h.avg_price) || 0
    const costAmount = avgPrice * quantity

    const live = lookupQuote(quotes, h.code)
    const currentPrice =
      live?.currentPrice ?? (Number(h.currentPrice) > 0 ? Number(h.currentPrice) : 0)
    const evalAmount = currentPrice > 0 ? currentPrice * quantity : 0
    const profit = evalAmount > 0 ? evalAmount - costAmount : Number(h.profit) || 0
    const profitPct =
      evalAmount > 0 && costAmount > 0
        ? (profit / costAmount) * 100
        : Number(h.profitPct) || 0

    return {
      ...h,
      code: normalizeStockCode(h.code) || normalizeKisIscd(h.code) || String(h.code),
      currentPrice,
      changePct: live?.changePct ?? h.changePct,
      evalAmount,
      costAmount,
      profit,
      profitPct,
    }
  })

  const totalEval = next.reduce((s, h) => s + (Number(h.evalAmount) || 0), 0)
  return next.map((h) => ({
    ...h,
    weight: totalEval > 0 ? ((Number(h.evalAmount) || 0) / totalEval) * 100 : 0,
  }))
}

async function fetchPublicQuotesForCodes(codes: string[]): Promise<Record<string, HoldingQuote>> {
  const unique = [...new Set(codes.flatMap((c) => holdingCodeKeys(c)))]
  const out: Record<string, HoldingQuote> = {}

  await Promise.all(
    unique.map(async (code) => {
      try {
        const r = await fetch(apiUrl(`/api/quote?code=${encodeURIComponent(code)}`), {
          cache: 'no-store',
        })
        if (!r.ok) return
        const d = (await r.json()) as { price?: number; changePercent?: number; error?: string }
        if (d.error) return
        const price = Number(d.price)
        if (!Number.isFinite(price) || price <= 0) return
        const changePct = Number(d.changePercent)
        for (const key of holdingCodeKeys(code)) {
          out[key] = {
            currentPrice: price,
            changePct: Number.isFinite(changePct) ? changePct : 0,
          }
        }
      } catch {
        // ignore per-code errors
      }
    }),
  )

  return out
}

async function fetchAuthHoldingsQuotes(
  codes: string[],
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  opts: { fresh?: boolean } = {},
): Promise<Record<string, HoldingQuote>> {
  const freshQ = opts.fresh ? '&fresh=1' : ''
  const freshQuery = opts.fresh ? '?fresh=1' : ''

  try {
    const r = await authFetch(apiUrl(`/api/pro-holdings?mode=quotes${freshQ}`), {
      cache: 'no-store',
    })
    if (r.ok) {
      const d = (await r.json()) as {
        quotes?: Record<string, { currentPrice?: number | null; changePct?: number | null }>
      }
      if (d.quotes && Object.keys(d.quotes).length > 0) {
        return mergeQuoteMaps({}, d.quotes)
      }
    }
  } catch {
    // try legacy path
  }

  try {
    const r = await authFetch(apiUrl(`/api/pro-holdings-quotes${freshQuery}`), { cache: 'no-store' })
    if (r.ok) {
      const d = (await r.json()) as {
        quotes?: Record<string, { currentPrice?: number | null; changePct?: number | null }>
      }
      if (d.quotes && Object.keys(d.quotes).length > 0) {
        return mergeQuoteMaps({}, d.quotes)
      }
    }
  } catch {
    // fallback handled by caller
  }

  return {}
}

/**
 * Pro 보유 시세 — 공개 /api/quote + 인증 quotes API 병렬 조회 (장마감 후 종가 포함)
 */
export async function fetchProHoldingsQuotes(
  codes: string[],
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  opts: { fresh?: boolean } = {},
): Promise<Record<string, HoldingQuote>> {
  const unique = [...new Set(codes.flatMap((c) => holdingCodeKeys(c)))]
  if (unique.length === 0) return {}

  const [publicQuotes, authQuotes] = await Promise.all([
    fetchPublicQuotesForCodes(unique),
    fetchAuthHoldingsQuotes(codes, authFetch, opts),
  ])

  return mergeQuoteMaps(publicQuotes, authQuotes)
}

/** 즐겨찾기·단일 종목용 */
export async function fetchStockQuotePublic(code: string): Promise<HoldingQuote | null> {
  const merged = await fetchPublicQuotesForCodes([code])
  return lookupQuote(merged, code) ?? null
}
