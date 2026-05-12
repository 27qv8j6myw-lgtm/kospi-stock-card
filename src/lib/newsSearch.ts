export type NewsItem = {
  title: string
  link: string
  source: string
  publishedAt: string
  summary?: string
  category: 'earnings' | 'target_price' | 'order' | 'capacity' | 'sector' | 'macro' | 'risk' | 'other'
  sentiment: 'positive' | 'neutral' | 'negative'
}

export async function searchLatestNews(stockName: string, stockCode: string): Promise<NewsItem[]> {
  const res = await fetch('/api/screener-briefing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stockName, stockCode, mode: 'news-only' }),
  })
  if (!res.ok) return []
  const json = await res.json()
  return Array.isArray(json?.news) ? (json.news as NewsItem[]) : []
}
