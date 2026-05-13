import { completeResearchStockChat } from './aiClient.mjs'

const RESEARCH_SYSTEM = `너는 한국 주식 종목 리서치 어시스턴트다. 사용자가 종목명을 주면, web_search 도구를 사용해 최근 7일 (정확히 오늘 기준 -7일 이내) 의 신빙성 있는 기사와 증권사 리포트를 수집한다.

검색 우선순위:
1. 증권사 리서치 리포트 (한국투자증권, 미래에셋, NH투자증권, 키움, 삼성증권, 하나증권, KB증권 등)
2. 주요 경제지 (한경, 매경, 조선비즈, 서울경제, 머니투데이, 연합인포맥스)
3. 산업 전문지 (전자신문, 디지털타임스, 더벨)
4. 해외 매체 (Reuters, Bloomberg, FT, Nikkei) — 외국인 시각

검색 쿼리 전략:
- 종목명 + "목표가" → 증권사 리포트
- 종목명 + 직전 분기 (예: "2026 1분기") → 실적 관련
- 종목명 + 업종 키워드 (예: "메모리", "HBM", "파운드리") → 산업 동향
- 종목명 + "외국인" 또는 "수급" → 수급 분석

각 기사·리포트마다 다음을 추출:
- 발행일 (YYYY-MM-DD, 7일 이내가 아니면 제외)
- 매체명 / 작성자
- 제목
- URL
- 핵심 주장 1~2줄 (직접 인용 X, 자기 말로 paraphrase)
- 분류: catalyst (호재) / risk (악재) / neutral (중립) / target (목표가) / earnings (실적) / supply_demand (수급)
- 신뢰도: high (증권사 리포트, 메이저 매체) / medium (일반 매체) / low (블로그·SNS는 제외)

특별 수집 항목:
- 직전 분기 실적 발표 결과 (있다면)
- 컨센서스 목표가 변경 이력 (4주 이내)
- 임박한 카탈리스트 일정 (실적 발표일, 신제품 발표, 정책 결정 등)
- 동종업계 주요 이벤트 (경쟁사 실적, 산업 가격 변동)

출력 형식 (JSON):
{
  "stock_name": "...",
  "stock_code": "...",
  "research_date": "YYYY-MM-DD",
  "sources": [
    {
      "date": "...",
      "publisher": "...",
      "author": "...",
      "title": "...",
      "url": "...",
      "summary": "...",
      "category": "...",
      "credibility": "..."
    }
  ],
  "key_findings": {
    "recent_earnings": "...",
    "consensus_change": "...",
    "upcoming_catalysts": ["..."],
    "industry_context": "..."
  }
}

규칙:
- 7일 이내 기사가 부족하면 14일까지 확장 가능. 그 이상은 안 됨.
- 동일 사건을 다룬 기사 중복 수집 시 가장 신뢰도 높은 것 1개만 보존.
- 추측·소문성 기사는 명시적으로 credibility: low 처리.
- 출처 URL은 반드시 실제 URL 보존 (web_search 결과의 url 그대로).
- web_search 결과가 0건이어도 sources는 빈 배열로 두고, key_findings는 가능한 한 채운다.
- 반드시 JSON 객체만 출력하고 설명 문장·마크다운 코드펜스는 쓰지 마라.`

const CATEGORIES = new Set(['catalyst', 'risk', 'neutral', 'target', 'earnings', 'supply_demand'])
const CRED = new Set(['high', 'medium', 'low'])

function kstDateISO() {
  const d = new Date()
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = fmt.formatToParts(d)
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970'
  const m = parts.find((p) => p.type === 'month')?.value ?? '01'
  const day = parts.find((p) => p.type === 'day')?.value ?? '01'
  return `${y}-${m}-${day}`
}

function stripJsonFences(text) {
  const t = String(text || '').trim()
  const m = t.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i)
  if (m) return m[1].trim()
  return t
}

function tryParseResearchJson(text) {
  const stripped = stripJsonFences(text)
  try {
    return JSON.parse(stripped)
  } catch {
    const i = stripped.indexOf('{')
    const j = stripped.lastIndexOf('}')
    if (i >= 0 && j > i) {
      try {
        return JSON.parse(stripped.slice(i, j + 1))
      } catch {
        return null
      }
    }
    return null
  }
}

function emptyKeyFindings(note) {
  return {
    recent_earnings: null,
    consensus_change: null,
    upcoming_catalysts: [],
    industry_context: note,
  }
}

function normalizeSource(s) {
  if (!s || typeof s !== 'object') return null
  const date = typeof s.date === 'string' ? s.date : ''
  const publisher = typeof s.publisher === 'string' ? s.publisher : '미상'
  const author = s.author == null || s.author === '' ? null : String(s.author)
  const title = typeof s.title === 'string' ? s.title : ''
  const url = typeof s.url === 'string' ? s.url : ''
  const summary = typeof s.summary === 'string' ? s.summary : ''
  let category = typeof s.category === 'string' ? s.category : 'neutral'
  if (!CATEGORIES.has(category)) category = 'neutral'
  let credibility = typeof s.credibility === 'string' ? s.credibility : 'medium'
  if (!CRED.has(credibility)) credibility = 'medium'
  if (!title && !url) return null
  return { date, publisher, author, title, url, summary, category, credibility }
}

function normalizeResearch(raw, stockName, stockCode) {
  const today = kstDateISO()
  const sourcesIn = Array.isArray(raw?.sources) ? raw.sources : []
  const sources = []
  const seenUrl = new Set()
  for (const s of sourcesIn) {
    const n = normalizeSource(s)
    if (!n || !n.url) continue
    if (seenUrl.has(n.url)) continue
    seenUrl.add(n.url)
    sources.push(n)
  }

  const kf = raw?.key_findings && typeof raw.key_findings === 'object' ? raw.key_findings : {}
  const upcoming = Array.isArray(kf.upcoming_catalysts)
    ? kf.upcoming_catalysts.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim())
    : []

  return {
    stock_name: typeof raw?.stock_name === 'string' && raw.stock_name.trim() ? raw.stock_name.trim() : stockName,
    stock_code: typeof raw?.stock_code === 'string' && raw.stock_code.trim() ? raw.stock_code.trim() : stockCode,
    research_date: typeof raw?.research_date === 'string' && raw.research_date.trim() ? raw.research_date.trim() : today,
    sources,
    key_findings: {
      recent_earnings:
        kf.recent_earnings == null || kf.recent_earnings === ''
          ? null
          : String(kf.recent_earnings),
      consensus_change:
        kf.consensus_change == null || kf.consensus_change === ''
          ? null
          : String(kf.consensus_change),
      upcoming_catalysts: upcoming,
      industry_context:
        typeof kf.industry_context === 'string' && kf.industry_context.trim()
          ? kf.industry_context.trim()
          : '동종·산업 맥락은 수집된 기사가 부족하거나 요약되지 않았습니다.',
    },
  }
}

/**
 * @param {string} stockName
 * @param {string} stockCode
 */
export async function runResearchStock(stockName, stockCode) {
  const name = String(stockName || '').trim()
  const code = String(stockCode || '')
    .replace(/\D/g, '')
    .padStart(6, '0')
  const today = kstDateISO()
  const user = `종목: ${name} (${code})
오늘 날짜: ${today}
리서치 시작해라.`

  let rawText = ''
  try {
    rawText = await completeResearchStockChat({
      system: RESEARCH_SYSTEM,
      user,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[researchStock] API error:', msg)
    return {
      stock_name: name,
      stock_code: code,
      research_date: today,
      sources: [],
      key_findings: emptyKeyFindings(`리서치 API 오류: ${msg}`),
    }
  }

  let parsed = tryParseResearchJson(rawText)
  if (!parsed) {
    console.warn('[researchStock] JSON parse failed, raw (truncated):\n', rawText.slice(0, 4000))
    const retryUser = `${user}

이전 응답이 유효한 JSON이 아니었다. 아래 내용을 참고해 **오직 JSON 스키마 하나만** 다시 출력하라 (코드펜스 금지).

---
${rawText.slice(0, 12_000)}
---`
    try {
      rawText = await completeResearchStockChat({
        system: RESEARCH_SYSTEM,
        user: retryUser,
      })
      parsed = tryParseResearchJson(rawText)
    } catch (e2) {
      console.warn('[researchStock] retry failed:', e2)
    }
  }

  if (!parsed) {
    return {
      stock_name: name,
      stock_code: code,
      research_date: today,
      sources: [],
      key_findings: emptyKeyFindings('모델 응답 JSON 파싱에 실패했습니다. ANTHROPIC_RESEARCH_MODEL·웹 검색 권한을 확인하세요.'),
    }
  }

  return normalizeResearch(parsed, name, code)
}
