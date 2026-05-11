import type { NewsItem, NewsSentiment } from '../types/aiBriefing'

export type NewsSentimentSummary = {
  positive: number
  neutral: number
  negative: number
  dominant: NewsSentiment
}

/** 최신순 정렬 (publishedAt 내림차순) */
export function sortNewsByDateDesc(news: NewsItem[]): NewsItem[] {
  return [...news].sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)))
}

export function aggregateNewsSentiment(news: NewsItem[]): NewsSentimentSummary {
  let positive = 0
  let neutral = 0
  let negative = 0
  for (const n of news) {
    if (n.sentiment === 'positive') positive += 1
    else if (n.sentiment === 'negative') negative += 1
    else neutral += 1
  }
  const dominant: NewsSentiment =
    positive >= negative && positive >= neutral
      ? 'positive'
      : negative >= positive && negative >= neutral
        ? 'negative'
        : 'neutral'
  return { positive, neutral, negative, dominant }
}

/** 브리핑용으로 뉴스에서 뽑은 짧은 테마 문장(제목 복붙 지양) */
export function extractBriefingThemes(news: NewsItem[], max = 4): string[] {
  const sorted = sortNewsByDateDesc(news)
  const out: string[] = []
  const seen = new Set<string>()
  for (const n of sorted) {
    const line = n.summary.trim() || n.title.trim()
    if (!line || seen.has(line)) continue
    seen.add(line)
    out.push(line)
    if (out.length >= max) break
  }
  return out
}
