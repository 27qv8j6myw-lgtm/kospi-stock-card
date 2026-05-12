import Parser from 'rss-parser'
import { completeJsonChat } from './aiClient.mjs'

const rssParser = new Parser()

const IT_COMPONENT_STOCK_THEMES = {
  삼성전기: ['FC-BGA', 'MLCC', 'AI 서버'],
  LG이노텍: ['카메라모듈', '애플 공급망', '스마트폰'],
  대덕전자: ['서버 PCB', 'FC-BGA', '고부가 기판'],
  심텍: ['AI 서버', '패키징', '기판'],
  코리아써키트: ['PCB', '고부가 기판'],
  해성디에스: ['패키징', '리드프레임'],
  이수페타시스: ['NVIDIA', 'AI 서버', 'PCB'],
  비에이치: ['스마트폰', 'FPCB'],
  인터플렉스: ['FPCB', '스마트폰'],
  파트론: ['카메라모듈', 'RF'],
  자화전자: ['카메라모듈', 'OIS'],
  와이솔: ['RF 부품', '스마트폰'],
}

function encodeGoogleQuery(q) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=ko&gl=KR&ceid=KR:ko`
}

function daysAgoISO(days) {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

function toDateIso(input) {
  const t = Date.parse(String(input || ''))
  if (!Number.isFinite(t)) return new Date().toISOString()
  return new Date(t).toISOString()
}

function inRecentDays(iso, days = 7) {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return false
  return t >= Date.parse(daysAgoISO(days))
}

function stripHtml(s) {
  return String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function classifyCategory(text) {
  const t = String(text || '')
  if (/실적|어닝|영업이익|매출|컨센서스/i.test(t)) return 'earnings'
  if (/목표가|목표주가|투자의견|리포트|증권/i.test(t)) return 'target_price'
  if (/수주|계약|발주/i.test(t)) return 'order'
  if (/증설|CAPA|공장|라인/i.test(t)) return 'capacity'
  if (/정책|금리|환율|관세|매크로|인플레이션/i.test(t)) return 'macro'
  if (/섹터|업황|사이클|테마/i.test(t)) return 'sector'
  if (/리스크|소송|악재|하향|부진/i.test(t)) return 'risk'
  return 'other'
}

function detectSentiment(text) {
  const t = String(text || '')
  if (/상향|급등|호조|수주|증설|개선|신고가|서프라이즈|흑자/i.test(t)) return 'positive'
  if (/하향|급락|부진|감소|적자|악화|리스크|경고/i.test(t)) return 'negative'
  return 'neutral'
}

function pickSource(item) {
  const raw = String(item?.source?.title || item?.creator || item?.author || '')
  if (!raw) return 'Google News'
  return raw
}

async function fetchGoogleNewsByQueries(queries, max = 18) {
  const results = []
  const seen = new Set()
  for (const q of queries) {
    try {
      const res = await fetch(encodeGoogleQuery(q), {
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; kospi-stock-card)' },
      })
      if (!res.ok) continue
      const xml = await res.text()
      const feed = await rssParser.parseString(xml)
      const items = Array.isArray(feed?.items) ? feed.items : []
      for (const it of items) {
        const title = stripHtml(it?.title || '')
        const link = String(it?.link || '').trim()
        if (!title || !link) continue
        const key = `${title}|${link}`
        if (seen.has(key)) continue
        seen.add(key)
        const publishedAt = toDateIso(it?.pubDate || it?.isoDate)
        const summary = stripHtml(it?.contentSnippet || it?.content || '')
        results.push({
          title,
          link,
          source: pickSource(it),
          publishedAt,
          summary,
          category: classifyCategory(`${title} ${summary}`),
          sentiment: detectSentiment(`${title} ${summary}`),
        })
      }
    } catch {
      // ignore each query failure
    }
  }
  return results
    .filter((n) => inRecentDays(n.publishedAt, 7))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, max)
}

async function fetchNaverNews(stockName) {
  const id = process.env.NAVER_CLIENT_ID?.trim()
  const secret = process.env.NAVER_CLIENT_SECRET?.trim()
  if (!id || !secret) return []
  const url = new URL('https://openapi.naver.com/v1/search/news.json')
  url.searchParams.set('query', `${stockName} 목표가 리포트 실적`)
  url.searchParams.set('display', '20')
  url.searchParams.set('sort', 'date')
  try {
    const res = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': id,
        'X-Naver-Client-Secret': secret,
      },
    })
    if (!res.ok) return []
    const json = await res.json()
    const items = Array.isArray(json?.items) ? json.items : []
    return items.map((it) => {
      const title = stripHtml(it?.title || '')
      const summary = stripHtml(it?.description || '')
      const publishedAt = toDateIso(it?.pubDate)
      return {
        title,
        link: String(it?.originallink || it?.link || ''),
        source: 'Naver News',
        publishedAt,
        summary,
        category: classifyCategory(`${title} ${summary}`),
        sentiment: detectSentiment(`${title} ${summary}`),
      }
    })
  } catch {
    return []
  }
}

export async function searchLatestNews(stockName, stockCode) {
  const extraThemes = IT_COMPONENT_STOCK_THEMES[stockName] || []
  const queries = [
    stockName,
    `${stockName} ${stockCode}`,
    `${stockName} 실적`,
    `${stockName} 수주`,
    `${stockName} 증설`,
    `${stockName} 목표가`,
    `${stockName} 리포트`,
    `${stockName} 전망`,
    `${stockName} 컨센서스`,
    ...extraThemes.map((k) => `${stockName} ${k}`),
    `${stockName} 애플 공급망`,
    `${stockName} NVIDIA`,
    `${stockName} HBM`,
    `${stockName} 서버 투자`,
  ]
  const [google, naver] = await Promise.all([
    fetchGoogleNewsByQueries(queries, 24),
    fetchNaverNews(stockName),
  ])
  const merged = [...google, ...naver]
  const seen = new Set()
  return merged
    .filter((n) => {
      const key = `${n.title}|${n.link}`
      if (seen.has(key)) return false
      seen.add(key)
      return inRecentDays(n.publishedAt, 7)
    })
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, 16)
}

function extractBrokerName(text) {
  const brokers = [
    'NH투자증권',
    'KB증권',
    '신한투자증권',
    '미래에셋증권',
    '하나증권',
    '한국투자증권',
    '메리츠증권',
    '대신증권',
    '유안타증권',
    '키움증권',
    '한화투자증권',
  ]
  return brokers.find((b) => String(text || '').includes(b))
}

function extractTargetPair(text) {
  const src = String(text || '')
  const pair =
    src.match(/(\d[\d,]*)\s*원?\s*에서\s*(\d[\d,]*)\s*원?\s*으로\s*(상향|하향)/) ||
    src.match(/목표(?:가|주가).{0,12}?(\d[\d,]*)\s*원?\s*→\s*(\d[\d,]*)\s*원?/)
  const toNum = (v) => {
    const n = Number(String(v || '').replace(/[^\d]/g, ''))
    return Number.isFinite(n) && n > 0 ? n : undefined
  }
  if (pair) return { previousTargetPrice: toNum(pair[1]), targetPrice: toNum(pair[2]) }
  const single = src.match(/목표(?:가|주가)\s*(?:는|을|)\s*(\d[\d,]*)\s*원/) || src.match(/\bTP\s*(\d[\d,]*)\s*원?/)
  return single ? { targetPrice: toNum(single[1]) } : {}
}

function detectDirection(title) {
  const t = String(title || '')
  if (/목표(?:가|주가).{0,8}(상향|올려|인상)/.test(t)) return 'up'
  if (/목표(?:가|주가).{0,8}(하향|내려|인하)/.test(t)) return 'down'
  if (/유지|동결|maintain/i.test(t)) return 'maintain'
  return 'unknown'
}

function extractRating(text) {
  const t = String(text || '')
  if (/투자의견\s*매수|BUY|Outperform/i.test(t)) return 'BUY'
  if (/보유|HOLD|중립|Neutral/i.test(t)) return 'HOLD'
  if (/매도|SELL|Underperform/i.test(t)) return 'SELL'
  return undefined
}

export async function searchBrokerReports(stockName, stockCode) {
  const extraThemes = IT_COMPONENT_STOCK_THEMES[stockName] || []
  const queries = [
    `${stockName} 리포트`,
    `${stockName} 목표가`,
    `${stockName} 투자의견`,
    `${stockName} 증권`,
    `${stockName} 컨센서스`,
    `${stockName} 실적 프리뷰`,
    `${stockName} ${stockCode} 리포트`,
    ...extraThemes.map((k) => `${stockName} ${k}`),
    `${stockName} 목표가 상향`,
  ]
  const raws = await fetchGoogleNewsByQueries(queries, 36)
  const reports = raws
    .filter((n) => /리포트|목표가|목표주가|투자의견|증권|프리뷰|컨센서스/i.test(n.title))
    .map((n) => {
      const joined = `${n.title} ${n.summary || ''}`
      const pair = extractTargetPair(joined)
      const publishedAt = n.publishedAt
      const ageDays = Math.max(0, Math.floor((Date.now() - Date.parse(publishedAt || '')) / 86_400_000))
      if (ageDays > 90) return null
      return {
        title: n.title,
        broker: extractBrokerName(joined),
        publishedAt,
        targetPrice: pair.targetPrice,
        previousTargetPrice: pair.previousTargetPrice,
        rating: extractRating(joined),
        summary: ageDays > 30 ? `[참고용(${ageDays}일 경과)] ${n.summary || ''}` : n.summary,
        link: n.link,
        direction: detectDirection(n.title),
      }
    })
    .filter(Boolean)
    .sort((a, b) => Date.parse(b.publishedAt || '') - Date.parse(a.publishedAt || ''))
    .slice(0, 10)
  return reports
}

export function buildSourceList(news, reports) {
  return [
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
  ].slice(0, 20)
}

function normalizeBriefing(json) {
  const str = (v, fallback = '') => (typeof v === 'string' && v.trim() ? v.trim() : fallback)
  const strArr = (v, max = 8) =>
    Array.isArray(v)
      ? v
          .filter((x) => typeof x === 'string' && x.trim())
          .slice(0, max)
          .map((x) => x.trim())
      : []
  const actionRaw = str(json?.action, 'WATCH')
  const action = ['BUY', 'WAIT_FOR_PULLBACK', 'HOLD', 'TAKE_PROFIT', 'WATCH', 'AVOID'].includes(actionRaw)
    ? actionRaw
    : 'WATCH'
  const confidence = Number(json?.confidence)
  const keyNews = Array.isArray(json?.keyNews) ? json.keyNews.slice(0, 6) : []
  return {
    title: str(json?.title, '투자 브리핑'),
    paragraphs: strArr(json?.paragraphs, 8).slice(0, 5),
    keyPoints: strArr(json?.bullishPoints, 8),
    risks: strArr(json?.riskPoints, 8),
    keyNews,
    brokerView: json?.brokerView || { summary: '증권사 리포트 요약이 충분하지 않습니다.' },
    bullishPoints: strArr(json?.bullishPoints, 8),
    riskPoints: strArr(json?.riskPoints, 8),
    strategyComment: str(json?.strategyComment, ''),
    action,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(100, Math.round(confidence))) : 50,
    tone: action === 'AVOID' ? 'caution' : action === 'BUY' ? 'bullish' : 'neutral',
  }
}

export async function generateMarketBriefingWithAi({
  stockName,
  stockCode,
  metrics,
  strategy,
  news,
  reports,
}) {
  const promptPayload = {
    stockName,
    stockCode,
    metrics,
    strategy,
    news: news.slice(0, 12),
    reports: reports.slice(0, 8),
  }
  const prompt = [
    '당신은 한국 주식 단기 투자 메모 작성자입니다.',
    '최신 뉴스/증권사 리포트를 반영하되 제목 나열이 아니라 왜 주가에 중요한지 설명하세요.',
    '최근 주가 변화, 뉴스 트리거, 목표가 변화, 실적 프리뷰, 수주/증설/정책/매크로, 수급, RSI/ATR 과열, 1개월/3개월 전략을 반드시 다룹니다.',
    '숫자는 입력에 있는 값만 사용하고 모르면 모른다고 명시하세요.',
    '출력은 JSON만 반환하고 스키마 키는 title, paragraphs, keyNews, brokerView, bullishPoints, riskPoints, strategyComment, action, confidence 입니다.',
    'action은 BUY|WAIT_FOR_PULLBACK|HOLD|TAKE_PROFIT|WATCH|AVOID 중 하나.',
    '',
    JSON.stringify(promptPayload),
  ].join('\n')

  const json = await completeJsonChat({
    system:
      '너는 근거 기반 한국주식 애널리스트다. 단정적 표현을 피하고, 트리거와 펀더멘털을 분리해 설명한다.',
    user: prompt,
  })
  return normalizeBriefing(json)
}
