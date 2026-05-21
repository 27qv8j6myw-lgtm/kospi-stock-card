import Parser from 'rss-parser'
import { fetchConsensusDetails } from '../consensusDetails.mjs'
import { isWithinRecentDays, NEWS_MAX_AGE_DAYS, searchNaverNews } from './naverClient.mjs'

const rssParser = new Parser()

function normalizeCode(raw) {
  return String(raw || '')
    .replace(/\D/g, '')
    .padStart(6, '0')
    .slice(0, 6)
}

function stripHtml(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function yyyymmddDaysAgo(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

/**
 * Google News RSS (네이버 미설정 시 fallback, 3일 이내)
 * @param {string} query
 * @param {number} fetchCount
 */
async function searchGoogleNewsRecent(query, fetchCount) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} 주식`)}&hl=ko&gl=KR&ceid=KR:ko`
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; kospi-stock-card)' },
    })
    if (!res.ok) return []
    const feed = await rssParser.parseString(await res.text())
    const items = Array.isArray(feed?.items) ? feed.items : []
    return items
      .map((it) => ({
        title: stripHtml(it?.title || ''),
        description: stripHtml(it?.contentSnippet || it?.content || ''),
        link: String(it?.link || '').trim(),
        pubDate: String(it?.pubDate || it?.isoDate || ''),
        source: String(it?.creator || it?.source?.title || 'Google News'),
      }))
      .filter((n) => n.title && n.link && n.pubDate && isWithinRecentDays(n.pubDate))
      .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
      .slice(0, fetchCount)
  } catch {
    return []
  }
}

/**
 * @param {string} query
 * @param {number} limit
 */
export async function searchNewsForPro(query, limit = 5) {
  const q = String(query || '').trim()
  if (!q) return { news: [] }

  const fetchCount = Math.min(Math.max(limit * 2, limit), 20)

  let items = await searchNaverNews(q, { display: fetchCount, sort: 'date' })

  if (!items.length) {
    items = await searchGoogleNewsRecent(q, fetchCount)
  }

  const sorted = items
    .filter((n) => n.title && (n.link || n.originallink))
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
    .slice(0, limit)

  return {
    query: q,
    count: sorted.length,
    news: sorted.map((n) => ({
      title: n.title,
      description: (n.description || '').slice(0, 150),
      link: n.link || n.originallink,
      pubDate: n.pubDate,
      source: n.source || 'Naver News',
    })),
  }
}

/**
 * 네이버 금융 DART 공시 목록 (OpenDART 키 없을 때)
 * @param {string} code6
 * @param {number} days
 */
export async function getDisclosuresForPro(code6, days = 30) {
  const code = normalizeCode(code6)
  const minDate = yyyymmddDaysAgo(days)
  const url = `https://finance.naver.com/item/dart.naver?code=${code}`
  try {
    const res = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; kospi-stock-card)',
        accept: 'text/html,application/xhtml+xml',
      },
    })
    if (!res.ok) return { disclosures: [] }
    const html = await res.text()
    const disclosures = []
    const rowRe =
      /<tr[^>]*>[\s\S]*?<td[^>]*class="date"[^>]*>\s*(\d{4})\.(\d{2})\.(\d{2})[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
    let m
    while ((m = rowRe.exec(html)) !== null && disclosures.length < 20) {
      const date = `${m[1]}${m[2]}${m[3]}`
      if (date < minDate) continue
      let link = m[4]
      if (link.startsWith('/')) link = `https://finance.naver.com${link}`
      const report = stripHtml(m[5])
      if (!report) continue
      disclosures.push({ date, report, link })
    }
    return { disclosures }
  } catch {
    return { disclosures: [] }
  }
}

/**
 * @param {string} code6
 * @param {number | null | undefined} [currentPrice]
 */
export async function getAnalystReportsForPro(code6, currentPrice) {
  const code = normalizeCode(code6)
  try {
    const consensus = await fetchConsensusDetails(code)
    if (!consensus?.avgTargetPrice) {
      return { available: false }
    }
    const targetPrice = consensus.avgTargetPrice
    const price = Number(currentPrice)
    const upside =
      Number.isFinite(price) && price > 0
        ? Number((((targetPrice - price) / price) * 100).toFixed(1))
        : null
    return {
      available: true,
      targetPrice,
      upside,
      opinion: consensus.recommendationText ?? consensus.recommendationLabel ?? null,
      reportCount: consensus.analystCount ?? null,
      source: consensus.source,
      minTargetPrice: consensus.minTargetPrice,
      maxTargetPrice: consensus.maxTargetPrice,
    }
  } catch {
    return { available: false }
  }
}

export { NEWS_MAX_AGE_DAYS }
