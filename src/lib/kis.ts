import type { KISLogicIndicators } from '../hooks/useKisLogicIndicators'
import type { KisQuote } from '../hooks/useKisQuote'
import { sectorDefinitions, type ScreenerSectorKey } from './sectorDefinitions'
import { sectorUniverse } from './sectorUniverse'

export type KisDailyPoint = { date: string; close: number; high: number; low: number; volume: number }

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)
  return json as T
}

export async function getCurrentPrice(code: string): Promise<KisQuote> {
  return fetchJson<KisQuote>(`/api/quote?code=${encodeURIComponent(code)}`)
}

export async function getDailyChart(code: string): Promise<KisDailyPoint[]> {
  const out = await fetchJson<{ points?: Array<{ label?: string; value?: number | null }> }>(
    `/api/chart?code=${encodeURIComponent(code)}&tf=3M`,
  )
  return (out.points || [])
    .filter((p) => typeof p.value === 'number' && Number.isFinite(p.value))
    .map((p) => ({
      date: p.label || '',
      close: Number(p.value),
      high: Number(p.value),
      low: Number(p.value),
      volume: 0,
    }))
}

export async function getInvestorFlow(code: string): Promise<KISLogicIndicators['supplyDetails'] | null> {
  const out = await fetchJson<{ logicIndicators?: KISLogicIndicators }>(
    `/api/logic-indicators?code=${encodeURIComponent(code)}`,
  )
  return out.logicIndicators?.supplyDetails || null
}

export async function getFundamental(code: string): Promise<{
  per: number | null
  eps: number | null
  marketCap: number | null
  tradeValue: number | null
}> {
  const q = await getCurrentPrice(code)
  return {
    per: q.per,
    eps: q.eps,
    marketCap: null,
    tradeValue: q.tradeValue,
  }
}

export async function getSectorStocks(sector: ScreenerSectorKey) {
  return sectorUniverse[sector] || []
}

export function getAllScreenerSectors() {
  return sectorDefinitions
}
