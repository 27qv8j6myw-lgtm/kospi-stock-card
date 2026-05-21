/** 네이버 검색 API — Pro 뉴스 (최근 3일) */

const NEWS_MAX_AGE_DAYS = 3

function stripHtml(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * @param {string | Date} pubDate
 * @returns {boolean}
 */
function isWithinRecentDays(pubDate, days = NEWS_MAX_AGE_DAYS) {
  const t = Date.parse(String(pubDate || ''))
  if (!Number.isFinite(t)) return false
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  return t >= cutoff.getTime()
}

/**
 * @param {string} query
 * @param {{ display?: number, sort?: 'date' | 'sim' }} [opts]
 * @returns {Promise<Array<{ title: string, description: string, link: string, originallink: string, pubDate: string }>>}
 */
export async function searchNaverNews(query, opts = {}) {
  const id = process.env.NAVER_CLIENT_ID?.trim()
  const secret = process.env.NAVER_CLIENT_SECRET?.trim()
  if (!id || !secret) return []

  const display = Math.min(Math.max(Number(opts.display) || 10, 1), 100)
  const sort = opts.sort === 'sim' ? 'sim' : 'date'

  const url = new URL('https://openapi.naver.com/v1/search/news.json')
  url.searchParams.set('query', String(query || '').trim())
  url.searchParams.set('display', String(display))
  url.searchParams.set('sort', sort)

  try {
    const res = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': id,
        'X-Naver-Client-Secret': secret,
      },
    })
    if (!res.ok) return []

    const data = await res.json()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - NEWS_MAX_AGE_DAYS)

    const items = Array.isArray(data?.items) ? data.items : []

    return items
      .map((item) => ({
        title: stripHtml(item?.title || ''),
        description: stripHtml(item?.description || ''),
        link: String(item?.link || ''),
        originallink: String(item?.originallink || item?.link || ''),
        pubDate: String(item?.pubDate || ''),
      }))
      .filter((item) => item.title && item.pubDate && new Date(item.pubDate) >= cutoffDate)
      .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
  } catch {
    return []
  }
}

export { isWithinRecentDays, NEWS_MAX_AGE_DAYS }
