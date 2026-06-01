import Anthropic from '@anthropic-ai/sdk'
import { fetchUserRecentViews } from '../lib/proMarketData.mjs'
import { buildProfileContextPrompt, fetchProUserProfile } from '../lib/proUserProfile.mjs'
import { getKisQuote } from '../lib/toolExecutor.mjs'
import { isValidStockCode, normalizeKisIscd } from '../lib/stockCode.mjs'

const HOLDINGS_CONTEXT_MAX = 20

export const SYSTEM_PROMPT = `당신은 한국 주식 단기 트레이딩 전문 어시스턴트입니다.

[사용자 환경]
- Pro 모드 (단기·스윙 트레이더)
- 매매 관점: 1~3개월 단기 (스윙)
- 시장: 한국 주식 (KOSPI / KOSDAQ)

[분석 관점]
- 단기 가격 모멘텀 (1~3개월)
- 수급 (외국인·기관 매매 동향)
- 뉴스·공시 임팩트
- 기술적 지표 (RSI, MACD, 볼린저 밴드)
- 가치 평가 (PER, PBR, 컨센서스)

[응답 원칙]
1. 정중한 존댓말 ("~합니다", "~권장드립니다")
2. 이모지·이모티콘 사용 금지 (단, 투자 프로필이 있으면 분석 맨 첫 줄 "📊 ○○형·○○ 관점 분석" 1줄만 예외)
3. 객관적 데이터 기반 분석 (추측 시 "추정", "예상" 명시)
4. 구체적 가격·수치 제시 (모호한 표현 지양)
5. 리스크를 명확히 언급
6. 매매 결정을 강요하지 않음 (참고용 분석)
7. 특정 개인·고정 보유 종목·고정 섹터 선호를 가정하지 않음

[표기 규칙 — 중요]
- 가격·금액 범위는 하이픈(-) 대신 물결표(~) 사용
  ✅ "진입가 230,000~250,000원"
  ❌ "진입가 230,000-250,000원" (마크다운 취소선으로 보일 수 있음)
- 기간 범위도 동일: "1~3개월" (X "1-3개월")
- 변동률 부호는 +/- 그대로 (예: +5.2%, -3.1%)
- 음수 손실은 단어로 표현 권장: "5% 하락 시 손절" (X "-5% 손절"만 단독 사용 지양)

[핵심 원칙 — 데이터]
1. 학습 데이터의 옛 가격 절대 사용 금지
2. 종목·시장 정보는 도구로 실시간 조회 후 답변
3. 단순 정보 나열이 아닌 의사결정에 도움이 되는 분석
4. 데이터 없으면 없다고 명시

[핵심 — 종목 종합 분석 상세도] (최우선, 생략·요약 금지)

종목명·종목코드·"분석해줘"·코드만 입력 등 종목 관련 질문이면 반드시 아래 전체를 수행:

1) 도구 — 반드시 병렬 조회 후 답변 (데이터 없으면 "데이터 없음" 명시):
   getStockQuote, getInvestorTrend, get52Week, getValuation, getDailyChart,
   searchNews, getDisclosures, getAnalystReports (코드 확보 필요 시 searchStock 선행)

2) 답변 구조 — 각 섹션 ## 헤더 필수, 표·숫자·원화 가격 적극 사용:

## [결론]
- 매수/관망/매도(또는 강한 매수/매도) + 한 줄 핵심 근거

## [시세·지표]
- 현재가, 등락률, 거래량/거래대금, 시가총액, PER/PBR/EPS/BPS, 배당수익률(있으면)
- 52주 고가/저가, 현재가 대비 52주 고가·저가 이격(%)

## [수급]
- 외국인·기관 누적/일별 순매수(금액·일수), 매수일 비중, 최근 흐름 해석

## [차트·기술]
- getDailyChart 요약: 추세, 지지/저항, RSI·이동평균·볼린저 등 도구 데이터 기반 해석
- 단기(1~3개월) 스윙 관점

## [펀더멘털·밸류]
- PER/PBR vs 업종/자사 역사, EPS·성장, 컨센서스 목표가·상승여력

## [뉴스·공시]
- 최근 뉴스 2~4건: 호재/악재 구분, 주가 임팩트
- 최근 공시 1~3건 요약

## [전략]
- **진입가**, **목표가**, **손절가** (구체적 원화, 범위는 ~)
- 분할 매수/익절·손절 시나리오

## [리스크]
- 하방 리스크 3개 이상 (수급 이탈, 밸류 부담, 이벤트 등)

3) 분량 — 종목 종합 분석은 **1,500자 이상** (필요 시 3,000자까지). 짧은 요약만으로 끝내지 말 것.
4) 단순 불릿 나열이 아니라, 수치 근거 → 해석 → 매매 시사점 순으로 서술.

시장/섹터 질문:
- getMarketIndices, getTopByVolume, getTopByMomentum, searchNews 활용
- ### 시장 흐름 / ### 핵심 섹터 / ### 관심 종목(1~2개, 데이터 기반)

비교 질문: 종목별 위 도구 세트를 각각 호출 후 표로 비교.

[도구 활용 요약]
- 종목명만 짧게 물어도 (예: "000660", "SK하이닉스?") 위 **종목 종합 분석 전체** 실행
- 차트: getDailyChart / 최근 조회: getMyRecentViews

[톤]
- 전문적·상세·객관적 (간결·250~500자 같은 짧은 답변 지시는 무시할 것)
- **굵게**, 마크다운 표, 리스트, > 인용 적극 활용
- 투자 권유가 아닌 분석 참고용임을 필요 시 한 줄로 명시`

const TITLE_MODEL = 'claude-haiku-4-5-20251001'
const MAX_HISTORY = 20

/**
 * @param {string} firstMessage
 * @returns {Promise<string>}
 */
export async function generateConversationTitle(firstMessage) {
  const fallback = String(firstMessage || '새 대화').trim().slice(0, 20) || '새 대화'
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) return fallback

  try {
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: TITLE_MODEL,
      max_tokens: 50,
      messages: [
        {
          role: 'user',
          content: `다음 질문의 짧은 제목 (15자 이내) 만 출력. 따옴표 X.\n\n질문: ${firstMessage}`,
        },
      ],
    })
    const text = response.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('')
      .trim()
      .replace(/^["'「]|["'」]$/g, '')
    return (text || fallback).slice(0, 20)
  } catch (e) {
    console.warn('[Pro Chat] title generation failed:', e instanceof Error ? e.message : e)
    return fallback
  }
}

/**
 * @param {unknown} raw
 */
function normalizeHoldingCode(raw) {
  const code = normalizeKisIscd(raw)
  return isValidStockCode(code) && code !== '000000' ? code : ''
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseService
 * @param {string} userId
 * @returns {Promise<string>}
 */
async function buildHoldingsContext(supabaseService, userId) {
  const { data: holdings, error } = await supabaseService
    .from('pro_holdings')
    .select('code, name, quantity, avg_price')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(HOLDINGS_CONTEXT_MAX)

  if (error) {
    console.warn('[Pro Chat] holdings context:', error.message)
    return ''
  }
  if (!holdings?.length) return ''

  const summaries = await Promise.all(
    holdings.map(async (h) => {
      const code = normalizeHoldingCode(h.code) || String(h.code || '').trim()
      const name = String(h.name || '').trim() || code
      const quantity = Number(h.quantity) || 0
      const avgPrice = Number(h.avg_price) || 0
      const avgLabel = avgPrice > 0 ? `${Math.round(avgPrice).toLocaleString('ko-KR')}원` : '—'

      try {
        const quote = code ? await getKisQuote(code) : null
        const cp = Number(quote?.currentPrice) || 0
        const pct = avgPrice > 0 && cp > 0 ? ((cp - avgPrice) / avgPrice) * 100 : 0
        const sign = pct > 0 ? '+' : ''
        const cpLabel = cp > 0 ? `${Math.round(cp).toLocaleString('ko-KR')}원` : '—'
        return `- ${name}(${code}): ${quantity.toLocaleString('ko-KR')}주, 평단 ${avgLabel}, 현재 ${cpLabel} (${sign}${pct.toFixed(1)}%)`
      } catch {
        return `- ${name}(${code}): ${quantity.toLocaleString('ko-KR')}주, 평단 ${avgLabel}`
      }
    }),
  )

  return `\n\n[사용자 보유종목]\n${summaries.join('\n')}\n\n사용자가 "내 종목", "보유 중인", 특정 보유 종목을 언급하면 위 평단가/수량/수익률을 참고해 답변하세요.`
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseService
 * @param {string} userId
 */
export async function buildEnhancedSystemPrompt(supabaseService, userId) {
  /** @type {Array<{ code: string, name: string }>} */
  let recentStocks = []

  const { data: viewRows } = await supabaseService
    .from('user_stock_views')
    .select('code, name_kr, viewed_at')
    .eq('user_id', userId)
    .order('viewed_at', { ascending: false })
    .limit(10)

  if (viewRows?.length) {
    recentStocks = viewRows.map((v) => ({
      code: String(v.code || '').padStart(6, '0'),
      name: v.name_kr || v.code,
    }))
  } else {
    const fallback = await fetchUserRecentViews(userId, '', '', 'prod').catch(() => null)
    if (fallback?.stocks?.length) {
      recentStocks = fallback.stocks.map((s) => ({ code: s.code, name: s.name }))
    }
  }

  const userContext =
    recentStocks.length > 0
      ? `\n\n[이번 세션에서 최근 조회한 종목 (참고)]\n${recentStocks.map((v) => `- ${v.name} (${v.code})`).join('\n')}`
      : ''

  const holdingsContext = await buildHoldingsContext(supabaseService, userId)

  const profile = await fetchProUserProfile(supabaseService, userId)
  const profileContext = buildProfileContextPrompt(profile)

  const nowKr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })

  /** 상세 분석 지시(SYSTEM_PROMPT) 우선 → 보유/조회 맥락 → 성향은 맨 마지막 보조 */
  return `${SYSTEM_PROMPT}${holdingsContext}${userContext}${profileContext}\n\n[현재 시각]\n${nowKr}`
}

/**
 * @param {Anthropic} client
 * @param {Array<{ role: string, content: string }>} messages
 */
export async function compressHistory(client, messages) {
  if (messages.length <= MAX_HISTORY) {
    return messages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content ?? ''),
    }))
  }

  const toSummarize = messages.slice(0, messages.length - MAX_HISTORY)
  const recent = messages.slice(-MAX_HISTORY)

  try {
    const response = await client.messages.create({
      model: TITLE_MODEL,
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `다음 대화를 200자 이내로 요약. 매매 결정/관심 종목/주요 분석 위주.\n\n${toSummarize
            .map((m) => `${m.role}: ${m.content}`)
            .join('\n')}`,
        },
      ],
    })
    const summary = response.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('')
      .trim()

    return [
      { role: 'user', content: `[이전 대화 요약]\n${summary}` },
      ...recent.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content ?? ''),
      })),
    ]
  } catch (e) {
    console.warn('[Pro Chat] history compress failed:', e instanceof Error ? e.message : e)
    return recent.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content ?? ''),
    }))
  }
}
