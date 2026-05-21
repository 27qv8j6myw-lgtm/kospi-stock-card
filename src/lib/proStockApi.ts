import { fetchWithAuth } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'

export type ProStockSummary = {
  code: string
  name: string
  quote: {
    name?: string
    currentPrice?: number
    changePct?: number
    volume?: number
    tradingValue?: number
  } | null
  week52: {
    high52w?: number
    low52w?: number
    pctFromHigh?: number
  } | null
  investor: {
    foreign?: { cumulativeNet?: number; buyDays?: number }
    institute?: { cumulativeNet?: number; buyDays?: number }
  } | null
  valuation: {
    per?: number
    pbr?: number
  } | null
  news: Array<{ title: string; link: string; pubDate?: string | null; source?: string }>
  disclosures: Array<{ date: string; report: string; link: string }>
  analyst: {
    available?: boolean
    targetPrice?: number
    upside?: number
    opinion?: string | null
    reportCount?: number | null
  } | null
  timestamp?: string
}

export async function fetchProStockSummary(code: string): Promise<ProStockSummary | null> {
  const normalized = code.replace(/\D/g, '').padStart(6, '0').slice(0, 6)
  const res = await fetchWithAuth(apiUrl(`/api/pro-stock-summary?code=${normalized}`))
  if (!res.ok) return null
  return (await res.json()) as ProStockSummary
}

export type ChartPeriod = '1W' | '1M' | '3M' | '1Y'

export type ChartBar = { date?: string; close?: number }

export type ProTechnical = {
  rsi?: number | null
  macd?: number | null
  bollinger?: {
    middle: number
    upper: number
    lower: number
    current: number
  } | null
}

export type ProWatchlistItem = { code: string; added_at?: string; note?: string | null }

export async function fetchProStockChart(
  code: string,
  period: ChartPeriod,
): Promise<ChartBar[]> {
  const normalized = code.replace(/\D/g, '').padStart(6, '0').slice(0, 6)
  const res = await fetchWithAuth(
    apiUrl(`/api/pro-stock-chart?code=${normalized}&period=${period}`),
  )
  if (!res.ok) return []
  const d = (await res.json()) as { data?: ChartBar[] }
  return d.data ?? []
}

export async function fetchProStockTechnical(code: string): Promise<ProTechnical | null> {
  const normalized = code.replace(/\D/g, '').padStart(6, '0').slice(0, 6)
  const res = await fetchWithAuth(apiUrl(`/api/pro-stock-technical?code=${normalized}`))
  if (!res.ok) return null
  return (await res.json()) as ProTechnical
}

export async function fetchProWatchlist(): Promise<ProWatchlistItem[]> {
  const res = await fetchWithAuth(apiUrl('/api/pro-watchlist'))
  if (!res.ok) return []
  const d = (await res.json()) as { watchlist?: ProWatchlistItem[] }
  return d.watchlist ?? []
}

export async function addProWatchlist(code: string, note?: string): Promise<boolean> {
  const normalized = code.replace(/\D/g, '').padStart(6, '0').slice(0, 6)
  const res = await fetchWithAuth(apiUrl('/api/pro-watchlist'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: normalized, note }),
  })
  return res.ok
}

export async function removeProWatchlist(code: string): Promise<boolean> {
  const normalized = code.replace(/\D/g, '').padStart(6, '0').slice(0, 6)
  const res = await fetchWithAuth(apiUrl(`/api/pro-watchlist?code=${normalized}`), {
    method: 'DELETE',
  })
  return res.ok
}

export async function streamProStockAnalysis(
  code: string,
  summary: ProStockSummary,
  onEvent: (event: string, data: unknown) => void,
): Promise<void> {
  const res = await fetchWithAuth(apiUrl('/api/pro-stock-analysis'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, summary }),
  })

  if (!res.ok || !res.body) {
    const err = res.headers.get('content-type')?.includes('json')
      ? ((await res.json()) as { error?: string })
      : null
    throw new Error(err?.error || `분석 요청 실패 (${res.status})`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const blocks = buffer.split('\n\n')
    buffer = blocks.pop() || ''

    for (const block of blocks) {
      if (!block.trim()) continue
      const lines = block.split('\n')
      let eventName = ''
      let dataStr = ''
      for (const line of lines) {
        if (line.startsWith('event: ')) eventName = line.slice(7)
        if (line.startsWith('data: ')) dataStr = line.slice(6)
      }
      if (!dataStr) continue
      try {
        onEvent(eventName, JSON.parse(dataStr))
      } catch {
        // ignore malformed chunk
      }
    }
  }
}
