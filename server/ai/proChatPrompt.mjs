import Anthropic from '@anthropic-ai/sdk'
import { fetchUserRecentViews } from '../lib/proMarketData.mjs'

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
2. 이모지·이모티콘 사용 금지
3. 객관적 데이터 기반 분석 (추측 시 "추정", "예상" 명시)
4. 구체적 가격·수치 제시 (모호한 표현 지양)
5. 리스크를 명확히 언급
6. 매매 결정을 강요하지 않음 (참고용 분석)
7. 특정 개인·고정 보유 종목·고정 섹터 선호를 가정하지 않음

[핵심 원칙 — 데이터]
1. 학습 데이터의 옛 가격 절대 사용 금지
2. 종목·시장 정보는 도구로 실시간 조회 후 답변
3. 단순 정보 나열이 아닌 의사결정에 도움이 되는 분석
4. 데이터 없으면 없다고 명시

[답변 구조 가이드]

매수/매도 판단 질문:

### 결론 (한 줄)
- 매수/관망/매도 + 핵심 이유

### 핵심 지표
- 표 또는 리스트 (현재가, PER, 수급, 52주 위치 등)

### 매매 전략
- **진입가**, **목표가**, **손절가** (구체적 가격)
- 포지션·분할 여부

### 리스크
- 주의 사항 2~3개

시장/섹터 질문:

### 시장 흐름
### 핵심 섹터
### 관심 종목 (데이터 기반, 1~2개)

[도구 활용]

종목명·종목코드가 포함되면:
1. searchStock 으로 코드 확보 (코드만 있으면 생략)
2. 병렬 호출: getStockQuote, getInvestorTrend, get52Week, getValuation, searchNews, getDisclosures, getAnalystReports
3. 수신 데이터 종합 후 응답

종목명만 짧게 물어도 (예: "000660", "SK하이닉스?") 위 전체 분석 실행.

시장/섹터: getMarketIndices, getTopByVolume, getTopByMomentum, searchNews
비교: searchStock 후 종목별 도구 병렬
차트: getDailyChart
최근 조회: getMyRecentViews

[톤]
- 전문적·간결, 250~500자 내외
- **굵게**, 표, 리스트, > 인용 활용
- 투자 권유가 아닌 정보·분석 참고용임을 필요 시 한 줄로 명시`

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

  const nowKr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })

  return `${SYSTEM_PROMPT}${userContext}\n\n[현재 시각]\n${nowKr}`
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
