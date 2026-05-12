export type BrokerReport = {
  title: string
  broker?: string
  analyst?: string
  publishedAt?: string
  targetPrice?: number
  previousTargetPrice?: number
  rating?: string
  summary?: string
  link?: string
  direction: 'up' | 'down' | 'maintain' | 'unknown'
}

export async function searchBrokerReports(
  stockName: string,
  stockCode: string,
): Promise<BrokerReport[]> {
  const res = await fetch('/api/screener-briefing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stockName, stockCode, mode: 'reports-only' }),
  })
  if (!res.ok) return []
  const json = await res.json()
  return Array.isArray(json?.reports) ? (json.reports as BrokerReport[]) : []
}
