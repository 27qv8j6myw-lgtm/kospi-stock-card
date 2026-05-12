import type { NewsItem } from './newsSearch'
import type { BrokerReport } from './reportSearch'

export type BriefingSource = {
  title: string
  source: string
  publishedAt?: string
  link?: string
}

export function buildBriefingSources(news: NewsItem[], reports: BrokerReport[]): BriefingSource[] {
  const items: BriefingSource[] = [
    ...news.map((n) => ({
      title: n.title,
      source: n.source,
      publishedAt: n.publishedAt,
      link: n.link,
    })),
    ...reports.map((r) => ({
      title: r.title,
      source: r.broker || '증권사 리포트',
      publishedAt: r.publishedAt,
      link: r.link,
    })),
  ]
  return items.slice(0, 16)
}
